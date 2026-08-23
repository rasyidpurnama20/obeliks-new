"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_ORGANIZATION_SLUG = "informatika-undip";

export type CurriculumCourseView = {
  id: string;
  code: string;
  name: string;
  credits: number;
  semester: number | null;
  groupName: string | null;
  cloCount: number;
  mappedPloCount: number;
};

export type CurriculumView = {
  id: string;
  code: string;
  name: string;
  status: "draft" | "active" | "retired";
  startYear: number | null;
  graduateProfileCount: number;
  ploCount: number;
  knowledgeGroupCount: number;
  courses: CurriculumCourseView[];
};

export type PeriodView = {
  id: string;
  label: string;
  term: string;
  academicYear: string;
  startsAt: string;
  endsAt: string;
  status: "draft" | "active" | "closed";
  lateModificationUntil: string | null;
  curriculumId: string | null;
  curriculumName: string | null;
  currentStage: string | null;
};

export type ProgramView = {
  id: string;
  organizationId: string;
  universityName: string;
  facultyName: string;
  departmentName: string;
  programName: string;
  programCode: string | null;
  protected: boolean;
  curricula: CurriculumView[];
  periods: PeriodView[];
};

export type AcademicWorkspacePayload = {
  programs: ProgramView[];
  canManageInstitutions: boolean;
  canSetActivePeriod: boolean;
  canManageAcademicData: boolean;
};

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true; message: string } | { ok: false; message: string }
  : { ok: true; message: string; data: T } | { ok: false; message: string };

type Actor = {
  userId: string;
  isSuperadmin: boolean;
  kaprodiOrganizationIds: Set<string>;
  admin: ReturnType<typeof getSupabaseAdmin>;
};

function fail(error: unknown): { ok: false; message: string } {
  console.error("Academic context action failed", error instanceof Error ? error.message : "unknown_error");
  return { ok: false, message: error instanceof Error ? error.message : "Operasi tidak dapat diselesaikan." };
}

function clean(value: string, max = 160) {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function slugify(value: string) {
  return value.toLocaleLowerCase("id-ID").normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function jakartaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function requireActor(): Promise<Actor> {
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) throw new Error("Sesi telah berakhir. Silakan masuk kembali.");
  const admin = getSupabaseAdmin();
  const [profile, platformRole, assignments] = await Promise.all([
    admin.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    admin.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
    admin.from("user_role_assignments").select("organization_id,role").eq("user_id", user.id),
  ]);
  if (profile.error || platformRole.error || assignments.error) throw new Error("Otorisasi tidak dapat diverifikasi.");
  if (profile.data?.status !== "active") throw new Error("Akun tidak aktif.");
  const isSuperadmin = platformRole.data?.role === "superadmin";
  const kaprodiOrganizationIds = new Set(
    (assignments.data ?? []).filter((row) => row.role === "kaprodi").map((row) => String(row.organization_id)),
  );
  if (!isSuperadmin && !kaprodiOrganizationIds.size) throw new Error("Akses Institusi & Periode tidak tersedia.");
  return { userId: user.id, isSuperadmin, kaprodiOrganizationIds, admin };
}

function assertProgramScope(actor: Actor, organizationId: string) {
  if (!actor.isSuperadmin && !actor.kaprodiOrganizationIds.has(organizationId)) {
    throw new Error("Program studi berada di luar lingkup akses Anda.");
  }
}

async function readPrograms(actor: Actor): Promise<ProgramView[]> {
  let query = actor.admin
    .from("academic_programs")
    .select("id,organization_id,university_name,faculty_name,department_name,program_name,program_code,organizations!inner(slug)")
    .eq("is_enabled", true)
    .order("university_name")
    .order("program_name");
  if (!actor.isSuperadmin) query = query.in("organization_id", [...actor.kaprodiOrganizationIds]);
  const programResult = await query;
  if (programResult.error) throw programResult.error;
  const programs = programResult.data ?? [];
  if (!programs.length) return [];
  const programIds = programs.map((row) => String(row.id));

  const [curriculaResult, profilesResult, plosResult, groupsResult, coursesResult, closResult, mappingsResult, periodsResult, stagesResult] = await Promise.all([
    actor.admin.from("curricula").select("id,academic_program_id,code,name,status,start_year").in("academic_program_id", programIds).order("created_at"),
    actor.admin.from("graduate_profiles").select("id,curriculum_id").in("curriculum_id", []),
    actor.admin.from("program_learning_outcomes").select("id,curriculum_id").in("curriculum_id", []),
    actor.admin.from("knowledge_groups").select("id,curriculum_id,name").in("curriculum_id", []),
    Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    actor.admin.from("academic_periods").select("id,academic_program_id,primary_curriculum_id,label,term,academic_year,starts_at,ends_at,status,late_modification_until").in("academic_program_id", programIds).order("starts_at", { ascending: false }),
    Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
  ]);
  if (curriculaResult.error || periodsResult.error) throw curriculaResult.error ?? periodsResult.error;

  const curriculumIds = (curriculaResult.data ?? []).map((row) => String(row.id));
  let profileRows: Array<Record<string, unknown>> = [];
  let ploRows: Array<Record<string, unknown>> = [];
  let groupRows: Array<Record<string, unknown>> = [];
  let courseRows: Array<Record<string, unknown>> = [];
  let cloRows: Array<Record<string, unknown>> = [];
  let mappingRows: Array<Record<string, unknown>> = [];
  if (curriculumIds.length) {
    const [p,g,k,c] = await Promise.all([
      actor.admin.from("graduate_profiles").select("id,curriculum_id").in("curriculum_id", curriculumIds),
      actor.admin.from("program_learning_outcomes").select("id,curriculum_id").in("curriculum_id", curriculumIds),
      actor.admin.from("knowledge_groups").select("id,curriculum_id,name").in("curriculum_id", curriculumIds),
      actor.admin.from("curriculum_courses").select("id,curriculum_id,knowledge_group_id,code,name,credits,recommended_semester").in("curriculum_id", curriculumIds).order("code"),
    ]);
    if (p.error || g.error || k.error || c.error) throw p.error ?? g.error ?? k.error ?? c.error;
    profileRows = p.data ?? [];
    ploRows = g.data ?? [];
    groupRows = k.data ?? [];
    courseRows = c.data ?? [];
    const courseIds = courseRows.map((row) => String(row.id));
    if (courseIds.length) {
      const clos = await actor.admin.from("course_learning_outcomes").select("id,curriculum_course_id").in("curriculum_course_id", courseIds);
      if (clos.error) throw clos.error;
      cloRows = clos.data ?? [];
      const cloIds = cloRows.map((row) => String(row.id));
      if (cloIds.length) {
        const mappings = await actor.admin.from("clo_plo_mappings").select("clo_id,plo_id").in("clo_id", cloIds);
        if (mappings.error) throw mappings.error;
        mappingRows = mappings.data ?? [];
      }
    }
  }

  const periodRows = periodsResult.data ?? [];
  const periodIds = periodRows.map((row) => String(row.id));
  let stageRows: Array<Record<string, unknown>> = [];
  if (periodIds.length) {
    const stages = await actor.admin.from("academic_stages").select("academic_period_id,title,starts_at,ends_at,sort_order").in("academic_period_id", periodIds).order("sort_order");
    if (stages.error) throw stages.error;
    stageRows = stages.data ?? [];
  }
  const today = jakartaToday();
  const curriculumNameById = new Map((curriculaResult.data ?? []).map((row) => [String(row.id), String(row.name)]));
  const groupNameById = new Map(groupRows.map((row) => [String(row.id), String(row.name)]));
  const cloByCourse = new Map<string,string[]>();
  for (const row of cloRows) {
    const key = String(row.curriculum_course_id);
    const next = cloByCourse.get(key) ?? [];
    next.push(String(row.id));
    cloByCourse.set(key, next);
  }
  const mappedPloByClo = new Map<string,Set<string>>();
  for (const row of mappingRows) {
    const key = String(row.clo_id);
    const set = mappedPloByClo.get(key) ?? new Set<string>();
    set.add(String(row.plo_id));
    mappedPloByClo.set(key, set);
  }

  return programs.map((program) => {
    const programId = String(program.id);
    const curricula = (curriculaResult.data ?? []).filter((row) => String(row.academic_program_id) === programId).map((row): CurriculumView => {
      const curriculumId = String(row.id);
      const courses = courseRows.filter((course) => String(course.curriculum_id) === curriculumId).map((course): CurriculumCourseView => {
        const courseId = String(course.id);
        const cloIds = cloByCourse.get(courseId) ?? [];
        const mappedPloCount = new Set(cloIds.flatMap((cloId) => [...(mappedPloByClo.get(cloId) ?? new Set<string>())])).size;
        return {
          id: courseId,
          code: String(course.code),
          name: String(course.name),
          credits: Number(course.credits ?? 0),
          semester: course.recommended_semester == null ? null : Number(course.recommended_semester),
          groupName: course.knowledge_group_id ? groupNameById.get(String(course.knowledge_group_id)) ?? null : null,
          cloCount: cloIds.length,
          mappedPloCount,
        };
      });
      return {
        id: curriculumId,
        code: String(row.code),
        name: String(row.name),
        status: row.status as CurriculumView["status"],
        startYear: row.start_year == null ? null : Number(row.start_year),
        graduateProfileCount: profileRows.filter((item) => String(item.curriculum_id) === curriculumId).length,
        ploCount: ploRows.filter((item) => String(item.curriculum_id) === curriculumId).length,
        knowledgeGroupCount: groupRows.filter((item) => String(item.curriculum_id) === curriculumId).length,
        courses,
      };
    });
    const periods = periodRows.filter((row) => String(row.academic_program_id) === programId).map((row): PeriodView => {
      const periodId = String(row.id);
      const stage = stageRows.find((item) => String(item.academic_period_id) === periodId && String(item.starts_at) <= today && String(item.ends_at) >= today);
      return {
        id: periodId,
        label: String(row.label),
        term: String(row.term),
        academicYear: String(row.academic_year),
        startsAt: String(row.starts_at),
        endsAt: String(row.ends_at),
        status: row.status as PeriodView["status"],
        lateModificationUntil: row.late_modification_until ? String(row.late_modification_until) : null,
        curriculumId: row.primary_curriculum_id ? String(row.primary_curriculum_id) : null,
        curriculumName: row.primary_curriculum_id ? curriculumNameById.get(String(row.primary_curriculum_id)) ?? null : null,
        currentStage: stage ? String(stage.title) : null,
      };
    });
    const organization = Array.isArray(program.organizations) ? program.organizations[0] : program.organizations;
    return {
      id: programId,
      organizationId: String(program.organization_id),
      universityName: String(program.university_name),
      facultyName: String(program.faculty_name),
      departmentName: String(program.department_name),
      programName: String(program.program_name),
      programCode: program.program_code ? String(program.program_code) : null,
      protected: Boolean(organization && typeof organization === "object" && "slug" in organization && organization.slug === DEFAULT_ORGANIZATION_SLUG),
      curricula,
      periods,
    };
  });
}

export async function loadAcademicWorkspace(): Promise<ActionResult<AcademicWorkspacePayload>> {
  try {
    const actor = await requireActor();
    const programs = await readPrograms(actor);
    return { ok: true, message: "Konteks akademik dimuat.", data: {
      programs,
      canManageInstitutions: actor.isSuperadmin,
      canSetActivePeriod: actor.isSuperadmin,
      canManageAcademicData: actor.isSuperadmin || actor.kaprodiOrganizationIds.size > 0,
    } };
  } catch (error) { return fail(error); }
}

export async function createAcademicInstitution(input: {
  universityName: string;
  facultyName: string;
  departmentName: string;
  programName: string;
  programCode?: string;
}): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    if (!actor.isSuperadmin) throw new Error("Hanya Superadmin yang dapat mengelola institusi.");
    const universityName = clean(input.universityName);
    const facultyName = clean(input.facultyName);
    const departmentName = clean(input.departmentName);
    const programName = clean(input.programName);
    const programCode = clean(input.programCode ?? "", 40) || null;
    if ([universityName,facultyName,departmentName,programName].some((value) => value.length < 2)) throw new Error("Semua tingkat institusi wajib diisi.");
    const slugBase = slugify(`${programName}-${universityName}`) || "program-studi";
    const organization = await actor.admin.from("organizations").insert({
      name: `${programName} · ${universityName}`,
      slug: `${slugBase}-${crypto.randomUUID().slice(0,8)}`,
      metadata: { scope: "program_study" },
    }).select("id").single();
    if (organization.error) throw organization.error;
    const program = await actor.admin.from("academic_programs").insert({
      organization_id: organization.data.id,
      university_name: universityName,
      faculty_name: facultyName,
      department_name: departmentName,
      program_name: programName,
      program_code: programCode,
    });
    if (program.error) {
      await actor.admin.from("organizations").delete().eq("id", organization.data.id);
      throw program.error;
    }
    revalidatePath("/institusi-periode");
    return { ok: true, message: "Program studi berhasil dibuat." };
  } catch (error) { return fail(error); }
}

export async function deleteAcademicInstitution(input: { programId: string; confirmation: string; finalToken: string }): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    if (!actor.isSuperadmin) throw new Error("Hanya Superadmin yang dapat menghapus institusi.");
    const result = await actor.admin.from("academic_programs").select("id,organization_id,program_name,organizations!inner(slug)").eq("id", input.programId).maybeSingle();
    if (result.error || !result.data) throw result.error ?? new Error("Program studi tidak ditemukan.");
    const organization = Array.isArray(result.data.organizations) ? result.data.organizations[0] : result.data.organizations;
    if (organization && typeof organization === "object" && "slug" in organization && organization.slug === DEFAULT_ORGANIZATION_SLUG) throw new Error("Tenant utama Pengguna & Akses tidak dapat dihapus.");
    if (clean(input.confirmation) !== String(result.data.program_name) || input.finalToken.trim().toUpperCase() !== "HAPUS") throw new Error("Konfirmasi ganda belum sesuai.");
    const deletion = await actor.admin.from("organizations").delete().eq("id", result.data.organization_id);
    if (deletion.error) throw deletion.error;
    revalidatePath("/institusi-periode");
    return { ok: true, message: "Program studi dan seluruh konteks akademiknya dihapus." };
  } catch (error) { return fail(error); }
}

export async function createCurriculum(input: { programId: string; code: string; name: string; startYear?: number | null }): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    const program = await actor.admin.from("academic_programs").select("id,organization_id").eq("id", input.programId).maybeSingle();
    if (program.error || !program.data) throw program.error ?? new Error("Program studi tidak ditemukan.");
    assertProgramScope(actor, String(program.data.organization_id));
    const code = clean(input.code, 40).toUpperCase();
    const name = clean(input.name, 120);
    if (code.length < 2 || name.length < 3) throw new Error("Kode dan nama kurikulum wajib diisi.");
    const insert = await actor.admin.from("curricula").insert({ academic_program_id: input.programId, code, name, start_year: input.startYear ?? null, status: "draft" });
    if (insert.error) throw insert.error;
    revalidatePath("/institusi-periode");
    return { ok: true, message: "Kurikulum draft berhasil dibuat." };
  } catch (error) { return fail(error); }
}

export async function createAcademicPeriod(input: {
  programId: string;
  direction: "previous" | "next";
  label: string;
  term: "Gasal" | "Genap" | "Pendek" | "Lainnya";
  academicYear: string;
  startsAt: string;
  endsAt: string;
  curriculumId?: string | null;
}): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    const program = await actor.admin.from("academic_programs").select("id,organization_id").eq("id", input.programId).maybeSingle();
    if (program.error || !program.data) throw program.error ?? new Error("Program studi tidak ditemukan.");
    assertProgramScope(actor, String(program.data.organization_id));
    const label = clean(input.label, 80);
    if (label.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(input.startsAt) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endsAt) || input.startsAt > input.endsAt) throw new Error("Data periode belum valid.");
    if (input.curriculumId) {
      const curriculum = await actor.admin.from("curricula").select("id").eq("id", input.curriculumId).eq("academic_program_id", input.programId).maybeSingle();
      if (curriculum.error || !curriculum.data) throw new Error("Kurikulum tidak tersedia pada program studi ini.");
    }
    const status = input.direction === "next" ? "draft" : "closed";
    const insert = await actor.admin.from("academic_periods").insert({
      academic_program_id: input.programId,
      primary_curriculum_id: input.curriculumId ?? null,
      label,
      term: input.term,
      academic_year: clean(input.academicYear, 20),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      status,
      late_modification_until: input.direction === "previous" ? input.endsAt : null,
      created_by: actor.userId,
    });
    if (insert.error) throw insert.error;
    revalidatePath("/institusi-periode");
    return { ok: true, message: input.direction === "next" ? "Periode berikutnya dibuat sebagai Draft." : "Periode sebelumnya berhasil ditambahkan." };
  } catch (error) { return fail(error); }
}

export async function setActiveAcademicPeriod(input: { programId: string; periodId: string; curriculumId: string }): Promise<ActionResult> {
  try {
    const actor = await requireActor();
    if (!actor.isSuperadmin) throw new Error("Hanya Superadmin yang dapat menetapkan Periode Aktif.");
    const program = await actor.admin.from("academic_programs").select("id,organization_id").eq("id", input.programId).maybeSingle();
    if (program.error || !program.data) throw program.error ?? new Error("Program studi tidak ditemukan.");
    const curriculum = await actor.admin.from("curricula").select("id").eq("id", input.curriculumId).eq("academic_program_id", input.programId).maybeSingle();
    if (curriculum.error || !curriculum.data) throw new Error("Kurikulum tidak valid untuk program studi ini.");
    const period = await actor.admin.from("academic_periods").select("id,status").eq("id", input.periodId).eq("academic_program_id", input.programId).maybeSingle();
    if (period.error || !period.data) throw new Error("Periode tidak ditemukan.");
    const today = jakartaToday();
    const closeOld = await actor.admin.from("academic_periods").update({ status: "closed", late_modification_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10) }).eq("academic_program_id", input.programId).eq("status", "active").neq("id", input.periodId);
    if (closeOld.error) throw closeOld.error;
    const activate = await actor.admin.from("academic_periods").update({ status: "active", primary_curriculum_id: input.curriculumId, late_modification_until: null }).eq("id", input.periodId);
    if (activate.error) throw activate.error;
    await actor.admin.from("curricula").update({ status: "retired" }).eq("academic_program_id", input.programId).eq("status", "active").neq("id", input.curriculumId);
    await actor.admin.from("curricula").update({ status: "active" }).eq("id", input.curriculumId);
    await actor.admin.from("audit_logs").insert({ actor_user_id: actor.userId, action: "academic.active_period_set", metadata: { program_id: input.programId, period_id: input.periodId, curriculum_id: input.curriculumId, effective_date: today } });
    revalidatePath("/institusi-periode");
    revalidatePath("/monitoring-rps");
    return { ok: true, message: "Periode Aktif dan kurikulum utama berhasil ditetapkan." };
  } catch (error) { return fail(error); }
}
