"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type MonitoringRpsStatus = "draft" | "queued" | "parsing" | "extracting" | "review" | "approved" | "failed";

export type MonitoringRpsItem = {
  id: string;
  code: string;
  courseName: string;
  owner: string;
  period: string;
  version: number;
  status: MonitoringRpsStatus;
  statusLabel: string;
  progress: number;
  updatedAt: string;
  issues: number;
  structuredData: Record<string, unknown>;
  validationSummary: Record<string, unknown>;
};

export type MonitoringRpsPayload = {
  currentStageKey: string | null;
  currentStageTitle: string | null;
  canCompose: boolean;
  canEvaluate: boolean;
  items: MonitoringRpsItem[];
  counts: {
    draft: number;
    processing: number;
    review: number;
    approved: number;
    failed: number;
  };
};

type LoadResult = { ok: true; data: MonitoringRpsPayload } | { ok: false; message: string };

const labels: Record<MonitoringRpsStatus, string> = {
  draft: "Draft",
  queued: "Antrean",
  parsing: "Parsing",
  extracting: "Ekstraksi",
  review: "Review",
  approved: "Disetujui",
  failed: "Gagal",
};

const progressByStatus: Record<MonitoringRpsStatus, number> = {
  draft: 20,
  queued: 30,
  parsing: 42,
  extracting: 58,
  review: 78,
  approved: 100,
  failed: 0,
};

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function issueCount(summary: Record<string, unknown>) {
  const direct = [summary.issue_count, summary.issues_count, summary.errors, summary.warnings]
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (direct.length) return Math.max(...direct);
  const issues = summary.issues;
  return Array.isArray(issues) ? issues.length : 0;
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
  } catch {
    return value;
  }
}

export async function loadMonitoringRps(): Promise<LoadResult> {
  try {
    const session = await createClient();
    const { data: { user }, error } = await session.auth.getUser();
    if (error || !user) throw new Error("Sesi telah berakhir. Silakan masuk kembali.");

    const admin = getSupabaseAdmin();
    const [profile, platformRole, assignments] = await Promise.all([
      admin.from("profiles").select("status").eq("id", user.id).maybeSingle(),
      admin.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
      admin.from("user_role_assignments").select("organization_id,role").eq("user_id", user.id),
    ]);
    if (profile.error || platformRole.error || assignments.error) throw new Error("Otorisasi monitoring tidak dapat diverifikasi.");
    if (profile.data?.status !== "active") throw new Error("Akun tidak aktif.");

    const isSuperadmin = platformRole.data?.role === "superadmin";
    const organizationIds = [...new Set((assignments.data ?? []).map((row) => String(row.organization_id)))];
    if (!isSuperadmin && !organizationIds.length) throw new Error("Tidak ada lingkup institusi untuk Monitoring RPS.");

    let documentQuery = admin
      .from("rps_documents")
      .select("id,organization_id,course_id,curriculum_course_id,academic_period_id,created_by,version,status,structured_data,validation_summary,updated_at")
      .order("updated_at", { ascending: false });
    if (!isSuperadmin) documentQuery = documentQuery.in("organization_id", organizationIds);
    const documents = await documentQuery;
    if (documents.error) throw documents.error;

    let programQuery = admin.from("academic_programs").select("id,organization_id").eq("is_enabled", true);
    if (!isSuperadmin) programQuery = programQuery.in("organization_id", organizationIds);
    const programs = await programQuery;
    if (programs.error) throw programs.error;
    const programIds = (programs.data ?? []).map((row) => String(row.id));

    let activePeriods: Array<Record<string, unknown>> = [];
    let currentStageKey: string | null = null;
    let currentStageTitle: string | null = null;
    if (programIds.length) {
      const periods = await admin
        .from("academic_periods")
        .select("id,label,academic_program_id")
        .in("academic_program_id", programIds)
        .eq("status", "active");
      if (periods.error) throw periods.error;
      activePeriods = periods.data ?? [];
      const periodIds = activePeriods.map((row) => String(row.id));
      if (periodIds.length) {
        const today = jakartaToday();
        const stages = await admin
          .from("academic_stages")
          .select("stage_key,title,academic_period_id,starts_at,ends_at,sort_order")
          .in("academic_period_id", periodIds)
          .lte("starts_at", today)
          .gte("ends_at", today)
          .order("sort_order");
        if (stages.error) throw stages.error;
        const stage = stages.data?.[0];
        if (stage) {
          currentStageKey = String(stage.stage_key);
          currentStageTitle = String(stage.title);
        }
      }
    }

    const rows = documents.data ?? [];
    const legacyCourseIds = [...new Set(rows.map((row) => row.course_id).filter(Boolean).map(String))];
    const curriculumCourseIds = [...new Set(rows.map((row) => row.curriculum_course_id).filter(Boolean).map(String))];
    const periodIds = [...new Set(rows.map((row) => row.academic_period_id).filter(Boolean).map(String))];
    const ownerIds = [...new Set(rows.map((row) => row.created_by).filter(Boolean).map(String))];

    const [legacyCourses, curriculumCourses, periods, owners] = await Promise.all([
      legacyCourseIds.length ? admin.from("courses").select("id,code,name").in("id", legacyCourseIds) : Promise.resolve({ data: [], error: null }),
      curriculumCourseIds.length ? admin.from("curriculum_courses").select("id,code,name").in("id", curriculumCourseIds) : Promise.resolve({ data: [], error: null }),
      periodIds.length ? admin.from("academic_periods").select("id,label").in("id", periodIds) : Promise.resolve({ data: [], error: null }),
      ownerIds.length ? admin.from("profiles").select("id,display_name,email").in("id", ownerIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (legacyCourses.error || curriculumCourses.error || periods.error || owners.error) {
      throw legacyCourses.error ?? curriculumCourses.error ?? periods.error ?? owners.error;
    }

    const legacyById = new Map((legacyCourses.data ?? []).map((row) => [String(row.id), row]));
    const curriculumById = new Map((curriculumCourses.data ?? []).map((row) => [String(row.id), row]));
    const periodById = new Map((periods.data ?? []).map((row) => [String(row.id), String(row.label)]));
    const ownerById = new Map((owners.data ?? []).map((row) => [String(row.id), String(row.display_name ?? row.email ?? "Pengguna")]));

    const items = rows.map((row): MonitoringRpsItem => {
      const status = (Object.hasOwn(labels, String(row.status)) ? String(row.status) : "draft") as MonitoringRpsStatus;
      const curriculumCourse = row.curriculum_course_id ? curriculumById.get(String(row.curriculum_course_id)) : null;
      const legacyCourse = row.course_id ? legacyById.get(String(row.course_id)) : null;
      const course = curriculumCourse ?? legacyCourse;
      const validationSummary = asObject(row.validation_summary);
      return {
        id: String(row.id),
        code: course ? String(course.code) : "RPS",
        courseName: course ? String(course.name) : "Mata kuliah belum terhubung",
        owner: ownerById.get(String(row.created_by)) ?? "—",
        period: row.academic_period_id ? periodById.get(String(row.academic_period_id)) ?? "Periode belum ditemukan" : "Belum ditetapkan",
        version: Number(row.version ?? 1),
        status,
        statusLabel: labels[status],
        progress: progressByStatus[status],
        updatedAt: formatDate(row.updated_at),
        issues: issueCount(validationSummary),
        structuredData: asObject(row.structured_data),
        validationSummary,
      };
    });

    const counts = {
      draft: items.filter((item) => item.status === "draft").length,
      processing: items.filter((item) => ["queued", "parsing", "extracting"].includes(item.status)).length,
      review: items.filter((item) => item.status === "review").length,
      approved: items.filter((item) => item.status === "approved").length,
      failed: items.filter((item) => item.status === "failed").length,
    };

    return {
      ok: true,
      data: {
        currentStageKey,
        currentStageTitle,
        canCompose: currentStageKey === "rps-authoring",
        canEvaluate: currentStageKey === "teaching" || currentStageKey === "evaluation",
        items,
        counts,
      },
    };
  } catch (error) {
    console.error("Monitoring RPS failed", error instanceof Error ? error.message : "unknown_error");
    return { ok: false, message: error instanceof Error ? error.message : "Monitoring RPS tidak dapat dimuat." };
  }
}
