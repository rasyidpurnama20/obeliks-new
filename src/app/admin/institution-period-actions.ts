"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_ORGANIZATION_SLUG = "informatika-undip";
const PERIOD_STAGES = [
  { key: "assignment", title: "Penugasan pengajaran", roles: ["admin", "kaprodi"] },
  { key: "rps-authoring", title: "Penyusunan RPS", roles: ["admin", "dosen"] },
  { key: "gpm-review", title: "Review GPM", roles: ["admin", "gpm"] },
  { key: "head-approval", title: "Pengesahan Kaprodi", roles: ["admin", "kaprodi"] },
  { key: "teaching", title: "Pelaksanaan pengajaran", roles: ["admin", "dosen", "mahasiswa"] },
  { key: "evaluation", title: "Evaluasi & tindak lanjut", roles: ["admin", "kaprodi", "gpm", "dosen"] },
] as const;

type PeriodStatus = "draft" | "active" | "closed";
type CurriculumStatus = "draft" | "active" | "retired";
type ModificationMode = "full" | "late" | "readonly";

type ActionResult<T = undefined> = T extends undefined
  ? { ok: true; message: string } | { ok: false; message: string }
  : { ok: true; message: string; data: T } | { ok: false; message: string };

export type AcademicStageConfig = {
  id: string;
  stageKey: string;
  title: string;
  startsAt: string;
  endsAt: string;
  accessRoles: string[];
  sortOrder: number;
};

export type AcademicPeriodConfig = {
  id: string;
  label: string;
  term: string;
  academicYear: string;
  startsAt: string;
  endsAt: string;
  status: PeriodStatus;
  lateModificationUntil: string | null;
  primaryCurriculumId: string | null;
  stages: AcademicStageConfig[];
  canModify: boolean;
  modificationMode: ModificationMode;
};

export type GraduateProfileConfig = {
  id: string;
  code: string;
  description: string;
  sortOrder: number;
};

export type PloConfig = {
  id: string;
  code: string;
  description: string;
  sortOrder: number;
};

export type KnowledgeGroupConfig = {
  id: string;
  code: string;
  name: string;
  description: string;
  sortOrder: number;
};

export type CloConfig = {
  id: string;
  code: string;
  description: string;
  sortOrder: number;
  ploIds: string[];
};

export type CurriculumCourseConfig = {
  id: string;
  curriculumId: string;
  curriculumCode: string;
  curriculumName: string;
  knowledgeGroupId: string | null;
  knowledgeGroupCode: string | null;
  code: string;
  name: string;
  credits: number;
  recommendedSemester: number | null;
  description: string;
  isAvailableForReoffer: boolean;
  clos: CloConfig[];
};

export type CurriculumConfig = {
  id: string;
  code: string;
  name: string;
  startYear: number | null;
  status: CurriculumStatus;
  notes: string;
  graduateProfiles: GraduateProfileConfig[];
  plos: PloConfig[];
  knowledgeGroups: KnowledgeGroupConfig[];
  courses: CurriculumCourseConfig[];
};

export type AcademicClassConfig = {
  id: string;
  periodId: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  credits: number;
  curriculumId: string;
  curriculumCode: string;
  curriculumName: string;
  sectionNumber: number;
  className: string;
  lecturerIds: string[];
  lecturerNames: string[];
};

export type AcademicProgramConfig = {
  id: string;
  organizationId: string;
  universityName: string;
  facultyName: string;
  departmentName: string;
  programName: string;
  programCode: string;
  displayName: string;
  protected: boolean;
  isEnabled: boolean;
  periods: AcademicPeriodConfig[];
  curricula: CurriculumConfig[];
  classes: AcademicClassConfig[];
  lecturers: Array<{ id: string; name: string; email: string }>;
};

export type AcademicWorkspacePayload = {
  programs: AcademicProgramConfig[];
  canManageInstitutions: boolean;
  canSetActivePeriod: boolean;
  canCreatePeriods: boolean;
};

type ActorContext = {
  userId: string;
  isSuperadmin: boolean;
  kaprodiOrganizationIds: Set<string>;
  admin: ReturnType<typeof getSupabaseAdmin>;
};

type ProgramRow = {
  id: string;
  organization_id: string;
  university_name: string;
  faculty_name: string;
  department_name: string;
  program_name: string;
  program_code: string | null;
  is_enabled: boolean;
};

function cleanText(value: unknown, label: string, min = 2, max = 160) {
  const text = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (text.length < min || text.length > max) throw new Error(`${label} harus ${min}–${max} karakter.`);
  return text;
}

function cleanCode(value: unknown, label: string, max = 40) {
  const code = typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "-") : "";
  if (!code || code.length > max || !/^[A-Z0-9._/-]+$/.test(code)) throw new Error(`${label} tidak valid.`);
  return code;
}

function cleanDate(value: unknown, label: string) {
  const text = typeof value === "string" ? value : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${label} tidak valid.`);
  return text;
}

function dateShift(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sectionLabel(sectionNumber: number) {
  let n = Math.max(1, Math.trunc(sectionNumber));
  let label = "";
  while (n > 0) {
    n -= 1;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

function slugify(value: string) {
  return value.toLocaleLowerCase("id-ID").normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function periodModificationMode(context: ActorContext, period: { status: string; late_modification_until?: string | null }): ModificationMode {
  if (context.isSuperadmin) return "full";
  if (period.status === "active" || period.status === "draft") return "full";
  if (period.status === "closed" && period.late_modification_until && period.late_modification_until >= todayIso()) return "late";
  return "readonly";
}

function revalidateAcademic() {
  revalidatePath("/institusi-periode");
  revalidatePath("/institusi-periode/kelola-institusi");
  revalidatePath("/institusi-periode/set-periode-aktif");
  revalidatePath("/dashboard");
}

function errorResult(error: unknown): { ok: false; message: string } {
  const message = error instanceof Error ? error.message : "Operasi gagal.";
  console.error("Academic context action failed", message);
  return { ok: false, message };
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
    (assignmentsResult.data ?? []).filter((row) => row.role === "kaprodi").map((row) => String(row.organization_id)),
  );
  if (!isSuperadmin && !kaprodiOrganizationIds.size) throw new Error("Akses Institusi & Periode tidak tersedia.");
  return { userId: user.id, isSuperadmin, kaprodiOrganizationIds, admin };
}

async function getProgram(context: ActorContext, programId: string): Promise<ProgramRow> {
  const result = await context.admin.from("academic_programs")
    .select("id,organization_id,university_name,faculty_name,department_name,program_name,program_code,is_enabled")
    .eq("id", programId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Program studi tidak ditemukan.");
  const row = result.data as ProgramRow;
  if (!context.isSuperadmin && !context.kaprodiOrganizationIds.has(row.organization_id)) {
    throw new Error("Program studi berada di luar lingkup akses.");
  }
  return row;
}

async function getCurriculum(context: ActorContext, curriculumId: string) {
  const result = await context.admin.from("curricula")
    .select("id,academic_program_id,code,name,status")
    .eq("id", curriculumId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Kurikulum tidak ditemukan.");
  const program = await getProgram(context, String(result.data.academic_program_id));
  return { row: result.data, program };
}

async function getCourse(context: ActorContext, courseId: string) {
  const result = await context.admin.from("curriculum_courses")
    .select("id,curriculum_id,code,name,is_available_for_reoffer")
    .eq("id", courseId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Mata kuliah tidak ditemukan.");
  const curriculum = await getCurriculum(context, String(result.data.curriculum_id));
  return { row: result.data, curriculum };
}

async function getPeriod(context: ActorContext, periodId: string) {
  const result = await context.admin.from("academic_periods")
    .select("id,academic_program_id,primary_curriculum_id,label,term,academic_year,starts_at,ends_at,status,late_modification_until")
    .eq("id", periodId).maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Periode tidak ditemukan.");
  const program = await getProgram(context, String(result.data.academic_program_id));
  return { row: result.data, program };
}

function requireProgramEditor(context: ActorContext, program: ProgramRow) {
  if (!context.isSuperadmin && !context.kaprodiOrganizationIds.has(program.organization_id)) {
    throw new Error("Hanya Superadmin atau Kaprodi program studi ini yang dapat mengubah data akademik.");
  }
}

function requirePeriodEditor(context: ActorContext, period: { status: string; late_modification_until?: string | null }) {
  const mode = periodModificationMode(context, period);
  if (mode === "readonly") throw new Error("Periode sebelumnya hanya dapat diubah selama jendela late modification masih berlaku.");
  return mode;
}

async function listLecturers(context: ActorContext, organizationId: string) {
  const assignments = await context.admin.from("user_role_assignments")
    .select("user_id").eq("organization_id", organizationId).eq("role", "dosen");
  if (assignments.error) throw assignments.error;
  const ids = [...new Set((assignments.data ?? []).map((row) => String(row.user_id)))];
  if (!ids.length) return [];
  const profiles = await context.admin.from("profiles")
    .select("id,email,display_name,status").in("id", ids).eq("status", "active");
  if (profiles.error) throw profiles.error;
  return (profiles.data ?? []).map((profile) => ({
    id: String(profile.id),
    name: String(profile.display_name ?? profile.email ?? "Dosen"),
    email: String(profile.email ?? ""),
  })).sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
}

async function loadCurricula(context: ActorContext, programId: string): Promise<CurriculumConfig[]> {
  const curriculaResult = await context.admin.from("curricula")
    .select("id,code,name,start_year,status,notes").eq("academic_program_id", programId)
    .order("start_year", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
  if (curriculaResult.error) throw curriculaResult.error;
  const curriculumRows = curriculaResult.data ?? [];
  const curriculumIds = curriculumRows.map((row) => String(row.id));
  if (!curriculumIds.length) return [];

  const [profilesResult, plosResult, groupsResult, coursesResult] = await Promise.all([
    context.admin.from("graduate_profiles").select("id,curriculum_id,code,description,sort_order").in("curriculum_id", curriculumIds).order("sort_order"),
    context.admin.from("program_learning_outcomes").select("id,curriculum_id,code,description,sort_order").in("curriculum_id", curriculumIds).order("sort_order"),
    context.admin.from("knowledge_groups").select("id,curriculum_id,code,name,description,sort_order").in("curriculum_id", curriculumIds).order("sort_order"),
    context.admin.from("curriculum_courses").select("id,curriculum_id,knowledge_group_id,code,name,credits,recommended_semester,description,is_available_for_reoffer").in("curriculum_id", curriculumIds).order("code"),
  ]);
  if (profilesResult.error || plosResult.error || groupsResult.error || coursesResult.error) throw new Error("Data kurikulum tidak dapat dimuat.");

  const courseIds = (coursesResult.data ?? []).map((row) => String(row.id));
  let cloRows: Array<Record<string, unknown>> = [];
  let mappingRows: Array<Record<string, unknown>> = [];
  if (courseIds.length) {
    const closResult = await context.admin.from("course_learning_outcomes")
      .select("id,curriculum_course_id,code,description,sort_order").in("curriculum_course_id", courseIds).order("sort_order");
    if (closResult.error) throw closResult.error;
    cloRows = (closResult.data ?? []) as Array<Record<string, unknown>>;
    const cloIds = cloRows.map((row) => String(row.id));
    if (cloIds.length) {
      const mappingsResult = await context.admin.from("clo_plo_mappings").select("clo_id,plo_id,contribution").in("clo_id", cloIds);
      if (mappingsResult.error) throw mappingsResult.error;
      mappingRows = (mappingsResult.data ?? []) as Array<Record<string, unknown>>;
    }
  }

  const profiles = (profilesResult.data ?? []) as Array<Record<string, unknown>>;
  const plos = (plosResult.data ?? []) as Array<Record<string, unknown>>;
  const groups = (groupsResult.data ?? []) as Array<Record<string, unknown>>;
  const courses = (coursesResult.data ?? []) as Array<Record<string, unknown>>;
  const curriculumById = new Map(curriculumRows.map((row) => [String(row.id), row]));
  const groupById = new Map(groups.map((row) => [String(row.id), row]));
  const ploIdsByClo = new Map<string, string[]>();
  for (const mapping of mappingRows) {
    const cloId = String(mapping.clo_id);
    const list = ploIdsByClo.get(cloId) ?? [];
    list.push(String(mapping.plo_id));
    ploIdsByClo.set(cloId, list);
  }

  return curriculumRows.map((curriculum) => {
    const id = String(curriculum.id);
    const curriculumCourses = courses.filter((course) => String(course.curriculum_id) === id).map((course): CurriculumCourseConfig => {
      const courseId = String(course.id);
      const group = course.knowledge_group_id ? groupById.get(String(course.knowledge_group_id)) : undefined;
      return {
        id: courseId,
        curriculumId: id,
        curriculumCode: String(curriculum.code),
        curriculumName: String(curriculum.name),
        knowledgeGroupId: course.knowledge_group_id ? String(course.knowledge_group_id) : null,
        knowledgeGroupCode: group ? String(group.code) : null,
        code: String(course.code),
        name: String(course.name),
        credits: Number(course.credits ?? 0),
        recommendedSemester: course.recommended_semester == null ? null : Number(course.recommended_semester),
        description: String(course.description ?? ""),
        isAvailableForReoffer: course.is_available_for_reoffer !== false,
        clos: cloRows.filter((clo) => String(clo.curriculum_course_id) === courseId).map((clo) => ({
          id: String(clo.id),
          code: String(clo.code),
          description: String(clo.description),
          sortOrder: Number(clo.sort_order ?? 0),
          ploIds: ploIdsByClo.get(String(clo.id)) ?? [],
        })),
      };
    });
    return {
      id,
      code: String(curriculum.code),
      name: String(curriculum.name),
      startYear: curriculum.start_year == null ? null : Number(curriculum.start_year),
      status: String(curriculum.status) as CurriculumStatus,
      notes: String(curriculum.notes ?? ""),
      graduateProfiles: profiles.filter((item) => String(item.curriculum_id) === id).map((item) => ({
        id: String(item.id), code: String(item.code), description: String(item.description), sortOrder: Number(item.sort_order ?? 0),
      })),
      plos: plos.filter((item) => String(item.curriculum_id) === id).map((item) => ({
        id: String(item.id), code: String(item.code), description: String(item.description), sortOrder: Number(item.sort_order ?? 0),
      })),
      knowledgeGroups: groups.filter((item) => String(item.curriculum_id) === id).map((item) => ({
        id: String(item.id), code: String(item.code), name: String(item.name), description: String(item.description ?? ""), sortOrder: Number(item.sort_order ?? 0),
      })),
      courses: curriculumCourses,
    };
  }).sort((a, b) => (a.status === "active" ? -1 : b.status === "active" ? 1 : (b.startYear ?? 0) - (a.startYear ?? 0) || a.name.localeCompare(b.name, "id-ID")));
}

async function loadPeriods(context: ActorContext, programId: string): Promise<AcademicPeriodConfig[]> {
  const periodsResult = await context.admin.from("academic_periods")
    .select("id,label,term,academic_year,starts_at,ends_at,status,late_modification_until,primary_curriculum_id")
    .eq("academic_program_id", programId).order("starts_at", { ascending: false });
  if (periodsResult.error) throw periodsResult.error;
  const rows = periodsResult.data ?? [];
  const periodIds = rows.map((row) => String(row.id));
  let stageRows: Array<Record<string, unknown>> = [];
  if (periodIds.length) {
    const stagesResult = await context.admin.from("academic_stages")
      .select("id,academic_period_id,stage_key,title,starts_at,ends_at,access_roles,sort_order")
      .in("academic_period_id", periodIds).order("sort_order");
    if (stagesResult.error) throw stagesResult.error;
    stageRows = (stagesResult.data ?? []) as Array<Record<string, unknown>>;
  }
  return rows.map((row) => {
    const mode = periodModificationMode(context, row);
    return {
      id: String(row.id),
      label: String(row.label),
      term: String(row.term),
      academicYear: String(row.academic_year),
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      status: String(row.status) as PeriodStatus,
      lateModificationUntil: row.late_modification_until ? String(row.late_modification_until) : null,
      primaryCurriculumId: row.primary_curriculum_id ? String(row.primary_curriculum_id) : null,
      stages: stageRows.filter((stage) => String(stage.academic_period_id) === String(row.id)).map((stage) => ({
        id: String(stage.id),
        stageKey: String(stage.stage_key),
        title: String(stage.title),
        startsAt: String(stage.starts_at),
        endsAt: String(stage.ends_at),
        accessRoles: Array.isArray(stage.access_roles) ? stage.access_roles.map(String) : [],
        sortOrder: Number(stage.sort_order ?? 0),
      })),
      canModify: mode !== "readonly",
      modificationMode: mode,
    };
  }).sort((a, b) => {
    const rank = (status: PeriodStatus) => status === "active" ? 0 : status === "draft" ? 1 : 2;
    return rank(a.status) - rank(b.status) || b.startsAt.localeCompare(a.startsAt);
  });
}

async function loadClasses(context: ActorContext, programId: string, curricula: CurriculumConfig[], periods: AcademicPeriodConfig[]) {
  const periodIds = periods.map((period) => period.id);
  if (!periodIds.length) return [];
  const classesResult = await context.admin.from("class_offerings")
    .select("id,academic_period_id,curriculum_course_id,section_number,status")
    .in("academic_period_id", periodIds).order("section_number");
  if (classesResult.error) throw classesResult.error;
  const classRows = (classesResult.data ?? []) as Array<Record<string, unknown>>;
  const classIds = classRows.map((row) => String(row.id));
  let lecturerRows: Array<Record<string, unknown>> = [];
  if (classIds.length) {
    const assignments = await context.admin.from("class_lecturers")
      .select("class_offering_id,user_id,lecturer_order,assignment_role").in("class_offering_id", classIds).order("lecturer_order");
    if (assignments.error) throw assignments.error;
    lecturerRows = (assignments.data ?? []) as Array<Record<string, unknown>>;
  }
  const allCourses = curricula.flatMap((curriculum) => curriculum.courses);
  const courseMap = new Map(allCourses.map((course) => [course.id, course]));
  const program = await getProgram(context, programId);
  const lecturers = await listLecturers(context, program.organization_id);
  const lecturerMap = new Map(lecturers.map((lecturer) => [lecturer.id, lecturer.name]));
  return classRows.flatMap((row): AcademicClassConfig[] => {
    const course = courseMap.get(String(row.curriculum_course_id));
    if (!course) return [];
    const ids = lecturerRows.filter((item) => String(item.class_offering_id) === String(row.id)).map((item) => String(item.user_id));
    const sectionNumber = Number(row.section_number ?? 1);
    return [{
      id: String(row.id),
      periodId: String(row.academic_period_id),
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
      curriculumId: course.curriculumId,
      curriculumCode: course.curriculumCode,
      curriculumName: course.curriculumName,
      sectionNumber,
      className: sectionLabel(sectionNumber),
      lecturerIds: ids,
      lecturerNames: ids.map((id) => lecturerMap.get(id) ?? "Dosen tidak aktif"),
    }];
  }).sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.sectionNumber - b.sectionNumber);
}

export async function loadAcademicWorkspace(): Promise<ActionResult<AcademicWorkspacePayload>> {
  try {
    const context = await requireActor();
    let query = context.admin.from("academic_programs")
      .select("id,organization_id,university_name,faculty_name,department_name,program_name,program_code,is_enabled").order("program_name");
    if (!context.isSuperadmin) query = query.in("organization_id", [...context.kaprodiOrganizationIds]);
    const result = await query;
    if (result.error) throw result.error;
    const programRows = (result.data ?? []) as ProgramRow[];
    const programs = await Promise.all(programRows.map(async (row): Promise<AcademicProgramConfig> => {
      const [organizationResult, curricula, periods, lecturers] = await Promise.all([
        context.admin.from("organizations").select("slug").eq("id", row.organization_id).maybeSingle(),
        loadCurricula(context, row.id),
        loadPeriods(context, row.id),
        listLecturers(context, row.organization_id),
      ]);
      if (organizationResult.error) throw organizationResult.error;
      const classes = await loadClasses(context, row.id, curricula, periods);
      return {
        id: row.id,
        organizationId: row.organization_id,
        universityName: row.university_name,
        facultyName: row.faculty_name,
        departmentName: row.department_name,
        programName: row.program_name,
        programCode: row.program_code ?? "",
        displayName: `${row.program_name} · ${row.university_name}`,
        protected: organizationResult.data?.slug === DEFAULT_ORGANIZATION_SLUG,
        isEnabled: row.is_enabled,
        periods,
        curricula,
        classes,
        lecturers,
      };
    }));
    programs.sort((a, b) => Number(b.protected) - Number(a.protected) || a.displayName.localeCompare(b.displayName, "id-ID"));
    return {
      ok: true,
      message: "Konteks akademik dimuat.",
      data: {
        programs,
        canManageInstitutions: context.isSuperadmin,
        canSetActivePeriod: context.isSuperadmin,
        canCreatePeriods: context.isSuperadmin || context.kaprodiOrganizationIds.size > 0,
      },
    };
  } catch (error) {
    return errorResult(error);
  }
}

export async function createAcademicProgram(input: {
  universityName: string;
  facultyName: string;
  departmentName: string;
  programName: string;
  programCode?: string;
}): Promise<ActionResult> {
  let organizationId: string | null = null;
  try {
    const context = await requireActor();
    if (!context.isSuperadmin) throw new Error("Kelola Institusi hanya tersedia untuk Superadmin.");
    const universityName = cleanText(input.universityName, "Nama universitas/institusi");
    const facultyName = cleanText(input.facultyName, "Fakultas/sekolah");
    const departmentName = cleanText(input.departmentName, "Departemen");
    const programName = cleanText(input.programName, "Program studi");
    const programCode = input.programCode?.trim().toUpperCase().slice(0, 30) || null;
    const organizationName = `${universityName} · ${facultyName} · ${programName}`;
    const slug = `${slugify(programName) || "program"}-${crypto.randomUUID().slice(0, 8)}`;
    const organizationResult = await context.admin.from("organizations")
      .insert({ name: organizationName, slug, metadata: { scope: "academic_program", academic_model: "normalized_v1" } })
      .select("id").single();
    if (organizationResult.error) throw organizationResult.error;
    organizationId = String(organizationResult.data.id);
    const programResult = await context.admin.from("academic_programs").insert({
      organization_id: organizationId,
      university_name: universityName,
      faculty_name: facultyName,
      department_name: departmentName,
      program_name: programName,
      program_code: programCode,
    });
    if (programResult.error) throw programResult.error;
    organizationId = null;
    revalidateAcademic();
    return { ok: true, message: "Program studi berhasil ditambahkan ke Kelola Institusi." };
  } catch (error) {
    if (organizationId) {
      try {
        const admin = getSupabaseAdmin();
        await admin.from("organizations").delete().eq("id", organizationId);
      } catch {
        // Best-effort rollback only.
      }
    }
    return errorResult(error);
  }
}

export async function updateAcademicProgram(input: {
  programId: string;
  universityName: string;
  facultyName: string;
  departmentName: string;
  programName: string;
  programCode?: string;
}): Promise<ActionResult> {
  try {
    const context = await requireActor();
    if (!context.isSuperadmin) throw new Error("Kelola Institusi hanya tersedia untuk Superadmin.");
    const program = await getProgram(context, input.programId);
    const universityName = cleanText(input.universityName, "Nama universitas/institusi");
    const facultyName = cleanText(input.facultyName, "Fakultas/sekolah");
    const departmentName = cleanText(input.departmentName, "Departemen");
    const programName = cleanText(input.programName, "Program studi");
    const programCode = input.programCode?.trim().toUpperCase().slice(0, 30) || null;
    const result = await context.admin.from("academic_programs").update({
      university_name: universityName,
      faculty_name: facultyName,
      department_name: departmentName,
      program_name: programName,
      program_code: programCode,
    }).eq("id", program.id);
    if (result.error) throw result.error;
    await context.admin.from("organizations").update({ name: `${universityName} · ${facultyName} · ${programName}` }).eq("id", program.organization_id);
    revalidateAcademic();
    return { ok: true, message: "Identitas institusi diperbarui." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function deleteAcademicProgram(input: { programId: string; confirmationName: string; finalToken: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    if (!context.isSuperadmin) throw new Error("Kelola Institusi hanya tersedia untuk Superadmin.");
    const program = await getProgram(context, input.programId);
    const org = await context.admin.from("organizations").select("slug").eq("id", program.organization_id).maybeSingle();
    if (org.error) throw org.error;
    if (org.data?.slug === DEFAULT_ORGANIZATION_SLUG) throw new Error("S1 Informatika UNDIP adalah scope otorisasi utama dan tidak dapat dihapus.");
    if (input.confirmationName.trim() !== program.program_name || input.finalToken.trim().toUpperCase() !== "HAPUS") {
      throw new Error("Konfirmasi ganda belum sesuai. Ketik nama program studi persis dan token HAPUS.");
    }
    const result = await context.admin.from("organizations").delete().eq("id", program.organization_id);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Institusi dan seluruh konteks akademiknya berhasil dihapus." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function createDraftAcademicPeriod(input: {
  programId: string;
  label: string;
  term: string;
  academicYear: string;
  startsAt: string;
  endsAt: string;
  primaryCurriculumId?: string | null;
}): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const program = await getProgram(context, input.programId);
    requireProgramEditor(context, program);
    const existingDraft = await context.admin.from("academic_periods").select("id").eq("academic_program_id", program.id).eq("status", "draft").limit(1);
    if (existingDraft.error) throw existingDraft.error;
    if ((existingDraft.data ?? []).length) throw new Error("Hanya satu periode ke depan yang boleh berada dalam status Draft.");
    const active = await context.admin.from("academic_periods").select("starts_at").eq("academic_program_id", program.id).eq("status", "active").maybeSingle();
    if (active.error) throw active.error;
    const label = cleanText(input.label, "Nama periode", 3, 80);
    const term = ["Gasal", "Genap", "Pendek", "Lainnya"].includes(input.term) ? input.term : "Lainnya";
    const academicYear = cleanText(input.academicYear, "Tahun akademik", 4, 20);
    const startsAt = cleanDate(input.startsAt, "Tanggal mulai");
    const endsAt = cleanDate(input.endsAt, "Tanggal selesai");
    if (startsAt > endsAt) throw new Error("Tanggal mulai periode harus sebelum tanggal selesai.");
    if (active.data?.starts_at && startsAt <= String(active.data.starts_at)) throw new Error("Periode Draft harus berada setelah periode aktif saat ini.");
    let primaryCurriculumId = input.primaryCurriculumId || null;
    if (primaryCurriculumId) {
      const curriculum = await getCurriculum(context, primaryCurriculumId);
      if (curriculum.program.id !== program.id) throw new Error("Kurikulum utama tidak berasal dari program studi ini.");
    } else {
      const activeCurriculum = await context.admin.from("curricula").select("id").eq("academic_program_id", program.id).eq("status", "active").maybeSingle();
      if (activeCurriculum.error) throw activeCurriculum.error;
      primaryCurriculumId = activeCurriculum.data ? String(activeCurriculum.data.id) : null;
    }
    const periodInsert = await context.admin.from("academic_periods").insert({
      academic_program_id: program.id,
      primary_curriculum_id: primaryCurriculumId,
      label,
      term,
      academic_year: academicYear,
      starts_at: startsAt,
      ends_at: endsAt,
      status: "draft",
      created_by: context.userId,
    }).select("id").single();
    if (periodInsert.error) throw periodInsert.error;
    const periodId = String(periodInsert.data.id);
    const stageRanges = [
      [dateShift(startsAt, -28), dateShift(startsAt, -14)],
      [dateShift(startsAt, -21), dateShift(startsAt, 3)],
      [dateShift(startsAt, -7), dateShift(startsAt, 14)],
      [dateShift(startsAt, 7), dateShift(startsAt, 21)],
      [startsAt, dateShift(endsAt, -14)],
      [dateShift(endsAt, -14), dateShift(endsAt, 14)],
    ];
    const stages = PERIOD_STAGES.map((stage, index) => ({
      academic_period_id: periodId,
      stage_key: stage.key,
      title: stage.title,
      starts_at: stageRanges[index]?.[0] ?? startsAt,
      ends_at: stageRanges[index]?.[1] ?? endsAt,
      access_roles: [...stage.roles],
      sort_order: index + 1,
    }));
    const stageInsert = await context.admin.from("academic_stages").insert(stages);
    if (stageInsert.error) {
      await context.admin.from("academic_periods").delete().eq("id", periodId);
      throw stageInsert.error;
    }
    revalidateAcademic();
    return { ok: true, message: "Periode ke depan dibuat sebagai Draft. Superadmin dapat menetapkannya aktif melalui Set Periode Aktif." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function setActiveAcademicPeriod(input: { programId: string; periodId: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    if (!context.isSuperadmin) throw new Error("Set Periode Aktif hanya tersedia untuk Superadmin.");
    const program = await getProgram(context, input.programId);
    const periodContext = await getPeriod(context, input.periodId);
    if (periodContext.program.id !== program.id) throw new Error("Periode tidak berasal dari program studi yang dipilih.");
    if (periodContext.row.status === "closed") throw new Error("Periode sebelumnya tidak dapat diaktifkan ulang; gunakan late modification bila masih tersedia.");
    if (periodContext.row.status === "active") return { ok: true, message: `${periodContext.row.label} sudah menjadi periode aktif.` };
    const current = await context.admin.from("academic_periods").select("id").eq("academic_program_id", program.id).eq("status", "active").maybeSingle();
    if (current.error) throw current.error;
    const oldId = current.data ? String(current.data.id) : null;
    const lateUntil = dateShift(todayIso(), 30);
    if (oldId) {
      const closeResult = await context.admin.from("academic_periods").update({ status: "closed", late_modification_until: lateUntil }).eq("id", oldId);
      if (closeResult.error) throw closeResult.error;
    }
    const activateResult = await context.admin.from("academic_periods")
      .update({ status: "active", late_modification_until: null }).eq("id", periodContext.row.id);
    if (activateResult.error) {
      if (oldId) await context.admin.from("academic_periods").update({ status: "active", late_modification_until: null }).eq("id", oldId);
      throw activateResult.error;
    }
    revalidateAcademic();
    return { ok: true, message: `${periodContext.row.label} ditetapkan sebagai periode aktif. Periode sebelumnya mendapat late modification 30 hari.` };
  } catch (error) {
    return errorResult(error);
  }
}

export async function saveAcademicStages(input: {
  periodId: string;
  startsAt: string;
  endsAt: string;
  stages: Array<{ id: string; startsAt: string; endsAt: string }>;
}): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const { row, program } = await getPeriod(context, input.periodId);
    requireProgramEditor(context, program);
    const mode = requirePeriodEditor(context, row);
    const startsAt = cleanDate(input.startsAt, "Tanggal mulai periode");
    const endsAt = cleanDate(input.endsAt, "Tanggal selesai periode");
    if (startsAt > endsAt) throw new Error("Rentang periode tidak valid.");
    const periodUpdate = await context.admin.from("academic_periods").update({ starts_at: startsAt, ends_at: endsAt }).eq("id", row.id);
    if (periodUpdate.error) throw periodUpdate.error;
    for (const incoming of input.stages) {
      const stageStart = cleanDate(incoming.startsAt, "Tanggal mulai tahap");
      const stageEnd = cleanDate(incoming.endsAt, "Tanggal selesai tahap");
      if (stageStart > stageEnd) throw new Error("Tanggal mulai tahapan harus sebelum tanggal selesai.");
      const result = await context.admin.from("academic_stages").update({ starts_at: stageStart, ends_at: stageEnd })
        .eq("id", incoming.id).eq("academic_period_id", row.id);
      if (result.error) throw result.error;
    }
    revalidateAcademic();
    return { ok: true, message: mode === "late" ? "Late modification tahapan berhasil disimpan." : "Perubahan tahapan berhasil disimpan." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function createCurriculum(input: { programId: string; code: string; name: string; startYear?: number | null }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const program = await getProgram(context, input.programId);
    requireProgramEditor(context, program);
    const code = cleanCode(input.code, "Kode kurikulum");
    const name = cleanText(input.name, "Nama kurikulum", 3, 120);
    const startYear = input.startYear == null ? null : Math.trunc(Number(input.startYear));
    if (startYear != null && (startYear < 1900 || startYear > 2200)) throw new Error("Tahun mulai kurikulum tidak valid.");
    const result = await context.admin.from("curricula").insert({ academic_program_id: program.id, code, name, start_year: startYear, status: "draft" });
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Kurikulum baru dibuat sebagai Draft." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function updateCurriculum(input: { curriculumId: string; code: string; name: string; startYear?: number | null; notes?: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const { row, program } = await getCurriculum(context, input.curriculumId);
    requireProgramEditor(context, program);
    const code = cleanCode(input.code, "Kode kurikulum");
    const name = cleanText(input.name, "Nama kurikulum", 3, 120);
    const startYear = input.startYear == null ? null : Math.trunc(Number(input.startYear));
    if (startYear != null && (startYear < 1900 || startYear > 2200)) throw new Error("Tahun mulai kurikulum tidak valid.");
    const result = await context.admin.from("curricula").update({ code, name, start_year: startYear, notes: input.notes?.trim().slice(0, 1000) || null }).eq("id", row.id);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Identitas kurikulum diperbarui." };
  } catch (error) {
    return errorResult(error);
  }
}

export async function setActiveCurriculum(input: { curriculumId: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const { row, program } = await getCurriculum(context, input.curriculumId);
    requireProgramEditor(context, program);
    if (row.status === "active") return { ok: true, message: "Kurikulum ini sudah aktif." };
    const current = await context.admin.from("curricula").select("id").eq("academic_program_id", program.id).eq("status", "active").maybeSingle();
    if (current.error) throw current.error;
    if (current.data) {
      const retire = await context.admin.from("curricula").update({ status: "retired" }).eq("id", current.data.id);
      if (retire.error) throw retire.error;
    }
    const activate = await context.admin.from("curricula").update({ status: "active" }).eq("id", row.id);
    if (activate.error) throw activate.error;
    revalidateAcademic();
    return { ok: true, message: "Kurikulum ditetapkan aktif. Mata kuliah kurikulum sebelumnya tetap dapat dipanggil kembali bila diizinkan untuk re-offer." };
  } catch (error) {
    return errorResult(error);
  }
}

async function ensureCurriculumEditor(context: ActorContext, curriculumId: string) {
  const result = await getCurriculum(context, curriculumId);
  requireProgramEditor(context, result.program);
  return result;
}

export async function saveGraduateProfile(input: { curriculumId: string; id?: string; code: string; description: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    await ensureCurriculumEditor(context, input.curriculumId);
    const code = cleanCode(input.code, "Kode profil lulusan", 24);
    const description = cleanText(input.description, "Deskripsi profil lulusan", 5, 1200);
    const payload = { curriculum_id: input.curriculumId, code, description };
    const result = input.id
      ? await context.admin.from("graduate_profiles").update(payload).eq("id", input.id).eq("curriculum_id", input.curriculumId)
      : await context.admin.from("graduate_profiles").insert(payload);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Profil lulusan disimpan." };
  } catch (error) { return errorResult(error); }
}

export async function deleteGraduateProfile(input: { curriculumId: string; id: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    await ensureCurriculumEditor(context, input.curriculumId);
    const result = await context.admin.from("graduate_profiles").delete().eq("id", input.id).eq("curriculum_id", input.curriculumId);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Profil lulusan dihapus." };
  } catch (error) { return errorResult(error); }
}

export async function savePlo(input: { curriculumId: string; id?: string; code: string; description: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    await ensureCurriculumEditor(context, input.curriculumId);
    const code = cleanCode(input.code, "Kode CPL/PLO", 24);
    const description = cleanText(input.description, "Deskripsi CPL/PLO", 5, 1200);
    const payload = { curriculum_id: input.curriculumId, code, description };
    const result = input.id
      ? await context.admin.from("program_learning_outcomes").update(payload).eq("id", input.id).eq("curriculum_id", input.curriculumId)
      : await context.admin.from("program_learning_outcomes").insert(payload);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "CPL/PLO disimpan." };
  } catch (error) { return errorResult(error); }
}

export async function deletePlo(input: { curriculumId: string; id: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    await ensureCurriculumEditor(context, input.curriculumId);
    const result = await context.admin.from("program_learning_outcomes").delete().eq("id", input.id).eq("curriculum_id", input.curriculumId);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "CPL/PLO dihapus." };
  } catch (error) { return errorResult(error); }
}

export async function saveKnowledgeGroup(input: { curriculumId: string; id?: string; code: string; name: string; description?: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    await ensureCurriculumEditor(context, input.curriculumId);
    const code = cleanCode(input.code, "Kode KBK", 24);
    const name = cleanText(input.name, "Nama kelompok MK/KBK", 2, 120);
    const payload = { curriculum_id: input.curriculumId, code, name, description: input.description?.trim().slice(0, 1000) || null };
    const result = input.id
      ? await context.admin.from("knowledge_groups").update(payload).eq("id", input.id).eq("curriculum_id", input.curriculumId)
      : await context.admin.from("knowledge_groups").insert(payload);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Kelompok MK/KBK disimpan." };
  } catch (error) { return errorResult(error); }
}

export async function deleteKnowledgeGroup(input: { curriculumId: string; id: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    await ensureCurriculumEditor(context, input.curriculumId);
    const result = await context.admin.from("knowledge_groups").delete().eq("id", input.id).eq("curriculum_id", input.curriculumId);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Kelompok MK/KBK dihapus. Mata kuliah tetap tersimpan tanpa kelompok." };
  } catch (error) { return errorResult(error); }
}

export async function saveCurriculumCourse(input: {
  curriculumId: string;
  id?: string;
  code: string;
  name: string;
  credits: number;
  recommendedSemester?: number | null;
  knowledgeGroupId?: string | null;
  description?: string;
  isAvailableForReoffer: boolean;
}): Promise<ActionResult> {
  try {
    const context = await requireActor();
    await ensureCurriculumEditor(context, input.curriculumId);
    const code = cleanCode(input.code, "Kode mata kuliah", 30);
    const name = cleanText(input.name, "Nama mata kuliah", 2, 160);
    const credits = Number(input.credits);
    if (!Number.isFinite(credits) || credits < 0 || credits > 30) throw new Error("SKS tidak valid.");
    const recommendedSemester = input.recommendedSemester == null ? null : Math.trunc(Number(input.recommendedSemester));
    if (recommendedSemester != null && (recommendedSemester < 1 || recommendedSemester > 14)) throw new Error("Semester rekomendasi harus 1–14.");
    if (input.knowledgeGroupId) {
      const group = await context.admin.from("knowledge_groups").select("curriculum_id").eq("id", input.knowledgeGroupId).maybeSingle();
      if (group.error) throw group.error;
      if (!group.data || String(group.data.curriculum_id) !== input.curriculumId) throw new Error("Kelompok MK tidak berasal dari kurikulum ini.");
    }
    const payload = {
      curriculum_id: input.curriculumId,
      code,
      name,
      credits,
      recommended_semester: recommendedSemester,
      knowledge_group_id: input.knowledgeGroupId || null,
      description: input.description?.trim().slice(0, 3000) || null,
      is_available_for_reoffer: Boolean(input.isAvailableForReoffer),
    };
    const result = input.id
      ? await context.admin.from("curriculum_courses").update(payload).eq("id", input.id).eq("curriculum_id", input.curriculumId)
      : await context.admin.from("curriculum_courses").insert(payload);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Mata kuliah kurikulum disimpan." };
  } catch (error) { return errorResult(error); }
}

export async function saveClo(input: { courseId: string; id?: string; code: string; description: string; ploIds: string[] }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const course = await getCourse(context, input.courseId);
    requireProgramEditor(context, course.curriculum.program);
    const code = cleanCode(input.code, "Kode CPMK/CLO", 24);
    const description = cleanText(input.description, "Deskripsi CPMK/CLO", 5, 1200);
    const allowedPlos = await context.admin.from("program_learning_outcomes").select("id").eq("curriculum_id", course.row.curriculum_id);
    if (allowedPlos.error) throw allowedPlos.error;
    const allowed = new Set((allowedPlos.data ?? []).map((row) => String(row.id)));
    const ploIds = [...new Set(input.ploIds)].filter((id) => allowed.has(id));
    let cloId = input.id || null;
    if (cloId) {
      const result = await context.admin.from("course_learning_outcomes").update({ code, description }).eq("id", cloId).eq("curriculum_course_id", input.courseId);
      if (result.error) throw result.error;
    } else {
      const result = await context.admin.from("course_learning_outcomes").insert({ curriculum_course_id: input.courseId, code, description }).select("id").single();
      if (result.error) throw result.error;
      cloId = String(result.data.id);
    }
    const remove = await context.admin.from("clo_plo_mappings").delete().eq("clo_id", cloId);
    if (remove.error) throw remove.error;
    if (ploIds.length) {
      const mapping = await context.admin.from("clo_plo_mappings").insert(ploIds.map((ploId) => ({ clo_id: cloId, plo_id: ploId, contribution: 1 })));
      if (mapping.error) throw mapping.error;
    }
    revalidateAcademic();
    return { ok: true, message: "CPMK/CLO dan pemetaan CPL berhasil disimpan." };
  } catch (error) { return errorResult(error); }
}

export async function deleteClo(input: { courseId: string; id: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const course = await getCourse(context, input.courseId);
    requireProgramEditor(context, course.curriculum.program);
    const result = await context.admin.from("course_learning_outcomes").delete().eq("id", input.id).eq("curriculum_course_id", input.courseId);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "CPMK/CLO dihapus." };
  } catch (error) { return errorResult(error); }
}

async function validatedLecturerIds(context: ActorContext, organizationId: string, ids: string[]) {
  const lecturers = await listLecturers(context, organizationId);
  const allowed = new Set(lecturers.map((lecturer) => lecturer.id));
  const unique = [...new Set(ids)].filter((id) => allowed.has(id));
  if (!unique.length) throw new Error("Pilih minimal satu dosen pengampu aktif.");
  return unique;
}

export async function createAcademicClass(input: { periodId: string; courseId: string; lecturerIds: string[] }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const period = await getPeriod(context, input.periodId);
    requireProgramEditor(context, period.program);
    requirePeriodEditor(context, period.row);
    const course = await getCourse(context, input.courseId);
    if (course.curriculum.program.id !== period.program.id) throw new Error("Mata kuliah berasal dari program studi lain.");
    if (course.row.is_available_for_reoffer === false) throw new Error("Mata kuliah ini tidak diizinkan untuk dijalankan kembali.");
    const lecturerIds = await validatedLecturerIds(context, period.program.organization_id, input.lecturerIds);
    const last = await context.admin.from("class_offerings").select("section_number")
      .eq("academic_period_id", period.row.id).eq("curriculum_course_id", input.courseId)
      .order("section_number", { ascending: false }).limit(1);
    if (last.error) throw last.error;
    const sectionNumber = Number(last.data?.[0]?.section_number ?? 0) + 1;
    if (sectionNumber > 702) throw new Error("Jumlah kelas untuk mata kuliah ini melebihi batas penamaan otomatis.");
    const inserted = await context.admin.from("class_offerings").insert({
      academic_period_id: period.row.id,
      curriculum_course_id: input.courseId,
      section_number: sectionNumber,
      status: period.row.status === "draft" ? "draft" : "active",
      created_by: context.userId,
    }).select("id").single();
    if (inserted.error) throw inserted.error;
    const classId = String(inserted.data.id);
    const assignments = lecturerIds.map((userId, index) => ({
      class_offering_id: classId,
      user_id: userId,
      lecturer_order: index + 1,
      assignment_role: index === 0 ? "coordinator" : "member",
    }));
    const assignmentResult = await context.admin.from("class_lecturers").insert(assignments);
    if (assignmentResult.error) {
      await context.admin.from("class_offerings").delete().eq("id", classId);
      throw assignmentResult.error;
    }
    revalidateAcademic();
    return { ok: true, message: `Kelas ${sectionLabel(sectionNumber)} dibuat otomatis untuk ${course.row.code}.` };
  } catch (error) { return errorResult(error); }
}

export async function updateAcademicClassLecturers(input: { classId: string; lecturerIds: string[] }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const classResult = await context.admin.from("class_offerings").select("id,academic_period_id").eq("id", input.classId).maybeSingle();
    if (classResult.error) throw classResult.error;
    if (!classResult.data) throw new Error("Kelas tidak ditemukan.");
    const period = await getPeriod(context, String(classResult.data.academic_period_id));
    requireProgramEditor(context, period.program);
    requirePeriodEditor(context, period.row);
    const lecturerIds = await validatedLecturerIds(context, period.program.organization_id, input.lecturerIds);
    const remove = await context.admin.from("class_lecturers").delete().eq("class_offering_id", input.classId);
    if (remove.error) throw remove.error;
    const result = await context.admin.from("class_lecturers").insert(lecturerIds.map((userId, index) => ({
      class_offering_id: input.classId,
      user_id: userId,
      lecturer_order: index + 1,
      assignment_role: index === 0 ? "coordinator" : "member",
    })));
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Daftar dosen pengampu diperbarui." };
  } catch (error) { return errorResult(error); }
}

export async function deleteAcademicClass(input: { classId: string }): Promise<ActionResult> {
  try {
    const context = await requireActor();
    const classResult = await context.admin.from("class_offerings").select("id,academic_period_id").eq("id", input.classId).maybeSingle();
    if (classResult.error) throw classResult.error;
    if (!classResult.data) throw new Error("Kelas tidak ditemukan.");
    const period = await getPeriod(context, String(classResult.data.academic_period_id));
    requireProgramEditor(context, period.program);
    requirePeriodEditor(context, period.row);
    const result = await context.admin.from("class_offerings").delete().eq("id", input.classId);
    if (result.error) throw result.error;
    revalidateAcademic();
    return { ok: true, message: "Kelas dihapus dari periode ini." };
  } catch (error) { return errorResult(error); }
}
