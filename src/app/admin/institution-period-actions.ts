"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_ORGANIZATION_SLUG = "informatika-undip";
const META_KEY = "academic_workspace_v1";
const STAGES = [
  ["assignment", "Penugasan pengajaran"],
  ["rps-authoring", "Penyusunan RPS"],
  ["gpm-review", "Review GPM"],
  ["head-approval", "Pengesahan Kaprodi"],
  ["teaching", "Pelaksanaan pengajaran"],
  ["evaluation", "Evaluasi & tindak lanjut"],
] as const;

export type AcademicStageConfig = {
  id: string;
  stage: string;
  title: string;
  startsAt: string;
  endsAt: string;
  locked: boolean;
};

export type AcademicPeriodConfig = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  dateLocked: boolean;
  stages: AcademicStageConfig[];
  classes: AcademicClassConfig[];
};

export type AcademicClassConfig = {
  id: string;
  courseCode: string;
  courseName: string;
  credits: number;
  className: string;
  lecturerIds: string[];
  lecturerNames: string[];
};

export type AcademicInstitutionConfig = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  protected: boolean;
  periods: AcademicPeriodConfig[];
  courses: Array<{ code: string; name: string; credits: number }>;
  lecturers: Array<{ id: string; name: string; email: string }>;
};

export type AcademicWorkspacePayload = {
  institutions: AcademicInstitutionConfig[];
  canManageInstitutions: boolean;
  canManagePeriods: boolean;
};

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true; message: string } | { ok: false; message: string }
  : { ok: true; message: string; data: T } | { ok: false; message: string };

type OrganizationRow = { id: string; name: string; slug: string; metadata: Record<string, unknown> | null };

type ActorContext = {
  userId: string;
  isSuperadmin: boolean;
  kaprodiOrganizationIds: Set<string>;
  admin: ReturnType<typeof getSupabaseAdmin>;
};

const fallbackCourses = [
  { code: "IF101", name: "Dasar Pemrograman", credits: 3 },
  { code: "IF210", name: "Struktur Data", credits: 3 },
  { code: "IF220", name: "Analisis Algoritma", credits: 3 },
  { code: "IF305", name: "Data Mining", credits: 3 },
  { code: "IF306", name: "Analitik Data", credits: 3 },
  { code: "IF402", name: "Etika Profesi", credits: 2 },
];

function defaultStages(periodId: string, startsAt: string, endsAt: string): AcademicStageConfig[] {
  const presets = [
    ["2026-07-20", "2026-08-03"],
    ["2026-08-01", "2026-08-20"],
    ["2026-08-10", "2026-08-25"],
    ["2026-08-18", "2026-08-29"],
    [startsAt, "2026-12-05"],
    ["2026-12-07", endsAt],
  ];
  return STAGES.map(([stage, title], index) => ({
    id: `${periodId}-${stage}`,
    stage,
    title,
    startsAt: presets[index]?.[0] ?? startsAt,
    endsAt: presets[index]?.[1] ?? endsAt,
    locked: false,
  }));
}

function defaultPeriods(): AcademicPeriodConfig[] {
  const gasalId = "period-2026-gasal";
  const genapId = "period-2026-genap";
  return [
    {
      id: gasalId,
      label: "Gasal 2026/2027",
      startsAt: "2026-08-17",
      endsAt: "2026-12-19",
      dateLocked: false,
      stages: defaultStages(gasalId, "2026-08-17", "2026-12-19"),
      classes: [
        { id: "class-if101-a", courseCode: "IF101", courseName: "Dasar Pemrograman", credits: 3, className: "A", lecturerIds: [], lecturerNames: ["Dr. Raka Pratama"] },
        { id: "class-if306-a", courseCode: "IF306", courseName: "Analitik Data", credits: 3, className: "A", lecturerIds: [], lecturerNames: ["Nadia Karim, M.Kom."] },
        { id: "class-if402-a", courseCode: "IF402", courseName: "Etika Profesi", credits: 2, className: "A", lecturerIds: [], lecturerNames: ["Arif Hidayat, M.Kom."] },
      ],
    },
    {
      id: genapId,
      label: "Genap 2026/2027",
      startsAt: "2027-02-01",
      endsAt: "2027-06-12",
      dateLocked: false,
      stages: defaultStages(genapId, "2027-02-01", "2027-06-12"),
      classes: [],
    },
  ];
}

function safeDate(value: unknown, fallback: string) {
  const text = typeof value === "string" ? value : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

function normalizePeriods(raw: unknown, useDefaults: boolean): AcademicPeriodConfig[] {
  if (!Array.isArray(raw)) return useDefaults ? defaultPeriods() : [];
  return raw.flatMap((item): AcademicPeriodConfig[] => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
    const label = typeof record.label === "string" ? record.label.trim().slice(0, 80) : "Periode";
    const startsAt = safeDate(record.startsAt, "2026-08-01");
    const endsAt = safeDate(record.endsAt, "2026-12-31");
    const rawStages = Array.isArray(record.stages) ? record.stages : defaultStages(id, startsAt, endsAt);
    const stages = STAGES.map(([stage, title], index) => {
      const candidate = rawStages.find((entry) => entry && typeof entry === "object" && !Array.isArray(entry) && (entry as Record<string, unknown>).stage === stage) as Record<string, unknown> | undefined;
      return {
        id: typeof candidate?.id === "string" ? candidate.id : `${id}-${stage}`,
        stage,
        title,
        startsAt: safeDate(candidate?.startsAt, index === 0 ? startsAt : startsAt),
        endsAt: safeDate(candidate?.endsAt, endsAt),
        locked: candidate?.locked === true,
      };
    });
    const classes = Array.isArray(record.classes) ? record.classes.flatMap((entry): AcademicClassConfig[] => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const row = entry as Record<string, unknown>;
      const courseCode = typeof row.courseCode === "string" ? row.courseCode.trim().toUpperCase() : "";
      const className = typeof row.className === "string" ? row.className.trim().toUpperCase() : "";
      if (!courseCode || !className) return [];
      return [{
        id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
        courseCode,
        courseName: typeof row.courseName === "string" ? row.courseName.trim() : courseCode,
        credits: Number.isFinite(Number(row.credits)) ? Number(row.credits) : 0,
        className,
        lecturerIds: Array.isArray(row.lecturerIds) ? row.lecturerIds.filter((value): value is string => typeof value === "string") : [],
        lecturerNames: Array.isArray(row.lecturerNames) ? row.lecturerNames.filter((value): value is string => typeof value === "string") : [],
      }];
    }) : [];
    return [{ id, label, startsAt, endsAt, dateLocked: record.dateLocked === true, stages, classes }];
  });
}

function academicMetadata(row: OrganizationRow) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const config = metadata[META_KEY];
  const periods = config && typeof config === "object" && !Array.isArray(config)
    ? normalizePeriods((config as Record<string, unknown>).periods, row.slug === DEFAULT_ORGANIZATION_SLUG)
    : normalizePeriods(undefined, row.slug === DEFAULT_ORGANIZATION_SLUG);
  return { metadata, periods };
}

async function requireActor(): Promise<ActorContext> {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) throw new Error("Sesi telah berakhir. Silakan masuk kembali.");
  const admin = getSupabaseAdmin();
  const [profileResult, platformResult, assignmentsResult] = await Promise.all([
    admin.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    admin.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
    admin.from("user_role_assignments").select("organization_id,role").eq("user_id", user.id),
  ]);
  if (profileResult.error || platformResult.error || assignmentsResult.error) throw new Error("Otorisasi tidak dapat diverifikasi.");
  if (profileResult.data?.status !== "active") throw new Error("Akun tidak aktif.");
  const isSuperadmin = platformResult.data?.role === "superadmin";
  const kaprodiOrganizationIds = new Set(
    (assignmentsResult.data ?? []).filter((row) => row.role === "kaprodi").map((row) => row.organization_id as string),
  );
  if (!isSuperadmin && !kaprodiOrganizationIds.size) throw new Error("Akses Institusi & Periode tidak tersedia.");
  return { userId: user.id, isSuperadmin, kaprodiOrganizationIds, admin };
}

function displayInstitutionName(row: OrganizationRow) {
  return row.slug === DEFAULT_ORGANIZATION_SLUG ? "S1 - Informatika UNDIP" : row.name;
}

async function listLecturers(context: ActorContext, organizationId: string) {
  const assignments = await context.admin.from("user_role_assignments").select("user_id").eq("organization_id", organizationId).eq("role", "dosen");
  if (assignments.error) throw assignments.error;
  const ids = [...new Set((assignments.data ?? []).map((row) => row.user_id as string))];
  if (!ids.length) return [];
  const profiles = await context.admin.from("profiles").select("id,email,display_name,status").in("id", ids).eq("status", "active");
  if (profiles.error) throw profiles.error;
  return (profiles.data ?? []).map((profile) => ({
    id: profile.id as string,
    name: String(profile.display_name ?? profile.email ?? "Dosen"),
    email: String(profile.email ?? ""),
  })).sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
}

async function listCourses(context: ActorContext, row: OrganizationRow) {
  const result = await context.admin.from("courses").select("code,name,credits").eq("organization_id", row.id).order("code");
  if (result.error) throw result.error;
  const courses = (result.data ?? []).map((course) => ({ code: String(course.code), name: String(course.name), credits: Number(course.credits ?? 0) }));
  return courses.length ? courses : row.slug === DEFAULT_ORGANIZATION_SLUG ? fallbackCourses : [];
}

async function getOrganization(context: ActorContext, institutionId: string): Promise<OrganizationRow> {
  if (!context.isSuperadmin && !context.kaprodiOrganizationIds.has(institutionId)) throw new Error("Institusi di luar lingkup akses.");
  const result = await context.admin.from("organizations").select("id,name,slug,metadata").eq("id", institutionId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Institusi tidak ditemukan.");
  return result.data as OrganizationRow;
}

async function persistPeriods(context: ActorContext, row: OrganizationRow, periods: AcademicPeriodConfig[]) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const nextMetadata = { ...metadata, [META_KEY]: { version: 1, periods } };
  const result = await context.admin.from("organizations").update({ metadata: nextMetadata }).eq("id", row.id);
  if (result.error) throw result.error;
  revalidatePath("/institusi-periode");
  revalidatePath("/dashboard");
}

function errorResult(error: unknown): { ok: false; message: string } {
  console.error("Academic workspace action failed", error instanceof Error ? error.message : "unknown_error");
  return { ok: false, message: error instanceof Error ? error.message : "Operasi gagal." };
}

export async function loadAcademicWorkspace(): Promise<ActionResult<AcademicWorkspacePayload>> {
  try {
    const context = await requireActor();
    let query = context.admin.from("organizations").select("id,name,slug,metadata").order("created_at");
    if (!context.isSuperadmin) query = query.in("id", [...context.kaprodiOrganizationIds]);
    const result = await query;
    if (result.error) throw result.error;
    const institutions = await Promise.all((result.data ?? []).map(async (raw) => {
      const row = raw as OrganizationRow;
      const { periods } = academicMetadata(row);
      const [courses, lecturers] = await Promise.all([listCourses(context, row), listLecturers(context, row.id)]);
      return {
        id: row.id,
        name: row.name,
        displayName: displayInstitutionName(row),
        slug: row.slug,
        protected: row.slug === DEFAULT_ORGANIZATION_SLUG,
        periods,
        courses,
        lecturers,
      } satisfies AcademicInstitutionConfig;
    }));
    institutions.sort((a, b) => Number(b.protected) - Number(a.protected) || a.displayName.localeCompare(b.displayName, "id-ID"));
    return { ok: true, message: "Konteks akademik dimuat.", data: { institutions, canManageInstitutions: context.isSuperadmin, canManagePeriods: context.isSuperadmin } };
  } catch (error) {
    return errorResult(error);
  }
}

function slugify(name: string) {
  return name.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 45);
}

export async function createAcademicInstitution(input: { name: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    if (!context.isSuperadmin) throw new Error("Hanya Superadmin yang dapat menambah institusi.");
    const name = input.name.trim().replace(/\s+/g, " ");
    if (name.length < 3 || name.length > 120) throw new Error("Nama institusi harus 3–120 karakter.");
    const base = slugify(name) || "institusi";
    const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    const result = await context.admin.from("organizations").insert({ name, slug, metadata: { [META_KEY]: { version: 1, periods: [] } } });
    if (result.error) throw result.error;
    revalidatePath("/institusi-periode");
    return { ok: true, message: "Institusi baru berhasil ditambahkan." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteAcademicInstitution(input: { institutionId: string; confirmationName: string; finalToken: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    if (!context.isSuperadmin) throw new Error("Hanya Superadmin yang dapat menghapus institusi.");
    const row = await getOrganization(context, input.institutionId);
    if (row.slug === DEFAULT_ORGANIZATION_SLUG) throw new Error("S1 - Informatika UNDIP dikunci karena menjadi institusi utama untuk Pengguna & Akses. Buat institusi lain tanpa menghapus baseline ini.");
    if (input.confirmationName.trim() !== row.name || input.finalToken.trim().toUpperCase() !== "HAPUS") {
      throw new Error("Konfirmasi ganda belum sesuai. Ketik nama institusi persis dan token HAPUS.");
    }
    const result = await context.admin.from("organizations").delete().eq("id", row.id);
    if (result.error) throw result.error;
    revalidatePath("/institusi-periode");
    return { ok: true, message: "Institusi berhasil dihapus setelah konfirmasi ganda." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function createAcademicPeriod(input: { institutionId: string; label: string; startsAt: string; endsAt: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    if (!context.isSuperadmin) throw new Error("Hanya Superadmin yang dapat membuat periode.");
    const row = await getOrganization(context, input.institutionId);
    const { periods } = academicMetadata(row);
    const label = input.label.trim().replace(/\s+/g, " ");
    const startsAt = safeDate(input.startsAt, "");
    const endsAt = safeDate(input.endsAt, "");
    if (label.length < 3 || label.length > 80) throw new Error("Nama periode harus 3–80 karakter.");
    if (!startsAt || !endsAt || startsAt > endsAt) throw new Error("Rentang tanggal periode tidak valid.");
    if (periods.some((period) => period.label.toLocaleLowerCase("id-ID") === label.toLocaleLowerCase("id-ID"))) throw new Error("Nama periode sudah digunakan pada institusi ini.");
    const id = `period-${crypto.randomUUID()}`;
    periods.push({ id, label, startsAt, endsAt, dateLocked: false, stages: defaultStages(id, startsAt, endsAt), classes: [] });
    await persistPeriods(context, row, periods);
    return { ok: true, message: "Periode baru berhasil dibuat." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveAcademicSchedule(input: {
  institutionId: string;
  periodId: string;
  startsAt: string;
  endsAt: string;
  dateLocked: boolean;
  stages: Array<{ stage: string; startsAt: string; endsAt: string; locked: boolean }>;
}): Promise<ActionResult> {
  try {
    const context = await requireActor();
    if (!context.isSuperadmin) throw new Error("Hanya Superadmin yang dapat mengatur dan mengunci tanggal.");
    const row = await getOrganization(context, input.institutionId);
    const { periods } = academicMetadata(row);
    const period = periods.find((item) => item.id === input.periodId);
    if (!period) throw new Error("Periode tidak ditemukan.");
    const nextStart = safeDate(input.startsAt, "");
    const nextEnd = safeDate(input.endsAt, "");
    if (!nextStart || !nextEnd || nextStart > nextEnd) throw new Error("Rentang tanggal periode tidak valid.");

    if (period.dateLocked) {
      const changed = nextStart !== period.startsAt || nextEnd !== period.endsAt || input.stages.some((stage) => {
        const current = period.stages.find((item) => item.stage === stage.stage);
        return current && (stage.startsAt !== current.startsAt || stage.endsAt !== current.endsAt);
      });
      if (changed) throw new Error("Tanggal periode sedang dikunci. Buka kunci terlebih dahulu, simpan, lalu ubah tanggal.");
    }

    const nextStages = period.stages.map((current) => {
      const incoming = input.stages.find((stage) => stage.stage === current.stage);
      if (!incoming) return current;
      const startsAt = safeDate(incoming.startsAt, current.startsAt);
      const endsAt = safeDate(incoming.endsAt, current.endsAt);
      if (startsAt > endsAt) throw new Error(`Rentang tanggal ${current.title} tidak valid.`);
      if (current.locked && (startsAt !== current.startsAt || endsAt !== current.endsAt)) {
        throw new Error(`${current.title} sedang dikunci. Buka kunci terlebih dahulu.`);
      }
      return { ...current, startsAt, endsAt, locked: Boolean(incoming.locked) };
    });

    period.startsAt = nextStart;
    period.endsAt = nextEnd;
    period.dateLocked = Boolean(input.dateLocked);
    period.stages = nextStages;
    await persistPeriods(context, row, periods);
    return { ok: true, message: period.dateLocked ? "Tanggal periode disimpan dan dikunci." : "Pengaturan tanggal berhasil disimpan." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function upsertAcademicClass(input: {
  institutionId: string;
  periodId: string;
  classId?: string;
  courseCode: string;
  className: string;
  lecturerIds: string[];
}): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const row = await getOrganization(context, input.institutionId);
    if (!context.isSuperadmin && !context.kaprodiOrganizationIds.has(row.id)) throw new Error("Hanya Superadmin atau Kaprodi pada institusi ini yang dapat memetakan kelas.");
    const { periods } = academicMetadata(row);
    const period = periods.find((item) => item.id === input.periodId);
    if (!period) throw new Error("Pilih periode sebelum memetakan kelas.");
    const courses = await listCourses(context, row);
    const courseCode = input.courseCode.trim().toUpperCase();
    const course = courses.find((item) => item.code.toUpperCase() === courseCode);
    if (!course) throw new Error("Mata kuliah tidak tersedia pada institusi ini.");
    const className = input.className.trim().toUpperCase().replace(/\s+/g, " ");
    if (!className || className.length > 30) throw new Error("Nama kelas wajib diisi dan maksimal 30 karakter.");
    const lecturers = await listLecturers(context, row.id);
    const allowedLecturers = new Map(lecturers.map((lecturer) => [lecturer.id, lecturer]));
    const lecturerIds = [...new Set(input.lecturerIds)].filter((id) => allowedLecturers.has(id));
    if (!lecturerIds.length) throw new Error("Pilih minimal satu pengampu aktif.");
    const duplicate = period.classes.find((item) => item.courseCode === course.code && item.className === className && item.id !== input.classId);
    if (duplicate) throw new Error("Kelas tersebut sudah ada untuk mata kuliah dan periode ini.");
    const next: AcademicClassConfig = {
      id: input.classId || `class-${crypto.randomUUID()}`,
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
      className,
      lecturerIds,
      lecturerNames: lecturerIds.map((id) => allowedLecturers.get(id)!.name),
    };
    const index = period.classes.findIndex((item) => item.id === next.id);
    if (index >= 0) period.classes[index] = next;
    else period.classes.push(next);
    period.classes.sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.className.localeCompare(b.className));
    await persistPeriods(context, row, periods);
    return { ok: true, message: index >= 0 ? "Pemetaan kelas diperbarui." : "Kelas dan pengampu berhasil ditambahkan." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteAcademicClass(input: { institutionId: string; periodId: string; classId: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const row = await getOrganization(context, input.institutionId);
    const { periods } = academicMetadata(row);
    const period = periods.find((item) => item.id === input.periodId);
    if (!period) throw new Error("Periode tidak ditemukan.");
    if (!context.isSuperadmin && !context.kaprodiOrganizationIds.has(row.id)) throw new Error("Anda tidak dapat menghapus pemetaan kelas ini.");
    const before = period.classes.length;
    period.classes = period.classes.filter((item) => item.id !== input.classId);
    if (period.classes.length === before) throw new Error("Kelas tidak ditemukan.");
    await persistPeriods(context, row, periods);
    return { ok: true, message: "Pemetaan kelas dihapus." };
  } catch (error) {
    return errorResult(error);
  }
}
