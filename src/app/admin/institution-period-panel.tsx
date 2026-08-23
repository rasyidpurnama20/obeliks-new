"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAcademicClass,
  createAcademicProgram,
  createCurriculum,
  createDraftAcademicPeriod,
  deleteAcademicClass,
  deleteAcademicProgram,
  deleteClo,
  deleteGraduateProfile,
  deleteKnowledgeGroup,
  deletePlo,
  loadAcademicWorkspace,
  saveAcademicStages,
  saveClo,
  saveCurriculumCourse,
  saveGraduateProfile,
  saveKnowledgeGroup,
  savePlo,
  setActiveAcademicPeriod,
  setActiveCurriculum,
  updateAcademicClassLecturers,
  updateAcademicProgram,
  updateCurriculum,
  type AcademicClassConfig,
  type AcademicPeriodConfig,
  type AcademicProgramConfig,
  type AcademicWorkspacePayload,
  type CurriculumConfig,
  type CurriculumCourseConfig,
  type GraduateProfileConfig,
  type KnowledgeGroupConfig,
  type PloConfig,
  type CloConfig,
} from "./institution-period-actions";

type MainTab = "curriculum" | "stages" | "classes";
type WorkspaceView = "main" | "institutions" | "active-period";
type Modal = "period" | "curriculum" | "profile" | "plo" | "group" | "course" | "clo" | "class" | "delete-program" | null;
type InstitutionForm = { programId: string; universityName: string; facultyName: string; departmentName: string; programName: string; programCode: string };
type PeriodForm = { label: string; term: string; academicYear: string; startsAt: string; endsAt: string; primaryCurriculumId: string };
type CurriculumForm = { id: string; code: string; name: string; startYear: string; notes: string };
type SimpleForm = { id: string; code: string; name: string; description: string };
type CourseForm = { id: string; code: string; name: string; credits: string; semester: string; groupId: string; description: string; reoffer: boolean };
type CloForm = { id: string; courseId: string; code: string; description: string; ploIds: string[] };

type InstitutionPeriodPanelProps = { initialRole: string };

const emptyInstitutionForm: InstitutionForm = { programId: "", universityName: "", facultyName: "", departmentName: "", programName: "", programCode: "" };
const emptyPeriodForm: PeriodForm = { label: "", term: "Gasal", academicYear: "", startsAt: "", endsAt: "", primaryCurriculumId: "" };
const emptyCurriculumForm: CurriculumForm = { id: "", code: "", name: "", startYear: "", notes: "" };
const emptySimpleForm: SimpleForm = { id: "", code: "", name: "", description: "" };
const emptyCourseForm: CourseForm = { id: "", code: "", name: "", credits: "3", semester: "", groupId: "", description: "", reoffer: true };
const emptyCloForm: CloForm = { id: "", courseId: "", code: "", description: "", ploIds: [] };

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

function readActiveRole(fallback: string) {
  return document.querySelector<HTMLSelectElement>('select[aria-label="Peran aktif"]')?.value ?? fallback;
}

function currentView(): WorkspaceView {
  if (window.location.pathname === "/institusi-periode/kelola-institusi") return "institutions";
  if (window.location.pathname === "/institusi-periode/set-periode-aktif") return "active-period";
  return "main";
}

function isInstitutionPeriodRoute() {
  const legacyHash = window.location.hash.replace(/^#/, "").split("/")[0];
  return window.location.pathname === "/institusi-periode"
    || window.location.pathname.startsWith("/institusi-periode/")
    || legacyHash === "institusi-periode";
}

function navigateWorkspace(view: WorkspaceView) {
  const path = view === "institutions"
    ? "/institusi-periode/kelola-institusi"
    : view === "active-period"
      ? "/institusi-periode/set-periode-aktif"
      : "/institusi-periode";
  if (window.location.pathname !== path) window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function clonePeriod(period: AcademicPeriodConfig): AcademicPeriodConfig {
  return { ...period, stages: period.stages.map((stage) => ({ ...stage, accessRoles: [...stage.accessRoles] })) };
}

function statusLabel(status: string) {
  return status === "active" ? "Aktif" : status === "draft" ? "Draft" : status === "retired" ? "Sebelumnya" : "Ditutup";
}

function stageState(startsAt: string, endsAt: string) {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startsAt) return "Belum dibuka";
  if (today > endsAt) return "Selesai";
  return "Berjalan";
}

function nextSectionLabel(classes: AcademicClassConfig[], courseId: string) {
  const next = Math.max(0, ...classes.filter((item) => item.courseId === courseId).map((item) => item.sectionNumber)) + 1;
  let n = next;
  let label = "";
  while (n > 0) {
    n -= 1;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label || "A";
}

export function InstitutionPeriodPanel({ initialRole }: InstitutionPeriodPanelProps) {
  const [visible, setVisible] = useState(false);
  const [view, setView] = useState<WorkspaceView>("main");
  const [role, setRole] = useState(initialRole);
  const [tab, setTab] = useState<MainTab>("curriculum");
  const [payload, setPayload] = useState<AcademicWorkspacePayload | null>(null);
  const [programId, setProgramId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [stageDraft, setStageDraft] = useState<AcademicPeriodConfig | null>(null);
  const [stageEditing, setStageEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [query, setQuery] = useState("");
  const [courseQuery, setCourseQuery] = useState("");
  const [lecturerQuery, setLecturerQuery] = useState("");
  const [institutionForm, setInstitutionForm] = useState<InstitutionForm>(emptyInstitutionForm);
  const [periodForm, setPeriodForm] = useState<PeriodForm>(emptyPeriodForm);
  const [curriculumForm, setCurriculumForm] = useState<CurriculumForm>(emptyCurriculumForm);
  const [simpleForm, setSimpleForm] = useState<SimpleForm>(emptySimpleForm);
  const [courseForm, setCourseForm] = useState<CourseForm>(emptyCourseForm);
  const [cloForm, setCloForm] = useState<CloForm>(emptyCloForm);
  const [classCourseId, setClassCourseId] = useState("");
  const [classLecturerIds, setClassLecturerIds] = useState<string[]>([]);
  const [editingClass, setEditingClass] = useState<AcademicClassConfig | null>(null);
  const [courseDetailId, setCourseDetailId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState("");
  const [deleteToken, setDeleteToken] = useState("");
  const [activationProgramId, setActivationProgramId] = useState("");
  const [activationPeriodId, setActivationPeriodId] = useState("");
  const [activationConfirmed, setActivationConfirmed] = useState(false);

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let roleSelect: HTMLSelectElement | null = null;
    let roleHandler: (() => void) | null = null;

    const syncRoute = () => {
      const nextVisible = isInstitutionPeriodRoute();
      if (!disposed) {
        setVisible((current) => current === nextVisible ? current : nextVisible);
        if (nextVisible) setView(currentView());
      }
    };
    const syncRole = () => {
      const next = readActiveRole(initialRole);
      if (!disposed) setRole((current) => current === next ? current : next);
    };
    const bindRole = (attempt = 0) => {
      if (disposed) return;
      const select = document.querySelector<HTMLSelectElement>('select[aria-label="Peran aktif"]');
      if (!select) {
        if (attempt < 12) frame = window.requestAnimationFrame(() => bindRole(attempt + 1));
        return;
      }
      roleSelect = select;
      roleHandler = syncRole;
      select.addEventListener("change", roleHandler);
      syncRole();
    };

    syncRoute();
    bindRole();
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
      if (roleSelect && roleHandler) roleSelect.removeEventListener("change", roleHandler);
    };
  }, [initialRole]);

  const refresh = useCallback(async (preferredProgram?: string, preferredPeriod?: string, preferredCurriculum?: string) => {
    setBusy(true);
    const result = await loadAcademicWorkspace();
    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }
    setPayload(result.data);
    const nextProgram = result.data.programs.find((item) => item.id === preferredProgram)
      ?? result.data.programs.find((item) => item.protected)
      ?? result.data.programs[0];
    const nextPeriod = nextProgram?.periods.find((item) => item.id === preferredPeriod)
      ?? nextProgram?.periods.find((item) => item.status === "active")
      ?? nextProgram?.periods.find((item) => item.status === "draft")
      ?? nextProgram?.periods[0];
    const nextCurriculum = nextProgram?.curricula.find((item) => item.id === preferredCurriculum)
      ?? nextProgram?.curricula.find((item) => item.id === nextPeriod?.primaryCurriculumId)
      ?? nextProgram?.curricula.find((item) => item.status === "active")
      ?? nextProgram?.curricula[0];
    setProgramId(nextProgram?.id ?? "");
    setPeriodId(nextPeriod?.id ?? "");
    setCurriculumId(nextCurriculum?.id ?? "");
    setStageDraft(nextPeriod ? clonePeriod(nextPeriod) : null);
    setStageEditing(false);
    setMessage("");
    setBusy(false);
  }, []);

  useEffect(() => {
    if (visible && ["admin", "kaprodi"].includes(role) && !payload && !busy) void refresh();
  }, [busy, payload, refresh, role, visible]);

  const program = useMemo(() => payload?.programs.find((item) => item.id === programId) ?? null, [payload, programId]);
  const period = useMemo(() => program?.periods.find((item) => item.id === periodId) ?? null, [program, periodId]);
  const curriculum = useMemo(() => program?.curricula.find((item) => item.id === curriculumId) ?? null, [program, curriculumId]);
  const periodClasses = useMemo(() => (program?.classes ?? []).filter((item) => item.periodId === periodId), [program, periodId]);
  const allCourses = useMemo(() => program?.curricula.flatMap((item) => item.courses) ?? [], [program]);
  const selectedCourseDetail = useMemo(() => allCourses.find((item) => item.id === courseDetailId) ?? null, [allCourses, courseDetailId]);

  const filteredClasses = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    if (!needle) return periodClasses;
    return periodClasses.filter((item) => `${item.courseCode} ${item.courseName} ${item.className} ${item.curriculumName} ${item.lecturerNames.join(" ")}`.toLocaleLowerCase("id-ID").includes(needle));
  }, [periodClasses, query]);

  const searchableCourses = useMemo(() => {
    const needle = courseQuery.trim().toLocaleLowerCase("id-ID");
    return allCourses
      .filter((item) => item.isAvailableForReoffer)
      .filter((item) => !needle || `${item.code} ${item.name} ${item.curriculumCode} ${item.curriculumName}`.toLocaleLowerCase("id-ID").includes(needle))
      .slice(0, 10);
  }, [allCourses, courseQuery]);

  const filteredLecturers = useMemo(() => {
    const needle = lecturerQuery.trim().toLocaleLowerCase("id-ID");
    return (program?.lecturers ?? []).filter((item) => !needle || `${item.name} ${item.email}`.toLocaleLowerCase("id-ID").includes(needle));
  }, [lecturerQuery, program]);

  const canManageInstitutions = role === "admin" && payload?.canManageInstitutions === true;
  const canSetActivePeriod = role === "admin" && payload?.canSetActivePeriod === true;
  const canEditAcademic = role === "admin" || role === "kaprodi";

  function selectProgram(nextId: string) {
    const next = payload?.programs.find((item) => item.id === nextId) ?? null;
    const nextPeriod = next?.periods.find((item) => item.status === "active") ?? next?.periods.find((item) => item.status === "draft") ?? next?.periods[0] ?? null;
    const nextCurriculum = next?.curricula.find((item) => item.id === nextPeriod?.primaryCurriculumId) ?? next?.curricula.find((item) => item.status === "active") ?? next?.curricula[0] ?? null;
    setProgramId(nextId);
    setPeriodId(nextPeriod?.id ?? "");
    setCurriculumId(nextCurriculum?.id ?? "");
    setStageDraft(nextPeriod ? clonePeriod(nextPeriod) : null);
    setStageEditing(false);
    setCourseDetailId(null);
    setQuery("");
    setMessage("");
  }

  function selectPeriod(nextId: string) {
    const next = program?.periods.find((item) => item.id === nextId) ?? null;
    setPeriodId(nextId);
    setStageDraft(next ? clonePeriod(next) : null);
    setStageEditing(false);
    if (next?.primaryCurriculumId && program?.curricula.some((item) => item.id === next.primaryCurriculumId)) setCurriculumId(next.primaryCurriculumId);
    setQuery("");
    setMessage("");
  }

  function selectCurriculum(nextId: string) {
    setCurriculumId(nextId);
    setCourseDetailId(null);
    setMessage("");
  }

  async function runAndRefresh(action: () => Promise<{ ok: boolean; message: string }>, preferred = { programId, periodId, curriculumId }) {
    if (busy) return false;
    setBusy(true);
    const result = await action();
    setMessage(result.message);
    if (result.ok) {
      setModal(null);
      await refresh(preferred.programId, preferred.periodId, preferred.curriculumId);
      return true;
    }
    setBusy(false);
    return false;
  }

  function openPeriodModal() {
    const activeCurriculum = program?.curricula.find((item) => item.status === "active") ?? program?.curricula[0];
    setPeriodForm({ ...emptyPeriodForm, primaryCurriculumId: activeCurriculum?.id ?? "" });
    setModal("period");
    setMessage("");
  }

  function openCurriculumModal(item?: CurriculumConfig) {
    setCurriculumForm(item ? {
      id: item.id,
      code: item.code,
      name: item.name,
      startYear: item.startYear ? String(item.startYear) : "",
      notes: item.notes,
    } : emptyCurriculumForm);
    setModal("curriculum");
    setMessage("");
  }

  function openSimpleModal(kind: "profile" | "plo" | "group", item?: GraduateProfileConfig | PloConfig | KnowledgeGroupConfig) {
    setSimpleForm(item ? {
      id: item.id,
      code: item.code,
      name: "name" in item ? item.name : "",
      description: item.description,
    } : emptySimpleForm);
    setModal(kind);
    setMessage("");
  }

  function openCourseModal(item?: CurriculumCourseConfig) {
    setCourseForm(item ? {
      id: item.id,
      code: item.code,
      name: item.name,
      credits: String(item.credits),
      semester: item.recommendedSemester ? String(item.recommendedSemester) : "",
      groupId: item.knowledgeGroupId ?? "",
      description: item.description,
      reoffer: item.isAvailableForReoffer,
    } : emptyCourseForm);
    setModal("course");
    setMessage("");
  }

  function openCloModal(course: CurriculumCourseConfig, item?: CloConfig) {
    setCloForm(item ? { id: item.id, courseId: course.id, code: item.code, description: item.description, ploIds: [...item.ploIds] }
      : { ...emptyCloForm, courseId: course.id });
    setModal("clo");
    setMessage("");
  }

  function openClassModal(item?: AcademicClassConfig) {
    setEditingClass(item ?? null);
    setClassCourseId(item?.courseId ?? "");
    setClassLecturerIds(item?.lecturerIds ?? []);
    setCourseQuery(item ? `${item.courseCode} · ${item.courseName}` : "");
    setLecturerQuery("");
    setModal("class");
    setMessage("");
  }

  async function saveStageChanges() {
    if (!stageDraft || !period) return;
    const ok = await runAndRefresh(() => saveAcademicStages({
      periodId: stageDraft.id,
      startsAt: stageDraft.startsAt,
      endsAt: stageDraft.endsAt,
      stages: stageDraft.stages.map((item) => ({ id: item.id, startsAt: item.startsAt, endsAt: item.endsAt })),
    }));
    if (ok) setStageEditing(false);
  }

  async function saveInstitution() {
    const form = institutionForm;
    const action = form.programId
      ? () => updateAcademicProgram({ ...form })
      : () => createAcademicProgram({ ...form });
    const ok = await runAndRefresh(action, { programId: form.programId || programId, periodId, curriculumId });
    if (ok) setInstitutionForm(emptyInstitutionForm);
  }

  if (!visible || !["admin", "kaprodi"].includes(role)) return null;

  if (view === "institutions") {
    return (
      <div className="obe-period-overlay"><div className="obe-period-page">
        <header className="obe-period-heading"><div><button className="obe-back-link" onClick={() => navigateWorkspace("main")} type="button">‹ Institusi &amp; Periode</button><h1>Kelola Institusi</h1><p>Identitas akademik formal yang menjadi batas program studi di OBELIKS.</p></div></header>
        {!canManageInstitutions ? <section className="obe-panel-card obe-empty-panel">Halaman ini hanya dapat diubah oleh Superadmin.</section> : <>
          {message ? <div className="obe-academic-message" role="status">{message}</div> : null}
          <div className="obe-management-layout">
            <aside className="obe-management-list">
              <button className={!institutionForm.programId ? "active" : ""} onClick={() => setInstitutionForm(emptyInstitutionForm)} type="button"><strong>＋ Program studi baru</strong><small>Buat scope akademik baru</small></button>
              {(payload?.programs ?? []).map((item) => <button className={institutionForm.programId === item.id ? "active" : ""} key={item.id} onClick={() => setInstitutionForm({ programId: item.id, universityName: item.universityName, facultyName: item.facultyName, departmentName: item.departmentName, programName: item.programName, programCode: item.programCode })} type="button"><strong>{item.programName}</strong><small>{item.facultyName} · {item.universityName}</small></button>)}
            </aside>
            <section className="obe-panel-card obe-institution-form">
              <div className="obe-section-head"><div><h2>{institutionForm.programId ? "Identitas program studi" : "Tambah program studi"}</h2><p>Struktur minimum: Universitas / Fakultas / Departemen / Program Studi.</p></div>{institutionForm.programId && payload?.programs.find((item) => item.id === institutionForm.programId)?.protected ? <span className="obe-context-badge">Scope utama</span> : null}</div>
              <div className="obe-form-grid">
                <label><span>Nama Universitas / Institusi</span><input maxLength={160} onChange={(event) => setInstitutionForm((current) => ({ ...current, universityName: event.target.value }))} placeholder="Universitas Diponegoro" value={institutionForm.universityName} /></label>
                <label><span>Fakultas / Sekolah</span><input maxLength={160} onChange={(event) => setInstitutionForm((current) => ({ ...current, facultyName: event.target.value }))} placeholder="Fakultas Sains dan Matematika" value={institutionForm.facultyName} /></label>
                <label><span>Departemen</span><input maxLength={160} onChange={(event) => setInstitutionForm((current) => ({ ...current, departmentName: event.target.value }))} placeholder="Departemen Informatika" value={institutionForm.departmentName} /></label>
                <label><span>Program Studi</span><input maxLength={160} onChange={(event) => setInstitutionForm((current) => ({ ...current, programName: event.target.value }))} placeholder="S1 Informatika" value={institutionForm.programName} /></label>
                <label><span>Kode program <small>opsional</small></span><input maxLength={30} onChange={(event) => setInstitutionForm((current) => ({ ...current, programCode: event.target.value }))} placeholder="S1-INF" value={institutionForm.programCode} /></label>
              </div>
              <div className="obe-form-actions"><button className="primary" disabled={busy || !institutionForm.universityName.trim() || !institutionForm.facultyName.trim() || !institutionForm.departmentName.trim() || !institutionForm.programName.trim()} onClick={() => void saveInstitution()} type="button">{busy ? "Menyimpan…" : institutionForm.programId ? "Simpan Identitas" : "Tambah Institusi"}</button>{institutionForm.programId && !payload?.programs.find((item) => item.id === institutionForm.programId)?.protected ? <button className="danger" onClick={() => { setDeleteName(""); setDeleteToken(""); setModal("delete-program"); }} type="button">Hapus</button> : null}</div>
            </section>
          </div>
        </>}
      </div>{modal === "delete-program" ? <ModalShell title="Hapus institusi" busy={busy} onClose={() => setModal(null)}><p className="danger-box">Seluruh kurikulum, periode, kelas, dan mapping di bawah program studi akan terhapus. Konfirmasi dua lapis.</p><label><span>1. Ketik nama program studi persis</span><input autoFocus onChange={(event) => setDeleteName(event.target.value)} value={deleteName} /></label><label><span>2. Ketik HAPUS</span><input onChange={(event) => setDeleteToken(event.target.value)} value={deleteToken} /></label><div className="obe-admin-modal-actions"><button onClick={() => setModal(null)} type="button">Batal</button><button className="danger" disabled={busy || !institutionForm.programId} onClick={() => void runAndRefresh(() => deleteAcademicProgram({ programId: institutionForm.programId, confirmationName: deleteName, finalToken: deleteToken }), { programId: "", periodId: "", curriculumId: "" }).then((ok) => { if (ok) setInstitutionForm(emptyInstitutionForm); })} type="button">Hapus Permanen</button></div></ModalShell> : null}<AcademicStyles /></div>
    );
  }

  if (view === "active-period") {
    const activationProgram = payload?.programs.find((item) => item.id === activationProgramId) ?? payload?.programs.find((item) => item.id === programId) ?? payload?.programs[0] ?? null;
    const activePeriod = activationProgram?.periods.find((item) => item.status === "active") ?? null;
    const draftPeriod = activationProgram?.periods.find((item) => item.status === "draft") ?? null;
    const candidate = activationProgram?.periods.find((item) => item.id === activationPeriodId) ?? draftPeriod;
    return (
      <div className="obe-period-overlay"><div className="obe-period-page">
        <header className="obe-period-heading"><div><button className="obe-back-link" onClick={() => navigateWorkspace("main")} type="button">‹ Institusi &amp; Periode</button><h1>Set Periode Aktif</h1><p>Gerbang resmi untuk menentukan konteks data akademik yang sedang berlaku.</p></div></header>
        {!canSetActivePeriod ? <section className="obe-panel-card obe-empty-panel">Hanya Superadmin yang dapat menetapkan periode aktif.</section> : <>
          {message ? <div className="obe-academic-message" role="status">{message}</div> : null}
          <section className="obe-panel-card obe-activation-card">
            <label className="obe-field"><span>Program studi</span><select onChange={(event) => { setActivationProgramId(event.target.value); setActivationPeriodId(""); setActivationConfirmed(false); }} value={activationProgram?.id ?? ""}>{(payload?.programs ?? []).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
            <div className="obe-period-compare">
              <article><small>PERIODE AKTIF SAAT INI</small><strong>{activePeriod?.label ?? "Belum ditetapkan"}</strong><span>{activePeriod ? `${formatDate(activePeriod.startsAt)} – ${formatDate(activePeriod.endsAt)}` : "—"}</span></article>
              <span className="arrow">→</span>
              <article className="next"><small>CALON PERIODE AKTIF</small>{draftPeriod ? <label><input checked={candidate?.id === draftPeriod.id} onChange={() => { setActivationPeriodId(draftPeriod.id); setActivationConfirmed(false); }} type="radio" /><span><strong>{draftPeriod.label}</strong><small>{formatDate(draftPeriod.startsAt)} – {formatDate(draftPeriod.endsAt)}</small></span></label> : <p>Belum ada periode Draft. Buat satu periode ke depan dari halaman utama.</p>}</article>
            </div>
            {draftPeriod ? <div className="obe-activation-confirm"><label className="check"><input checked={activationConfirmed} onChange={(event) => setActivationConfirmed(event.target.checked)} type="checkbox" /><span>Saya memahami bahwa periode ini akan menjadi konteks aktif untuk kurikulum, tahapan, kelas, RPS, dan akses semester berjalan.</span></label><button className="primary" disabled={busy || !activationConfirmed || !candidate} onClick={() => candidate && activationProgram && void runAndRefresh(() => setActiveAcademicPeriod({ programId: activationProgram.id, periodId: candidate.id }), { programId: activationProgram.id, periodId: candidate.id, curriculumId }).then((ok) => { if (ok) { setActivationConfirmed(false); setActivationPeriodId(""); } })} type="button">Tetapkan Periode Aktif</button></div> : null}
            {activePeriod?.lateModificationUntil ? <p className="obe-context-note">Periode sebelumnya dapat dibuka terbatas melalui late modification sampai {formatDate(activePeriod.lateModificationUntil)}.</p> : null}
          </section>
        </>}
      </div><AcademicStyles /></div>
    );
  }

  return (
    <div className="obe-period-overlay"><div className="obe-period-page">
      <header className="obe-period-heading"><div><p>ADMINISTRASI AKADEMIK</p><h1>Institusi &amp; Periode</h1><span>Kelola konteks akademik formal sebelum RPS, kelas, dan workflow semester berjalan digunakan.</span></div><div className="obe-heading-actions">{canManageInstitutions ? <button onClick={() => { navigateWorkspace("institutions"); setView("institutions"); }} type="button">Kelola Institusi</button> : null}{canSetActivePeriod ? <button className="primary" onClick={() => { setActivationProgramId(programId); setActivationPeriodId(""); setActivationConfirmed(false); navigateWorkspace("active-period"); setView("active-period"); }} type="button">Set Periode Aktif</button> : null}</div></header>
      {message ? <div className="obe-academic-message" role="status">{message}</div> : null}

      <section className="obe-context-lock" aria-label="Konteks program dan periode">
        <label><span>Program Studi</span><select aria-label="Program studi aktif" disabled={busy || !payload?.programs.length} onChange={(event) => selectProgram(event.target.value)} value={programId}>{(payload?.programs ?? []).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
        <label><span>Periode kerja</span><select aria-label="Periode kerja" disabled={busy || !program?.periods.length} onChange={(event) => selectPeriod(event.target.value)} value={periodId}>{(program?.periods ?? []).map((item) => <option key={item.id} value={item.id}>{item.label} · {statusLabel(item.status)}</option>)}</select></label>
        <div className="obe-context-summary">{program ? <><small>{program.facultyName}</small><strong>{program.departmentName}</strong></> : null}</div>
        {program && payload?.canCreatePeriods && !program.periods.some((item) => item.status === "draft") ? <button className="obe-context-add" disabled={busy} onClick={openPeriodModal} type="button">＋ Periode Draft</button> : null}
      </section>

      {period ? <div className="obe-period-strip"><span className={`status ${period.status}`}>{statusLabel(period.status)}</span><strong>{period.label}</strong><span>{formatDate(period.startsAt)} – {formatDate(period.endsAt)}</span>{period.modificationMode === "late" ? <b>Late modification sampai {formatDate(period.lateModificationUntil)}</b> : period.modificationMode === "readonly" ? <b>Read-only</b> : null}</div> : null}

      <nav aria-label="Bagian Institusi dan Periode" className="obe-period-tabs"><button className={tab === "curriculum" ? "active" : ""} onClick={() => setTab("curriculum")} type="button">1. Kurikulum</button><button className={tab === "stages" ? "active" : ""} onClick={() => setTab("stages")} type="button">2. Tahapan</button><button className={tab === "classes" ? "active" : ""} onClick={() => setTab("classes")} type="button">3. Kelas</button></nav>

      {!program ? <section className="obe-panel-card obe-empty-panel">Belum ada program studi yang dapat diakses.</section> : null}

      {program && tab === "curriculum" ? <section className="obe-curriculum-layout">
        <div className="obe-curriculum-toolbar">
          <label><span>Kurikulum</span><select onChange={(event) => selectCurriculum(event.target.value)} value={curriculumId}><option value="">Pilih kurikulum</option>{program.curricula.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name} · {statusLabel(item.status)}</option>)}</select></label>
          <div>{canEditAcademic ? <button onClick={() => openCurriculumModal()} type="button">＋ Kurikulum</button> : null}{curriculum && canEditAcademic ? <button onClick={() => openCurriculumModal(curriculum)} type="button">Ubah Identitas</button> : null}{curriculum && curriculum.status !== "active" && canEditAcademic ? <button className="primary" disabled={busy} onClick={() => void runAndRefresh(() => setActiveCurriculum({ curriculumId: curriculum.id }))} type="button">Jadikan Aktif</button> : null}</div>
        </div>
        {!curriculum ? <section className="obe-panel-card obe-empty-panel">Belum ada kurikulum. Buat kurikulum pertama untuk mulai menyusun Profil Lulusan, CPL, KBK, dan mata kuliah.</section> : <>
          <section className="obe-curriculum-summary"><div><small>KURIKULUM</small><strong>{curriculum.code} · {curriculum.name}</strong><span>{curriculum.startYear ? `Mulai ${curriculum.startYear}` : "Tahun belum ditetapkan"}</span></div><span className={`status ${curriculum.status}`}>{statusLabel(curriculum.status)}</span><div className="stats"><b>{curriculum.graduateProfiles.length}</b><small>Profil Lulusan</small></div><div className="stats"><b>{curriculum.plos.length}</b><small>CPL/PLO</small></div><div className="stats"><b>{curriculum.knowledgeGroups.length}</b><small>KBK</small></div><div className="stats"><b>{curriculum.courses.length}</b><small>MK</small></div></section>
          <div className="obe-curriculum-grid">
            <CurriculumListCard title="Profil Lulusan" subtitle="Graduate profile" aiReady items={curriculum.graduateProfiles.map((item) => ({ id: item.id, code: item.code, title: item.description }))} onAdd={canEditAcademic ? () => openSimpleModal("profile") : undefined} onEdit={canEditAcademic ? (id) => openSimpleModal("profile", curriculum.graduateProfiles.find((item) => item.id === id)) : undefined} onDelete={canEditAcademic ? (id) => window.confirm("Hapus Profil Lulusan ini?") && void runAndRefresh(() => deleteGraduateProfile({ curriculumId: curriculum.id, id })) : undefined} />
            <CurriculumListCard title="CPL / PLO" subtitle="Program Learning Outcomes" aiReady items={curriculum.plos.map((item) => ({ id: item.id, code: item.code, title: item.description }))} onAdd={canEditAcademic ? () => openSimpleModal("plo") : undefined} onEdit={canEditAcademic ? (id) => openSimpleModal("plo", curriculum.plos.find((item) => item.id === id)) : undefined} onDelete={canEditAcademic ? (id) => window.confirm("Hapus CPL/PLO ini dan mapping CPMK terkait?") && void runAndRefresh(() => deletePlo({ curriculumId: curriculum.id, id })) : undefined} />
            <CurriculumListCard title="Kelompok MK / KBK" subtitle="Knowledge groups" items={curriculum.knowledgeGroups.map((item) => ({ id: item.id, code: item.code, title: item.name, detail: item.description }))} onAdd={canEditAcademic ? () => openSimpleModal("group") : undefined} onEdit={canEditAcademic ? (id) => openSimpleModal("group", curriculum.knowledgeGroups.find((item) => item.id === id)) : undefined} onDelete={canEditAcademic ? (id) => window.confirm("Hapus kelompok MK ini? Mata kuliah tetap tersimpan.") && void runAndRefresh(() => deleteKnowledgeGroup({ curriculumId: curriculum.id, id })) : undefined} />
          </div>
          <section className="obe-panel-card obe-course-catalog"><div className="obe-section-head"><div><h2>Mata Kuliah</h2><p>Identitas MK mengikuti baseline RPS: kode, kelompok/KBK, SKS, semester, CPL dan CPMK.</p></div>{canEditAcademic ? <button className="primary" onClick={() => openCourseModal()} type="button">＋ Mata Kuliah</button> : null}</div><div className="obe-course-table"><div className="head"><span>Kode &amp; Mata Kuliah</span><span>KBK</span><span>SKS</span><span>Semester</span><span>CPMK</span><span /></div>{curriculum.courses.map((item) => <div className="row" key={item.id}><span><strong>{item.code}</strong><small>{item.name}</small></span><span>{item.knowledgeGroupCode ?? "—"}</span><span>{item.credits}</span><span>{item.recommendedSemester ?? "—"}</span><span>{item.clos.length}</span><span><button onClick={() => setCourseDetailId(item.id)} type="button">Kelola</button></span></div>)}{!curriculum.courses.length ? <div className="obe-empty-row">Belum ada mata kuliah pada kurikulum ini.</div> : null}</div></section>
        </>}
      </section> : null}

      {program && period && tab === "stages" ? <section className="obe-panel-card"><div className="obe-section-head"><div><h2>Tahapan {period.label}</h2><p>Tanggal tahapan menjadi basis pembukaan akses workflow. Tidak ada kunci manual; klik Ubah untuk mengedit lalu Simpan Perubahan.</p></div>{period.canModify ? <button className={stageEditing ? "primary" : ""} disabled={busy} onClick={() => stageEditing ? void saveStageChanges() : setStageEditing(true)} type="button">{stageEditing ? "Simpan Perubahan" : "Ubah"}</button> : <span className="obe-readonly">Read-only</span>}</div>{stageDraft ? <><div className="obe-period-meta"><label><span>Mulai periode</span><input disabled={!stageEditing} onChange={(event) => setStageDraft((current) => current ? { ...current, startsAt: event.target.value } : current)} type="date" value={stageDraft.startsAt} /></label><label><span>Selesai periode</span><input disabled={!stageEditing} onChange={(event) => setStageDraft((current) => current ? { ...current, endsAt: event.target.value } : current)} type="date" value={stageDraft.endsAt} /></label></div><div className="obe-stage-list detailed">{stageDraft.stages.map((stage, index) => <div className="obe-stage detailed-row" key={stage.id}><i>{index + 1}</i><span><strong>{stage.title}</strong><small>{stage.accessRoles.map((item) => item === "admin" ? "Superadmin" : item.toUpperCase()).join(" · ")}</small></span><div className="obe-stage-dates"><input disabled={!stageEditing} onChange={(event) => setStageDraft((current) => current ? { ...current, stages: current.stages.map((item) => item.id === stage.id ? { ...item, startsAt: event.target.value } : item) } : current)} type="date" value={stage.startsAt} /><span>–</span><input disabled={!stageEditing} onChange={(event) => setStageDraft((current) => current ? { ...current, stages: current.stages.map((item) => item.id === stage.id ? { ...item, endsAt: event.target.value } : item) } : current)} type="date" value={stage.endsAt} /></div><b className={`stage-state ${stageState(stage.startsAt, stage.endsAt).replace(/\s+/g, "-").toLowerCase()}`}>{stageState(stage.startsAt, stage.endsAt)}</b></div>)}</div>{stageEditing ? <div className="obe-edit-note">Perubahan belum berlaku sampai tombol <strong>Simpan Perubahan</strong> ditekan.</div> : null}</> : null}</section> : tab === "stages" && program && !period ? <section className="obe-panel-card obe-empty-panel">Buat atau pilih periode untuk mengelola tahapan.</section> : null}

      {program && period && tab === "classes" ? <section className="obe-panel-card"><div className="obe-section-head"><div><h2>Kelas {period.label}</h2><p>Kelas A, B, C, dan seterusnya dibuat otomatis per mata kuliah. Satu kelas dapat memiliki lebih dari satu dosen pengampu.</p></div>{period.canModify && canEditAcademic ? <button className="primary" disabled={busy || !allCourses.some((item) => item.isAvailableForReoffer) || !program.lecturers.length} onClick={() => openClassModal()} type="button">＋ Tambah Kelas</button> : null}</div>{!program.lecturers.length ? <div className="obe-academic-message">Belum ada akun Dosen aktif pada program studi ini.</div> : null}<div className="obe-class-toolbar"><input aria-label="Cari kelas" onChange={(event) => setQuery(event.target.value)} placeholder="Cari mata kuliah, kurikulum, kelas, atau dosen…" type="search" value={query} /><span>{filteredClasses.length} kelas</span></div><div className="obe-class-table"><div className="obe-class-head"><span>Mata Kuliah</span><span>Kurikulum</span><span>Kelas</span><span>Pengampu</span><span /></div>{filteredClasses.map((item) => <div className="obe-class-row" key={item.id}><span><strong>{item.courseCode}</strong><small>{item.courseName} · {item.credits} SKS</small></span><span><strong>{item.curriculumCode}</strong><small>{item.curriculumName}</small></span><span><strong>{item.className}</strong></span><span className="lecturers">{item.lecturerNames.map((name) => <small key={name}>{name}</small>)}</span><span className="actions">{period.canModify && canEditAcademic ? <><button onClick={() => openClassModal(item)} type="button">Ubah</button><button className="danger-link" onClick={() => window.confirm(`Hapus ${item.courseCode} kelas ${item.className}?`) && void runAndRefresh(() => deleteAcademicClass({ classId: item.id }))} type="button">Hapus</button></> : null}</span></div>)}{!filteredClasses.length ? <div className="obe-empty-row">Belum ada kelas pada periode ini.</div> : null}</div><p className="obe-context-note">Mata kuliah dari kurikulum sebelumnya tetap dapat dipanggil selama status <strong>boleh dijalankan kembali</strong> aktif pada master MK.</p></section> : tab === "classes" && program && !period ? <section className="obe-panel-card obe-empty-panel">Buat atau pilih periode untuk mengelola kelas.</section> : null}
    </div>

    {courseDetailId && selectedCourseDetail ? <div className="obe-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCourseDetailId(null); }}><aside className="obe-course-detail"><div className="obe-admin-modal-head"><div><small>{selectedCourseDetail.curriculumCode}</small><h2>{selectedCourseDetail.code} · {selectedCourseDetail.name}</h2></div><button onClick={() => setCourseDetailId(null)} type="button">×</button></div><div className="obe-course-detail-meta"><span>{selectedCourseDetail.credits} SKS</span><span>Semester {selectedCourseDetail.recommendedSemester ?? "—"}</span><span>{selectedCourseDetail.knowledgeGroupCode ?? "Tanpa KBK"}</span><span>{selectedCourseDetail.isAvailableForReoffer ? "Bisa re-offer" : "Tidak untuk re-offer"}</span></div><p>{selectedCourseDetail.description || "Deskripsi mata kuliah belum diisi."}</p><div className="obe-section-head compact"><div><h2>CPMK / CLO</h2><p>Setiap CPMK dapat dipetakan ke satu atau lebih CPL/PLO.</p></div>{canEditAcademic ? <button className="primary" onClick={() => openCloModal(selectedCourseDetail)} type="button">＋ CPMK</button> : null}</div><div className="obe-clo-list">{selectedCourseDetail.clos.map((item) => <article key={item.id}><div><strong>{item.code}</strong><p>{item.description}</p><small>{item.ploIds.length ? `${item.ploIds.length} CPL terpetakan` : "Belum dipetakan ke CPL"}</small></div>{canEditAcademic ? <span><button onClick={() => openCloModal(selectedCourseDetail, item)} type="button">Ubah</button><button className="danger-link" onClick={() => window.confirm("Hapus CPMK/CLO ini?") && void runAndRefresh(() => deleteClo({ courseId: selectedCourseDetail.id, id: item.id }))} type="button">Hapus</button></span> : null}</article>)}{!selectedCourseDetail.clos.length ? <div className="obe-empty-row">Belum ada CPMK/CLO.</div> : null}</div>{canEditAcademic ? <button className="obe-wide-action" onClick={() => openCourseModal(selectedCourseDetail)} type="button">Ubah Identitas Mata Kuliah</button> : null}</aside></div> : null}

    {modal === "period" ? <ModalShell title="Buat Periode Draft" busy={busy} onClose={() => setModal(null)}><p className="obe-context-note">Hanya satu periode ke depan yang boleh berstatus Draft. Aktivasi dilakukan Superadmin melalui Set Periode Aktif.</p><label><span>Nama periode</span><input autoFocus onChange={(event) => setPeriodForm((current) => ({ ...current, label: event.target.value }))} placeholder="Genap 2026/2027" value={periodForm.label} /></label><div className="two"><label><span>Semester</span><select onChange={(event) => setPeriodForm((current) => ({ ...current, term: event.target.value }))} value={periodForm.term}><option>Gasal</option><option>Genap</option><option>Pendek</option><option>Lainnya</option></select></label><label><span>Tahun akademik</span><input onChange={(event) => setPeriodForm((current) => ({ ...current, academicYear: event.target.value }))} placeholder="2026/2027" value={periodForm.academicYear} /></label></div><div className="two"><label><span>Mulai</span><input onChange={(event) => setPeriodForm((current) => ({ ...current, startsAt: event.target.value }))} type="date" value={periodForm.startsAt} /></label><label><span>Selesai</span><input onChange={(event) => setPeriodForm((current) => ({ ...current, endsAt: event.target.value }))} type="date" value={periodForm.endsAt} /></label></div><label><span>Kurikulum utama</span><select onChange={(event) => setPeriodForm((current) => ({ ...current, primaryCurriculumId: event.target.value }))} value={periodForm.primaryCurriculumId}><option value="">Belum ditetapkan</option>{program?.curricula.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><ModalActions busy={busy} onCancel={() => setModal(null)} onSave={() => program && void runAndRefresh(() => createDraftAcademicPeriod({ programId: program.id, ...periodForm, primaryCurriculumId: periodForm.primaryCurriculumId || null }))} saveLabel="Buat Draft" /></ModalShell> : null}

    {modal === "curriculum" && program ? <ModalShell title={curriculumForm.id ? "Ubah Kurikulum" : "Buat Kurikulum"} busy={busy} onClose={() => setModal(null)}><div className="two"><label><span>Kode</span><input autoFocus onChange={(event) => setCurriculumForm((current) => ({ ...current, code: event.target.value }))} placeholder="KUR-2026" value={curriculumForm.code} /></label><label><span>Tahun mulai</span><input min="1900" max="2200" onChange={(event) => setCurriculumForm((current) => ({ ...current, startYear: event.target.value }))} type="number" value={curriculumForm.startYear} /></label></div><label><span>Nama kurikulum</span><input onChange={(event) => setCurriculumForm((current) => ({ ...current, name: event.target.value }))} placeholder="Kurikulum OBE 2026" value={curriculumForm.name} /></label><label><span>Catatan</span><textarea onChange={(event) => setCurriculumForm((current) => ({ ...current, notes: event.target.value }))} rows={3} value={curriculumForm.notes} /></label><ModalActions busy={busy} onCancel={() => setModal(null)} onSave={() => void runAndRefresh(() => curriculumForm.id ? updateCurriculum({ curriculumId: curriculumForm.id, code: curriculumForm.code, name: curriculumForm.name, startYear: curriculumForm.startYear ? Number(curriculumForm.startYear) : null, notes: curriculumForm.notes }) : createCurriculum({ programId: program.id, code: curriculumForm.code, name: curriculumForm.name, startYear: curriculumForm.startYear ? Number(curriculumForm.startYear) : null }))} saveLabel="Simpan" /></ModalShell> : null}

    {(modal === "profile" || modal === "plo" || modal === "group") && curriculum ? <ModalShell title={modal === "profile" ? "Profil Lulusan" : modal === "plo" ? "CPL / PLO" : "Kelompok MK / KBK"} busy={busy} onClose={() => setModal(null)}><label><span>Kode</span><input autoFocus onChange={(event) => setSimpleForm((current) => ({ ...current, code: event.target.value }))} placeholder={modal === "profile" ? "PL-01" : modal === "plo" ? "CPL-01" : "KBK-01"} value={simpleForm.code} /></label>{modal === "group" ? <label><span>Nama kelompok</span><input onChange={(event) => setSimpleForm((current) => ({ ...current, name: event.target.value }))} value={simpleForm.name} /></label> : null}<label><span>Deskripsi</span><textarea onChange={(event) => setSimpleForm((current) => ({ ...current, description: event.target.value }))} rows={4} value={simpleForm.description} /></label><ModalActions busy={busy} onCancel={() => setModal(null)} onSave={() => void runAndRefresh(() => modal === "profile" ? saveGraduateProfile({ curriculumId: curriculum.id, id: simpleForm.id || undefined, code: simpleForm.code, description: simpleForm.description }) : modal === "plo" ? savePlo({ curriculumId: curriculum.id, id: simpleForm.id || undefined, code: simpleForm.code, description: simpleForm.description }) : saveKnowledgeGroup({ curriculumId: curriculum.id, id: simpleForm.id || undefined, code: simpleForm.code, name: simpleForm.name, description: simpleForm.description }))} saveLabel="Simpan" /></ModalShell> : null}

    {modal === "course" && curriculum ? <ModalShell title={courseForm.id ? "Ubah Mata Kuliah" : "Tambah Mata Kuliah"} busy={busy} onClose={() => setModal(null)}><div className="two"><label><span>Kode MK</span><input autoFocus onChange={(event) => setCourseForm((current) => ({ ...current, code: event.target.value }))} value={courseForm.code} /></label><label><span>Nama MK</span><input onChange={(event) => setCourseForm((current) => ({ ...current, name: event.target.value }))} value={courseForm.name} /></label></div><div className="three"><label><span>SKS</span><input min="0" max="30" step="0.5" onChange={(event) => setCourseForm((current) => ({ ...current, credits: event.target.value }))} type="number" value={courseForm.credits} /></label><label><span>Semester</span><input min="1" max="14" onChange={(event) => setCourseForm((current) => ({ ...current, semester: event.target.value }))} type="number" value={courseForm.semester} /></label><label><span>Kelompok / KBK</span><select onChange={(event) => setCourseForm((current) => ({ ...current, groupId: event.target.value }))} value={courseForm.groupId}><option value="">Tanpa kelompok</option>{curriculum.knowledgeGroups.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label></div><label><span>Deskripsi Mata Kuliah</span><textarea onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))} rows={4} value={courseForm.description} /></label><label className="check"><input checked={courseForm.reoffer} onChange={(event) => setCourseForm((current) => ({ ...current, reoffer: event.target.checked }))} type="checkbox" /><span><strong>Boleh dijalankan kembali</strong><small>MK tetap dapat dipanggil pada periode baru meski kurikulumnya sudah menjadi kurikulum sebelumnya.</small></span></label><ModalActions busy={busy} onCancel={() => setModal(null)} onSave={() => void runAndRefresh(() => saveCurriculumCourse({ curriculumId: curriculum.id, id: courseForm.id || undefined, code: courseForm.code, name: courseForm.name, credits: Number(courseForm.credits), recommendedSemester: courseForm.semester ? Number(courseForm.semester) : null, knowledgeGroupId: courseForm.groupId || null, description: courseForm.description, isAvailableForReoffer: courseForm.reoffer }))} saveLabel="Simpan MK" /></ModalShell> : null}

    {modal === "clo" && selectedCourseDetail && curriculum ? <ModalShell title={cloForm.id ? "Ubah CPMK / CLO" : "Tambah CPMK / CLO"} busy={busy} onClose={() => setModal(null)}><label><span>Kode CPMK</span><input autoFocus onChange={(event) => setCloForm((current) => ({ ...current, code: event.target.value }))} placeholder="CPMK-01" value={cloForm.code} /></label><label><span>Rumusan CPMK yang terukur</span><textarea onChange={(event) => setCloForm((current) => ({ ...current, description: event.target.value }))} rows={4} value={cloForm.description} /></label><fieldset><legend>CPL / PLO yang didukung</legend>{curriculum.plos.map((plo) => <label className="check" key={plo.id}><input checked={cloForm.ploIds.includes(plo.id)} onChange={() => setCloForm((current) => ({ ...current, ploIds: current.ploIds.includes(plo.id) ? current.ploIds.filter((id) => id !== plo.id) : [...current.ploIds, plo.id] }))} type="checkbox" /><span><strong>{plo.code}</strong><small>{plo.description}</small></span></label>)}{!curriculum.plos.length ? <p className="obe-context-note">Tambahkan CPL/PLO terlebih dahulu agar CPMK dapat dipetakan.</p> : null}</fieldset><ModalActions busy={busy} onCancel={() => setModal(null)} onSave={() => void runAndRefresh(() => saveClo({ courseId: cloForm.courseId, id: cloForm.id || undefined, code: cloForm.code, description: cloForm.description, ploIds: cloForm.ploIds }))} saveLabel="Simpan CPMK" /></ModalShell> : null}

    {modal === "class" && program && period ? <ModalShell title={editingClass ? `Ubah Pengampu · ${editingClass.courseCode} Kelas ${editingClass.className}` : "Tambah Kelas"} busy={busy} onClose={() => setModal(null)}>{!editingClass ? <><label><span>Cari mata kuliah</span><input autoFocus onChange={(event) => { setCourseQuery(event.target.value); setClassCourseId(""); }} placeholder="Ketik kode, nama MK, atau kurikulum…" value={courseQuery} /></label><div className="obe-course-picker">{searchableCourses.map((item) => <button className={classCourseId === item.id ? "active" : ""} key={item.id} onClick={() => { setClassCourseId(item.id); setCourseQuery(`${item.code} · ${item.name}`); }} type="button"><span><strong>{item.code} · {item.name}</strong><small>{item.curriculumCode} · {item.curriculumName} · {item.credits} SKS</small></span>{classCourseId === item.id ? <b>✓</b> : null}</button>)}</div>{classCourseId ? <div className="obe-auto-class">Kelas otomatis berikutnya: <strong>{nextSectionLabel(periodClasses, classCourseId)}</strong></div> : null}</> : null}<label><span>Cari dosen pengampu</span><input onChange={(event) => setLecturerQuery(event.target.value)} placeholder="Nama atau email dosen…" value={lecturerQuery} /></label><fieldset className="lecturer-fieldset"><legend>Pengampu · pilih satu atau lebih</legend>{filteredLecturers.map((lecturer) => <label className="check" key={lecturer.id}><input checked={classLecturerIds.includes(lecturer.id)} onChange={() => setClassLecturerIds((current) => current.includes(lecturer.id) ? current.filter((id) => id !== lecturer.id) : [...current, lecturer.id])} type="checkbox" /><span><strong>{lecturer.name}</strong><small>{lecturer.email}</small></span></label>)}</fieldset><ModalActions busy={busy} onCancel={() => setModal(null)} onSave={() => editingClass ? void runAndRefresh(() => updateAcademicClassLecturers({ classId: editingClass.id, lecturerIds: classLecturerIds })) : void runAndRefresh(() => createAcademicClass({ periodId: period.id, courseId: classCourseId, lecturerIds: classLecturerIds }))} saveLabel={editingClass ? "Simpan Pengampu" : "Buat Kelas"} disabled={!editingClass && !classCourseId} /></ModalShell> : null}

    <AcademicStyles />
    </div>
  );
}

function ModalShell({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  return <div className="obe-admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}><section aria-modal="true" className="obe-admin-modal" role="dialog"><div className="obe-admin-modal-head"><h2>{title}</h2><button disabled={busy} onClick={onClose} type="button">×</button></div><div className="obe-admin-modal-body">{children}</div></section></div>;
}

function ModalActions({ busy, onCancel, onSave, saveLabel, disabled = false }: { busy: boolean; onCancel: () => void; onSave: () => void; saveLabel: string; disabled?: boolean }) {
  return <div className="obe-admin-modal-actions"><button disabled={busy} onClick={onCancel} type="button">Batal</button><button className="primary" disabled={busy || disabled} onClick={onSave} type="button">{busy ? "Menyimpan…" : saveLabel}</button></div>;
}

function CurriculumListCard({ title, subtitle, aiReady = false, items, onAdd, onEdit, onDelete }: { title: string; subtitle: string; aiReady?: boolean; items: Array<{ id: string; code: string; title: string; detail?: string }>; onAdd?: () => void; onEdit?: (id: string) => void; onDelete?: (id: string) => void }) {
  return <section className="obe-panel-card obe-curriculum-card"><div className="obe-section-head compact"><div><h2>{title} {aiReady ? <em>AI-ready</em> : null}</h2><p>{subtitle}</p></div>{onAdd ? <button onClick={onAdd} type="button">＋ Tambah</button> : null}</div><div className="obe-master-list">{items.map((item) => <article key={item.id}><b>{item.code}</b><span><strong>{item.title}</strong>{item.detail ? <small>{item.detail}</small> : null}</span>{onEdit || onDelete ? <div>{onEdit ? <button onClick={() => onEdit(item.id)} type="button">Ubah</button> : null}{onDelete ? <button className="danger-link" onClick={() => onDelete(item.id)} type="button">Hapus</button> : null}</div> : null}</article>)}{!items.length ? <div className="obe-empty-row">Belum ada data.</div> : null}</div></section>;
}

function AcademicStyles() {
  return <style jsx global>{`
    .obe-period-overlay { position: fixed; z-index:45; left:264px; right:0; top:66px; bottom:0; overflow:auto; background:#f5f7f9; color:#17212b; }
    .obe-period-page { width:min(100%,1480px); margin:0 auto; padding:26px 28px 60px; }
    .obe-period-heading { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:18px; }
    .obe-period-heading p { margin:0 0 5px; color:#08766f; font-size:10px; font-weight:850; letter-spacing:.1em; }
    .obe-period-heading h1 { margin:0 0 7px; color:#081c2b; font-size:30px; letter-spacing:-.035em; }.obe-period-heading span { color:#687683; font-size:12px; }
    .obe-heading-actions { display:flex; gap:8px; }.obe-heading-actions button,.obe-context-add,.obe-curriculum-toolbar button,.obe-back-link { min-height:36px; border:1px solid #d8e0e6; border-radius:9px; background:#fff; color:#175cd3; font-weight:750; font-size:10px; padding:0 12px; }.obe-heading-actions .primary,.obe-curriculum-toolbar .primary { border-color:#2176ff; background:#2176ff; color:#fff; }
    .obe-back-link { border:0!important; padding:0!important; min-height:26px!important; background:transparent!important; color:#175cd3!important; }
    .obe-academic-message { margin-bottom:13px; border:1px solid #cfe1f5; border-radius:9px; background:#f3f8fe; color:#24445e; padding:10px 12px; font-size:10px; }
    .obe-context-lock { display:grid; grid-template-columns:minmax(220px,1.4fr) minmax(210px,1fr) minmax(220px,1fr) auto; gap:10px; align-items:end; margin-bottom:10px; border:1px solid #dfe6eb; border-radius:12px; background:#fff; padding:12px; }
    .obe-context-lock label,.obe-field,.obe-admin-modal-body label,.obe-institution-form label { display:grid; gap:5px; }.obe-context-lock label>span,.obe-field>span,.obe-admin-modal-body label>span,.obe-institution-form label>span { color:#6b7885; font-size:9px; font-weight:800; letter-spacing:.05em; text-transform:uppercase; }
    .obe-context-lock select,.obe-field select,.obe-admin-modal-body input,.obe-admin-modal-body select,.obe-admin-modal-body textarea,.obe-institution-form input,.obe-period-meta input,.obe-class-toolbar input { width:100%; min-height:37px; border:1px solid #dbe3e8; border-radius:8px; background:#fff; color:#17212b; padding:0 10px; font:inherit; font-size:10px; outline:none; }.obe-admin-modal-body textarea { padding:9px 10px; resize:vertical; }
    .obe-context-summary { display:grid; gap:3px; align-self:center; }.obe-context-summary small { color:#7a8793; font-size:9px; }.obe-context-summary strong { font-size:11px; }
    .obe-context-add { white-space:nowrap; }.obe-period-strip { display:flex; align-items:center; gap:9px; min-height:34px; margin-bottom:10px; padding:0 4px; font-size:9px; color:#6d7985; }.obe-period-strip strong { color:#17212b; font-size:10px; }.obe-period-strip b { margin-left:auto; color:#9a5a00; }
    .status { display:inline-flex; align-items:center; border-radius:999px; padding:5px 8px; font-size:8px; font-weight:850; text-transform:uppercase; }.status.active { background:#dcf5e8; color:#087443; }.status.draft { background:#fff2cf; color:#945d00; }.status.closed,.status.retired { background:#edf0f3; color:#65717d; }
    .obe-period-tabs { display:flex; gap:5px; margin-bottom:17px; border-bottom:1px solid #dde5ea; }.obe-period-tabs button { border:0; border-bottom:2px solid transparent; background:transparent; color:#667482; padding:10px 14px; font-size:11px; font-weight:780; }.obe-period-tabs button.active { border-bottom-color:#2176ff; color:#102b3f; }
    .obe-panel-card { border:1px solid #e1e7ec; border-radius:13px; background:#fff; box-shadow:0 8px 24px rgba(16,43,63,.045); padding:18px; }.obe-empty-panel { color:#667482; font-size:11px; }
    .obe-section-head { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; margin-bottom:14px; }.obe-section-head.compact { margin-bottom:10px; }.obe-section-head h2 { margin:0; color:#0b2638; font-size:14px; }.obe-section-head p { margin:4px 0 0; color:#71808d; font-size:10px; line-height:1.45; }.obe-section-head h2 em { margin-left:5px; border-radius:999px; background:#f0ebff; color:#7047b8; padding:3px 6px; font-size:7px; font-style:normal; text-transform:uppercase; }
    .obe-section-head button,.obe-class-row button,.obe-course-table button,.obe-master-list button,.obe-clo-list button,.obe-wide-action { min-height:32px; border:1px solid #d9e1e6; border-radius:8px; background:#fff; color:#175cd3; font-size:9px; font-weight:750; padding:0 10px; }.obe-section-head button.primary { border-color:#2176ff; background:#2176ff; color:#fff; }.obe-readonly { border-radius:999px; background:#edf1f4; color:#677582; padding:6px 9px; font-size:8px; font-weight:800; }
    .obe-curriculum-layout { display:grid; gap:13px; }.obe-curriculum-toolbar { display:flex; align-items:end; justify-content:space-between; gap:15px; border:1px solid #e1e7ec; border-radius:11px; background:#fff; padding:11px 12px; }.obe-curriculum-toolbar label { min-width:300px; display:grid; gap:5px; }.obe-curriculum-toolbar label span { color:#71808d; font-size:9px; font-weight:800; }.obe-curriculum-toolbar select { min-height:37px; border:1px solid #dbe3e8; border-radius:8px; background:#fff; padding:0 9px; font-size:10px; }.obe-curriculum-toolbar>div { display:flex; gap:7px; }
    .obe-curriculum-summary { display:grid; grid-template-columns:minmax(250px,1.4fr) auto repeat(4,minmax(80px,.35fr)); align-items:center; gap:10px; border:1px solid #dfe7eb; border-radius:12px; background:#fff; padding:13px 15px; }.obe-curriculum-summary>div:first-child { display:grid; gap:3px; }.obe-curriculum-summary>div:first-child small { color:#7b8894; font-size:8px; font-weight:800; }.obe-curriculum-summary>div:first-child strong { font-size:12px; }.obe-curriculum-summary>div:first-child span { color:#71808d; font-size:9px; }.obe-curriculum-summary .stats { display:grid; justify-items:center; gap:2px; border-left:1px solid #edf1f3; }.obe-curriculum-summary .stats b { font-size:16px; }.obe-curriculum-summary .stats small { color:#778590; font-size:8px; }
    .obe-curriculum-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }.obe-curriculum-card { min-height:230px; }.obe-master-list { display:grid; gap:5px; max-height:280px; overflow:auto; }.obe-master-list article { display:grid; grid-template-columns:58px minmax(0,1fr) auto; gap:8px; align-items:start; border-top:1px solid #edf1f3; padding:9px 0; }.obe-master-list article:first-child { border-top:0; }.obe-master-list article>b { color:#08766f; font-size:9px; }.obe-master-list article span strong,.obe-master-list article span small { display:block; }.obe-master-list article span strong { font-size:9px; line-height:1.4; }.obe-master-list article span small { margin-top:3px; color:#7a8793; font-size:8px; }.obe-master-list article>div { display:flex; gap:4px; }
    .danger-link,.obe-master-list .danger-link,.obe-clo-list .danger-link { border-color:transparent!important; background:transparent!important; color:#b42318!important; }.obe-course-catalog { margin-top:0; }.obe-course-table { overflow:hidden; border:1px solid #e6ebee; border-radius:9px; }.obe-course-table .head,.obe-course-table .row { display:grid; grid-template-columns:1.8fr .7fr .35fr .45fr .4fr 70px; gap:9px; align-items:center; padding:9px 11px; }.obe-course-table .head { background:#f7f9fa; color:#76838e; font-size:8px; font-weight:800; }.obe-course-table .row { border-top:1px solid #edf1f3; font-size:9px; }.obe-course-table .row strong,.obe-course-table .row small { display:block; }.obe-course-table .row small { margin-top:2px; color:#778590; }
    .obe-period-meta { display:grid; grid-template-columns:repeat(2,minmax(0,220px)); gap:10px; margin-bottom:10px; }.obe-period-meta label { display:grid; gap:5px; }.obe-period-meta label span { color:#71808d; font-size:9px; font-weight:800; }.obe-period-meta input:disabled,.obe-stage-dates input:disabled { background:#f5f7f8; color:#65737e; }
    .obe-stage-list { display:grid; }.obe-stage { min-height:62px; display:grid; grid-template-columns:25px minmax(0,1fr) minmax(285px,auto) 95px; align-items:center; gap:10px; border-top:1px solid #edf1f3; }.obe-stage:first-child { border-top:0; }.obe-stage>i { width:23px; height:23px; display:grid; place-items:center; border-radius:50%; background:#eef3f5; color:#52707e; font-size:9px; font-style:normal; }.obe-stage strong,.obe-stage small { display:block; }.obe-stage strong { font-size:10px; }.obe-stage small { margin-top:3px; color:#7a8793; font-size:8px; }.obe-stage-dates { display:flex; align-items:center; gap:5px; }.obe-stage-dates input { width:126px; min-height:34px; border:1px solid #dce4e8; border-radius:7px; padding:0 8px; font-size:9px; }.stage-state { justify-self:end; border-radius:999px; padding:5px 7px; background:#edf2f6; color:#596977; font-size:7px; }.stage-state.berjalan { background:#def5ea; color:#087443; }.stage-state.belum-dibuka { background:#fff2cf; color:#915b00; }.obe-edit-note { margin-top:11px; border-radius:8px; background:#fff8e8; color:#805400; padding:9px 10px; font-size:9px; }
    .obe-class-toolbar { display:flex; align-items:center; gap:10px; margin-bottom:10px; }.obe-class-toolbar input { flex:1; max-width:500px; }.obe-class-toolbar span { color:#778590; font-size:9px; }.obe-class-table { overflow:hidden; border:1px solid #e5eaee; border-radius:10px; }.obe-class-head,.obe-class-row { display:grid; grid-template-columns:1.25fr .8fr .35fr 1.3fr 105px; align-items:center; gap:10px; padding:10px 12px; }.obe-class-head { background:#f7f9fa; color:#74818c; font-size:8px; font-weight:800; }.obe-class-row { border-top:1px solid #edf1f3; font-size:9px; }.obe-class-row strong,.obe-class-row small { display:block; }.obe-class-row small { margin-top:2px; color:#778590; }.obe-class-row .lecturers { display:grid; gap:2px; }.obe-class-row .actions { display:flex; gap:3px; justify-content:flex-end; }.obe-empty-row { padding:14px; color:#7a8793; font-size:9px; text-align:center; }.obe-context-note { margin:10px 0 0; color:#71808d; font-size:9px; line-height:1.5; }
    .obe-admin-modal-backdrop,.obe-detail-backdrop { position:fixed; z-index:700; inset:0; display:grid; place-items:center; background:rgba(6,20,30,.42); backdrop-filter:blur(2px); }.obe-admin-modal { width:min(620px,calc(100vw - 30px)); max-height:88vh; overflow:auto; border-radius:14px; background:#fff; box-shadow:0 22px 70px rgba(5,21,33,.28); }.obe-admin-modal-head { display:flex; align-items:center; justify-content:space-between; gap:12px; border-bottom:1px solid #edf1f3; padding:14px 16px; }.obe-admin-modal-head h2 { margin:0; color:#102b3f; font-size:14px; }.obe-admin-modal-head small { color:#778590; font-size:8px; }.obe-admin-modal-head>button { width:30px; height:30px; border:0; border-radius:8px; background:#f2f5f6; color:#53616c; font-size:18px; }.obe-admin-modal-body { display:grid; gap:11px; padding:15px 16px 16px; }.obe-admin-modal-body .two { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }.obe-admin-modal-body .three { display:grid; grid-template-columns:.45fr .55fr 1fr; gap:10px; }.obe-admin-modal-body fieldset { max-height:260px; overflow:auto; margin:0; border:1px solid #e2e8ec; border-radius:9px; padding:8px; }.obe-admin-modal-body legend { color:#6f7d88; font-size:9px; font-weight:800; padding:0 4px; }.check { display:grid!important; grid-template-columns:18px minmax(0,1fr); align-items:start; gap:7px!important; border-radius:7px; padding:7px!important; text-transform:none!important; }.check:hover { background:#f6f9fa; }.check input { width:14px!important; min-height:14px!important; margin-top:1px; }.check span strong,.check span small { display:block; }.check span strong { color:#24313d; font-size:9px; }.check span small { margin-top:2px; color:#778590; font-size:8px; line-height:1.4; }.obe-admin-modal-actions { display:flex; justify-content:flex-end; gap:7px; margin-top:4px; border-top:1px solid #edf1f3; padding-top:11px; }.obe-admin-modal-actions button { min-height:34px; border:1px solid #d8e0e5; border-radius:8px; background:#fff; color:#40515e; padding:0 12px; font-size:9px; font-weight:750; }.obe-admin-modal-actions .primary { border-color:#2176ff; background:#2176ff; color:#fff; }.obe-admin-modal-actions .danger,.obe-form-actions .danger { border-color:#f0c4c1; color:#b42318; }.danger-box { margin:0; border:1px solid #f3c6c3; border-radius:8px; background:#fff5f4; color:#912018; padding:9px 10px; font-size:9px; }
    .obe-course-picker { display:grid; gap:4px; max-height:220px; overflow:auto; border:1px solid #e1e7eb; border-radius:9px; padding:5px; }.obe-course-picker button { width:100%; display:flex; justify-content:space-between; gap:10px; border:0; border-radius:7px; background:#fff; padding:8px; text-align:left; }.obe-course-picker button:hover,.obe-course-picker button.active { background:#edf8f6; }.obe-course-picker strong,.obe-course-picker small { display:block; }.obe-course-picker strong { font-size:9px; }.obe-course-picker small { margin-top:2px; color:#778590; font-size:8px; }.obe-course-picker b { color:#08766f; }.obe-auto-class { border-radius:8px; background:#eef7ff; color:#35516a; padding:9px 10px; font-size:9px; }.obe-auto-class strong { font-size:13px; color:#175cd3; }.lecturer-fieldset { max-height:230px!important; }
    .obe-detail-backdrop { justify-items:end; }.obe-course-detail { width:min(520px,92vw); height:100%; overflow:auto; background:#fff; box-shadow:-20px 0 60px rgba(5,21,33,.2); padding-bottom:20px; }.obe-course-detail-meta { display:flex; flex-wrap:wrap; gap:5px; padding:14px 16px 0; }.obe-course-detail-meta span { border-radius:999px; background:#f0f4f6; color:#60717d; padding:5px 7px; font-size:8px; }.obe-course-detail>p { margin:12px 16px 18px; color:#657481; font-size:9px; line-height:1.6; }.obe-course-detail>.obe-section-head,.obe-clo-list,.obe-wide-action { margin-left:16px; margin-right:16px; }.obe-clo-list { display:grid; gap:7px; }.obe-clo-list article { display:flex; justify-content:space-between; gap:10px; border:1px solid #e5eaed; border-radius:9px; padding:10px; }.obe-clo-list article strong { color:#08766f; font-size:9px; }.obe-clo-list article p { margin:4px 0; font-size:9px; line-height:1.45; }.obe-clo-list article small { color:#778590; font-size:8px; }.obe-clo-list article>span { display:flex; gap:3px; }.obe-wide-action { width:calc(100% - 32px); margin-top:12px; }
    .obe-management-layout { display:grid; grid-template-columns:290px minmax(0,1fr); gap:12px; }.obe-management-list { display:grid; align-content:start; gap:5px; }.obe-management-list button { width:100%; display:grid; gap:3px; border:1px solid #e0e6ea; border-radius:9px; background:#fff; padding:10px 11px; text-align:left; }.obe-management-list button.active { border-color:#92c8c3; background:#edf8f6; }.obe-management-list strong { font-size:10px; }.obe-management-list small { color:#778590; font-size:8px; }.obe-institution-form { min-height:390px; }.obe-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }.obe-form-actions { display:flex; gap:7px; margin-top:14px; }.obe-form-actions button { min-height:36px; border:1px solid #d8e0e5; border-radius:8px; background:#fff; color:#40515e; padding:0 13px; font-size:9px; font-weight:750; }.obe-form-actions .primary { border-color:#2176ff; background:#2176ff; color:#fff; }.obe-context-badge { border-radius:999px; background:#e8f5ff; color:#175cd3!important; padding:5px 8px; font-size:8px!important; font-weight:800; }
    .obe-activation-card { max-width:920px; margin:0 auto; }.obe-activation-card>.obe-field { max-width:420px; margin-bottom:16px; }.obe-period-compare { display:grid; grid-template-columns:1fr 45px 1fr; align-items:stretch; gap:8px; }.obe-period-compare article { display:grid; gap:7px; border:1px solid #e3e9ec; border-radius:11px; padding:16px; }.obe-period-compare article>small { color:#7a8793; font-size:8px; font-weight:850; }.obe-period-compare article>strong { font-size:16px; }.obe-period-compare article>span { color:#6c7b87; font-size:9px; }.obe-period-compare .arrow { display:grid; place-items:center; color:#8a98a2; font-size:20px; }.obe-period-compare article.next { background:#f8fafb; }.obe-period-compare article.next label { display:grid; grid-template-columns:18px 1fr; gap:8px; }.obe-period-compare article.next label strong,.obe-period-compare article.next label small { display:block; }.obe-period-compare article.next label strong { font-size:13px; }.obe-period-compare article.next label small { margin-top:4px; color:#778590; font-size:8px; }.obe-period-compare article.next p { margin:0; color:#778590; font-size:9px; }.obe-activation-confirm { display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:15px; border-top:1px solid #edf1f3; padding-top:14px; }.obe-activation-confirm .check { flex:1; }.obe-activation-confirm>button { min-height:38px; border:0; border-radius:8px; background:#2176ff; color:#fff; padding:0 14px; font-size:9px; font-weight:800; }
    @media (max-width:1050px) { .obe-context-lock { grid-template-columns:1fr 1fr; }.obe-curriculum-grid { grid-template-columns:1fr; }.obe-curriculum-summary { grid-template-columns:1fr auto repeat(2,80px); }.obe-course-table { overflow:auto; }.obe-course-table .head,.obe-course-table .row { min-width:720px; }.obe-class-table { overflow:auto; }.obe-class-head,.obe-class-row { min-width:760px; }.obe-stage { grid-template-columns:25px 1fr; padding:8px 0; }.obe-stage-dates { grid-column:2; }.obe-stage>.stage-state { grid-column:2; justify-self:start; }.obe-management-layout { grid-template-columns:1fr; }.obe-management-list { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:920px) { .obe-period-overlay { left:0; }.obe-period-page { padding:20px 15px 48px; } }
    @media (max-width:640px) { .obe-period-heading,.obe-curriculum-toolbar,.obe-activation-confirm { flex-direction:column; align-items:stretch; }.obe-heading-actions,.obe-curriculum-toolbar>div { flex-wrap:wrap; }.obe-context-lock,.obe-form-grid,.obe-admin-modal-body .two,.obe-admin-modal-body .three { grid-template-columns:1fr; }.obe-curriculum-summary { grid-template-columns:1fr auto; }.obe-curriculum-summary .stats { display:none; }.obe-period-compare { grid-template-columns:1fr; }.obe-period-compare .arrow { transform:rotate(90deg); }.obe-management-list { grid-template-columns:1fr; } }
  `}</style>;
}
