"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAcademicInstitution,
  createAcademicPeriod,
  createCurriculum,
  deleteAcademicInstitution,
  loadAcademicWorkspace,
  setActiveAcademicPeriod,
  type AcademicWorkspacePayload,
  type CurriculumView,
  type PeriodView,
  type ProgramView,
} from "./institution-period-actions";
import styles from "./clean-workspace.module.css";

type InstitutionPeriodPanelProps = { initialRole: string };
type PeriodDirection = "previous" | "next";

function getPath() {
  return typeof window === "undefined" ? "" : window.location.pathname.replace(/\/$/, "") || "/";
}

function go(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("obeliks:navigation"));
}

function badgeTone(status: CurriculumView["status"] | PeriodView["status"]) {
  if (status === "active") return styles.green;
  if (status === "draft") return styles.amber;
  return styles.gray;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function emptyPeriod(direction: PeriodDirection) {
  return {
    label: "",
    term: "Gasal" as const,
    academicYear: "",
    startsAt: "",
    endsAt: "",
    curriculumId: "",
    direction,
  };
}

function curriculumForPeriod(program: ProgramView, period: PeriodView | null) {
  if (!period?.curriculumId) return null;
  return program.curricula.find((item) => item.id === period.curriculumId) ?? null;
}

function periodNeighbors(program: ProgramView) {
  const ordered = [...program.periods].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const active = ordered.find((item) => item.status === "active") ?? null;
  if (!active) return { previous: ordered.filter((item) => item.status === "closed").at(-1) ?? null, active: null, next: ordered.find((item) => item.status === "draft") ?? null };
  const index = ordered.findIndex((item) => item.id === active.id);
  const previous = ordered.slice(0, index).reverse().find((item) => item.status === "closed") ?? null;
  const next = ordered.slice(index + 1).find((item) => item.status === "draft") ?? ordered.find((item) => item.status === "draft") ?? null;
  return { previous, active, next };
}

function CurriculumInspector({ program, period, curriculum }: { program: ProgramView; period: PeriodView | null; curriculum: CurriculumView | null }) {
  const [query, setQuery] = useState("");
  const courses = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    const list = curriculum?.courses ?? [];
    return needle ? list.filter((item) => `${item.code} ${item.name} ${item.groupName ?? ""}`.toLocaleLowerCase("id-ID").includes(needle)) : list;
  }, [curriculum, query]);
  const mappedCourses = curriculum?.courses.filter((item) => item.mappedPloCount > 0).length ?? 0;
  const gapCount = curriculum ? Math.max(0, curriculum.courses.length - mappedCourses) : 0;
  const nav = [
    ["curriculum-summary", "Ringkasan"],
    ["curriculum-courses", "Mata Kuliah"],
    ["curriculum-map", "Curriculum Map"],
    ["curriculum-coverage", "CPL Coverage"],
    ["curriculum-progression", "I-R-M Progression"],
    ["curriculum-gaps", "Gap & Recommendation"],
  ] as const;

  return (
    <>
      <header className={styles.heading}>
        <div>
          <button className={styles.ghost} onClick={() => go("/institusi-periode/periode-aktif")} type="button">← Periode Aktif</button>
          <h1>Kurikulum Inspector</h1>
          <p>{program.programName}{period ? ` · ${period.label}` : ""}{curriculum ? ` · ${curriculum.name}` : ""}</p>
        </div>
      </header>
      {!curriculum ? <div className={styles.notice}>Periode ini belum memiliki kurikulum utama. Pilih atau buat kurikulum dari halaman Periode Aktif.</div> : (
        <div className={styles.inspectorGrid}>
          <nav aria-label="Curriculum Inspector navigation" className={styles.inspectorNav}>
            {nav.map(([id,label]) => <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })} type="button">{label}</button>)}
          </nav>
          <div className={styles.inspectorMain}>
            <section className={styles.inspectorSection} id="curriculum-summary"><header><h2>Program & Kurikulum</h2><p>Ringkasan struktur kurikulum berdasarkan data aplikasi.</p></header><div className={styles.metrics}><article className={styles.metric}><span>Profil Lulusan</span><strong>{curriculum.graduateProfileCount}</strong></article><article className={styles.metric}><span>CPL / PLO</span><strong>{curriculum.ploCount}</strong></article><article className={styles.metric}><span>KBK</span><strong>{curriculum.knowledgeGroupCount}</strong></article><article className={styles.metric}><span>Mata Kuliah</span><strong>{curriculum.courses.length}</strong></article><article className={styles.metric}><span>MK terpetakan</span><strong>{mappedCourses}</strong></article></div></section>

            <section className={styles.inspectorSection} id="curriculum-courses"><header><h2>Mata Kuliah</h2><p>Katalog MK pada kurikulum yang dipilih.</p></header><div><div className={styles.toolbar}><input className={styles.search} onChange={(event) => setQuery(event.target.value)} placeholder="Cari kode, mata kuliah, atau KBK…" type="search" value={query} /><span className={`${styles.badge} ${styles.gray}`}>{courses.length} MK</span></div><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>MK</th><th>Semester</th><th>SKS</th><th>KBK</th><th>CPMK/CLO</th><th>PLO mapped</th></tr></thead><tbody>{courses.map((course) => <tr key={course.id}><td><strong>{course.code}</strong><small>{course.name}</small></td><td>{course.semester ?? "—"}</td><td>{course.credits}</td><td>{course.groupName ?? "—"}</td><td>{course.cloCount}</td><td>{course.mappedPloCount}</td></tr>)}{!courses.length ? <tr><td colSpan={6}><div className={styles.empty}><div><strong>Belum ada mata kuliah</strong><span>Inspector tidak menampilkan data contoh.</span></div></div></td></tr> : null}</tbody></table></div></div></section>

            <section className={styles.inspectorSection} id="curriculum-map"><header><h2>Curriculum Map</h2><p>Struktur pemetaan MK → CPMK/CLO → CPL/PLO.</p></header><div>{curriculum.courses.length ? <div className={styles.miniList}>{curriculum.courses.map((course) => <div className={styles.miniRow} key={course.id}><strong>{course.code}</strong><span>{course.name}</span><span className={`${styles.badge} ${course.mappedPloCount ? styles.green : styles.amber}`}>{course.mappedPloCount ? `${course.mappedPloCount} PLO` : "Belum map"}</span></div>)}</div> : <div className={styles.empty}>Belum ada data pemetaan.</div>}</div></section>

            <section className={styles.inspectorSection} id="curriculum-coverage"><header><h2>CPL Coverage</h2><p>Cakupan awal berbasis jumlah mata kuliah yang telah memiliki mapping PLO.</p></header><div>{curriculum.ploCount ? <div className={styles.notice}>{mappedCourses} dari {curriculum.courses.length} mata kuliah sudah memiliki mapping ke CPL/PLO. Analisis coverage per-PLO akan semakin detail setelah matriks CPL–CPMK terisi.</div> : <div className={styles.empty}>CPL/PLO belum tersedia.</div>}</div></section>

            <section className={styles.inspectorSection} id="curriculum-progression"><header><h2>I-R-M Progression</h2><p>Introductory – Reinforce – Mastery.</p></header><div className={styles.empty}><div><strong>Belum ada level I-R-M</strong><span>Data I-R-M tidak dibuat otomatis tanpa baseline yang sah.</span></div></div></section>

            <section className={styles.inspectorSection} id="curriculum-gaps"><header><h2>Gap & Recommendation</h2><p>Pemeriksaan dasar konsistensi kurikulum.</p></header><div>{gapCount ? <div className={`${styles.issue} ${styles.issueWarn}`}><strong>{gapCount} mata kuliah belum memiliki mapping CPL/PLO</strong>Lengkapi CPMK/CLO dan mapping CPL sebelum RPS disusun.</div> : curriculum.courses.length ? <div className={`${styles.issue} ${styles.issueGood}`}><strong>Tidak ada gap mapping dasar</strong>Seluruh mata kuliah yang tersimpan telah memiliki minimal satu mapping PLO.</div> : <div className={styles.empty}>Belum ada data untuk dianalisis.</div>}</div></section>
          </div>
          <aside className={`${styles.card} ${styles.inspectorSide}`}><div className={styles.cardHeader}><div><h2>Curriculum Inspector</h2><p>Program intelligence</p></div></div><div className={styles.cardBody}><div className={styles.miniList}><div className={styles.miniRow}><strong>MK</strong><span>Total</span><b>{curriculum.courses.length}</b></div><div className={styles.miniRow}><strong>Mapped</strong><span>Ke PLO</span><b>{mappedCourses}</b></div><div className={styles.miniRow}><strong>Gap</strong><span>Belum map</span><b>{gapCount}</b></div></div></div></aside>
        </div>
      )}
    </>
  );
}

export function InstitutionPeriodPanel({ initialRole }: InstitutionPeriodPanelProps) {
  const [path, setPath] = useState("");
  const [payload, setPayload] = useState<AcademicWorkspacePayload | null>(null);
  const [programId, setProgramId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [institutionForm, setInstitutionForm] = useState({ universityName: "", facultyName: "", departmentName: "", programName: "", programCode: "" });
  const [showInstitutionForm, setShowInstitutionForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProgramView | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteToken, setDeleteToken] = useState("");
  const [periodForm, setPeriodForm] = useState(emptyPeriod("next"));
  const [showPeriodForm, setShowPeriodForm] = useState<PeriodDirection | null>(null);
  const [curriculumForm, setCurriculumForm] = useState({ code: "", name: "", startYear: "" });
  const [showCurriculumForm, setShowCurriculumForm] = useState(false);
  const [selectedActivePeriod, setSelectedActivePeriod] = useState("");
  const [selectedCurriculum, setSelectedCurriculum] = useState("");

  useEffect(() => {
    const sync = () => setPath(getPath());
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("obeliks:navigation", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("obeliks:navigation", sync);
    };
  }, []);

  const visible = path === "/institusi-periode" || path.startsWith("/institusi-periode/");
  const refresh = useCallback(async () => {
    setBusy(true);
    const result = await loadAcademicWorkspace();
    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }
    setPayload(result.data);
    setProgramId((current) => result.data.programs.some((item) => item.id === current) ? current : result.data.programs[0]?.id ?? "");
    setMessage("");
    setBusy(false);
  }, []);

  useEffect(() => {
    if (visible && !payload && !busy) void refresh();
  }, [busy, payload, refresh, visible]);

  const program = useMemo(() => payload?.programs.find((item) => item.id === programId) ?? null, [payload, programId]);
  const neighbors = useMemo(() => program ? periodNeighbors(program) : { previous: null, active: null, next: null }, [program]);

  useEffect(() => {
    if (!program) return;
    setSelectedActivePeriod(neighbors.active?.id ?? neighbors.next?.id ?? neighbors.previous?.id ?? "");
    setSelectedCurriculum(neighbors.active?.curriculumId ?? program.curricula.find((item) => item.status === "active")?.id ?? program.curricula[0]?.id ?? "");
  }, [neighbors.active?.id, neighbors.active?.curriculumId, neighbors.next?.id, neighbors.previous?.id, program]);

  async function submitInstitution() {
    setBusy(true);
    const result = await createAcademicInstitution(institutionForm);
    setMessage(result.message);
    if (result.ok) {
      setInstitutionForm({ universityName: "", facultyName: "", departmentName: "", programName: "", programCode: "" });
      setShowInstitutionForm(false);
      await refresh();
    } else setBusy(false);
  }

  async function removeInstitution() {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteAcademicInstitution({ programId: deleteTarget.id, confirmation: deleteConfirmation, finalToken: deleteToken });
    setMessage(result.message);
    if (result.ok) {
      setDeleteTarget(null); setDeleteConfirmation(""); setDeleteToken("");
      await refresh();
    } else setBusy(false);
  }

  async function submitPeriod() {
    if (!program || !showPeriodForm) return;
    setBusy(true);
    const result = await createAcademicPeriod({
      programId: program.id,
      direction: showPeriodForm,
      label: periodForm.label,
      term: periodForm.term,
      academicYear: periodForm.academicYear,
      startsAt: periodForm.startsAt,
      endsAt: periodForm.endsAt,
      curriculumId: periodForm.curriculumId || null,
    });
    setMessage(result.message);
    if (result.ok) {
      setShowPeriodForm(null); setPeriodForm(emptyPeriod("next"));
      await refresh();
    } else setBusy(false);
  }

  async function submitCurriculum() {
    if (!program) return;
    setBusy(true);
    const year = curriculumForm.startYear ? Number(curriculumForm.startYear) : null;
    const result = await createCurriculum({ programId: program.id, code: curriculumForm.code, name: curriculumForm.name, startYear: Number.isFinite(year) ? year : null });
    setMessage(result.message);
    if (result.ok) {
      setCurriculumForm({ code: "", name: "", startYear: "" }); setShowCurriculumForm(false);
      await refresh();
    } else setBusy(false);
  }

  async function saveActivePeriod() {
    if (!program || !selectedActivePeriod || !selectedCurriculum) return;
    setBusy(true);
    const result = await setActiveAcademicPeriod({ programId: program.id, periodId: selectedActivePeriod, curriculumId: selectedCurriculum });
    setMessage(result.message);
    if (result.ok) await refresh(); else setBusy(false);
  }

  if (!visible || !["admin", "kaprodi"].includes(initialRole)) return null;

  const subview = path.split("/")[2] ?? "";
  const inspectorParams = typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
  const inspectorProgram = payload?.programs.find((item) => item.id === inspectorParams.get("program")) ?? program;
  const inspectorPeriod = inspectorProgram?.periods.find((item) => item.id === inspectorParams.get("period")) ?? null;
  const inspectorCurriculum = inspectorProgram?.curricula.find((item) => item.id === inspectorParams.get("curriculum")) ?? curriculumForPeriod(inspectorProgram as ProgramView, inspectorPeriod);

  return (
    <div className={styles.overlay} data-clean-workspace="institusi-periode">
      <main className={styles.page}>
        {path === "/institusi-periode" ? (
          <header className={styles.heading}>
            <h1>Institusi &amp; Periode</h1>
            <div className={styles.actions}>
              {payload?.canManageInstitutions ? <button className={styles.secondary} onClick={() => go("/institusi-periode/kelola-institusi")} type="button">Kelola Institusi</button> : null}
              <button className={styles.primary} onClick={() => go("/institusi-periode/periode-aktif")} type="button">Periode Aktif</button>
            </div>
          </header>
        ) : null}

        {message ? <div className={styles.notice} role="status">{message}</div> : null}

        {subview === "kelola-institusi" ? (
          <>
            <header className={styles.heading}><div><button className={styles.ghost} onClick={() => go("/institusi-periode")} type="button">← Institusi &amp; Periode</button><h1>Kelola Institusi</h1><p>Struktur formal: Universitas/Institusi → Fakultas/Sekolah → Departemen → Program Studi.</p></div>{payload?.canManageInstitutions ? <button className={styles.primary} onClick={() => setShowInstitutionForm((value) => !value)} type="button">+ Program Studi</button> : null}</header>
            {!payload?.canManageInstitutions ? <div className={styles.error}>Kelola Institusi hanya tersedia untuk Superadmin.</div> : null}
            {showInstitutionForm && payload?.canManageInstitutions ? <section className={styles.card}><div className={styles.cardHeader}><div><h2>Program Studi Baru</h2><p>Semua level minimum wajib diisi.</p></div></div><div className={styles.cardBody}><div className={styles.formGrid}><label className={styles.label}>Universitas / Institusi<input className={styles.input} onChange={(e)=>setInstitutionForm(v=>({...v,universityName:e.target.value}))} value={institutionForm.universityName}/></label><label className={styles.label}>Fakultas / Sekolah<input className={styles.input} onChange={(e)=>setInstitutionForm(v=>({...v,facultyName:e.target.value}))} value={institutionForm.facultyName}/></label><label className={styles.label}>Departemen<input className={styles.input} onChange={(e)=>setInstitutionForm(v=>({...v,departmentName:e.target.value}))} value={institutionForm.departmentName}/></label><label className={styles.label}>Program Studi<input className={styles.input} onChange={(e)=>setInstitutionForm(v=>({...v,programName:e.target.value}))} value={institutionForm.programName}/></label><label className={styles.label}>Kode Program (opsional)<input className={styles.input} onChange={(e)=>setInstitutionForm(v=>({...v,programCode:e.target.value}))} value={institutionForm.programCode}/></label></div><div className={styles.formActions}><button className={styles.secondary} onClick={()=>setShowInstitutionForm(false)} type="button">Batal</button><button className={styles.primary} disabled={busy} onClick={()=>void submitInstitution()} type="button">Simpan</button></div></div></section> : null}
            <section className={styles.card}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Universitas / Institusi</th><th>Fakultas / Sekolah</th><th>Departemen</th><th>Program Studi</th><th>Aksi</th></tr></thead><tbody>{(payload?.programs ?? []).map((item)=><tr key={item.id}><td>{item.universityName}</td><td>{item.facultyName}</td><td>{item.departmentName}</td><td><strong>{item.programName}</strong><small>{item.programCode ?? "Tanpa kode"}</small></td><td>{payload?.canManageInstitutions && !item.protected ? <button className={styles.danger} onClick={()=>{setDeleteTarget(item);setDeleteConfirmation("");setDeleteToken("");}} type="button">Hapus</button> : <span className={`${styles.badge} ${styles.gray}`}>{item.protected ? "Scope utama" : "Read-only"}</span>}</td></tr>)}{!payload?.programs.length ? <tr><td colSpan={5}><div className={styles.empty}><div><strong>Belum ada institusi akademik</strong><span>Tambahkan program studi untuk memulai.</span></div></div></td></tr> : null}</tbody></table></div></section>
            {deleteTarget ? <section className={styles.card}><div className={styles.cardHeader}><div><h2>Konfirmasi penghapusan</h2><p>Penghapusan bersifat destruktif dan memerlukan dua konfirmasi.</p></div></div><div className={styles.cardBody}><div className={styles.formGrid}><label className={styles.label}>Ketik nama program: {deleteTarget.programName}<input className={styles.input} onChange={(e)=>setDeleteConfirmation(e.target.value)} value={deleteConfirmation}/></label><label className={styles.label}>Ketik HAPUS<input className={styles.input} onChange={(e)=>setDeleteToken(e.target.value)} value={deleteToken}/></label></div><div className={styles.formActions}><button className={styles.secondary} onClick={()=>setDeleteTarget(null)} type="button">Batal</button><button className={styles.danger} disabled={busy} onClick={()=>void removeInstitution()} type="button">Hapus permanen</button></div></div></section> : null}
          </>
        ) : null}

        {subview === "periode-aktif" ? (
          <>
            <header className={styles.heading}><div><button className={styles.ghost} onClick={() => go("/institusi-periode")} type="button">← Institusi &amp; Periode</button><h1>Periode Aktif</h1><p>Pilih program studi, periode aktif, dan kurikulum yang sedang digunakan.</p></div></header>
            <section className={styles.card}><div className={styles.toolbar}><select aria-label="Program studi" className={styles.select} onChange={(e)=>setProgramId(e.target.value)} value={programId}><option value="">Pilih program studi</option>{(payload?.programs ?? []).map((item)=><option key={item.id} value={item.id}>{item.programName} · {item.universityName}</option>)}</select>{program ? <><select aria-label="Periode aktif pilihan" className={styles.select} onChange={(e)=>setSelectedActivePeriod(e.target.value)} value={selectedActivePeriod}><option value="">Pilih periode</option>{program.periods.map((item)=><option key={item.id} value={item.id}>{item.label} · {item.status}</option>)}</select><select aria-label="Kurikulum aktif pilihan" className={styles.select} onChange={(e)=>setSelectedCurriculum(e.target.value)} value={selectedCurriculum}><option value="">Pilih kurikulum</option>{program.curricula.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.status}</option>)}</select></> : null}{payload?.canSetActivePeriod && program ? <button className={styles.primary} disabled={!selectedActivePeriod || !selectedCurriculum || busy} onClick={()=>void saveActivePeriod()} type="button">Tetapkan Periode Aktif</button> : null}</div></section>
            {program ? <div className={styles.periodFlow}>
              <article className={styles.periodCard}>{neighbors.previous ? <><span className={`${styles.badge} ${badgeTone(neighbors.previous.status)}`}>Sebelumnya</span><h3>{neighbors.previous.label}</h3><p>{formatDate(neighbors.previous.startsAt)} – {formatDate(neighbors.previous.endsAt)}</p><p>Kurikulum: {neighbors.previous.curriculumName ?? "Belum dipilih"}</p><div className={styles.actions}><button className={styles.secondary} onClick={()=>go(`/institusi-periode/kurikulum-inspector?program=${program.id}&period=${neighbors.previous!.id}&curriculum=${neighbors.previous!.curriculumId ?? ""}`)} type="button">Kurikulum Inspector</button></div></> : <><span className={`${styles.badge} ${styles.gray}`}>Sebelumnya</span><h3>Belum ada</h3><p>Tambahkan periode historis bila diperlukan.</p><div className={styles.actions}><button className={styles.secondary} onClick={()=>{setShowPeriodForm("previous");setPeriodForm(emptyPeriod("previous"));}} type="button">+ Buat sebelumnya</button></div></>}</article>
              <div className={styles.periodArrow} aria-hidden="true">←</div>
              <article className={`${styles.periodCard} ${styles.periodCardActive}`}>{neighbors.active ? <><span className={`${styles.badge} ${styles.green}`}>Aktif</span><h3>{neighbors.active.label}</h3><p>{formatDate(neighbors.active.startsAt)} – {formatDate(neighbors.active.endsAt)}</p><p>Kurikulum: {neighbors.active.curriculumName ?? "Belum dipilih"}</p><p>Tahapan: {neighbors.active.currentStage ?? "Belum ada tahapan aktif"}</p><div className={styles.actions}><button className={styles.primary} onClick={()=>go(`/institusi-periode/kurikulum-inspector?program=${program.id}&period=${neighbors.active!.id}&curriculum=${neighbors.active!.curriculumId ?? ""}`)} type="button">Kurikulum Inspector</button></div></> : <><span className={`${styles.badge} ${styles.amber}`}>Aktif</span><h3>Belum ditetapkan</h3><p>Pilih periode dan kurikulum di atas lalu tetapkan sebagai aktif.</p></>}</article>
              <div className={styles.periodArrow} aria-hidden="true">→</div>
              <article className={styles.periodCard}>{neighbors.next ? <><span className={`${styles.badge} ${badgeTone(neighbors.next.status)}`}>Berikutnya · Draft</span><h3>{neighbors.next.label}</h3><p>{formatDate(neighbors.next.startsAt)} – {formatDate(neighbors.next.endsAt)}</p><p>Kurikulum: {neighbors.next.curriculumName ?? "Belum dipilih"}</p><div className={styles.actions}><button className={styles.secondary} onClick={()=>go(`/institusi-periode/kurikulum-inspector?program=${program.id}&period=${neighbors.next!.id}&curriculum=${neighbors.next!.curriculumId ?? ""}`)} type="button">Kurikulum Inspector</button></div></> : <><span className={`${styles.badge} ${styles.gray}`}>Berikutnya</span><h3>Belum ada Draft</h3><p>Buat satu periode ke depan ketika dibutuhkan.</p><div className={styles.actions}><button className={styles.secondary} onClick={()=>{setShowPeriodForm("next");setPeriodForm(emptyPeriod("next"));}} type="button">+ Buat berikutnya</button></div></>}</article>
            </div> : <div className={styles.empty}><div><strong>Belum ada program studi</strong><span>Superadmin perlu mengisi Kelola Institusi terlebih dahulu.</span></div></div>}

            {program && !program.curricula.length ? <section className={styles.card}><div className={styles.cardHeader}><div><h2>Kurikulum belum tersedia</h2><p>Buat kurikulum Draft sebelum menetapkan periode aktif.</p></div><button className={styles.secondary} onClick={()=>setShowCurriculumForm(true)} type="button">+ Kurikulum</button></div></section> : program ? <div className={styles.actions} style={{marginTop:16}}><button className={styles.secondary} onClick={()=>setShowCurriculumForm(true)} type="button">+ Kurikulum Draft</button></div> : null}
            {showCurriculumForm && program ? <section className={styles.card}><div className={styles.cardHeader}><div><h2>Kurikulum Draft Baru</h2></div></div><div className={styles.cardBody}><div className={styles.formGrid}><label className={styles.label}>Kode<input className={styles.input} onChange={(e)=>setCurriculumForm(v=>({...v,code:e.target.value}))} value={curriculumForm.code}/></label><label className={styles.label}>Nama kurikulum<input className={styles.input} onChange={(e)=>setCurriculumForm(v=>({...v,name:e.target.value}))} value={curriculumForm.name}/></label><label className={styles.label}>Tahun mulai (opsional)<input className={styles.input} inputMode="numeric" onChange={(e)=>setCurriculumForm(v=>({...v,startYear:e.target.value}))} value={curriculumForm.startYear}/></label></div><div className={styles.formActions}><button className={styles.secondary} onClick={()=>setShowCurriculumForm(false)} type="button">Batal</button><button className={styles.primary} disabled={busy} onClick={()=>void submitCurriculum()} type="button">Buat Draft</button></div></div></section> : null}
            {showPeriodForm && program ? <section className={styles.card}><div className={styles.cardHeader}><div><h2>Buat periode {showPeriodForm === "previous" ? "sebelumnya" : "berikutnya"}</h2><p>{showPeriodForm === "next" ? "Periode berikutnya disimpan sebagai Draft." : "Periode historis disimpan sebagai Closed."}</p></div></div><div className={styles.cardBody}><div className={styles.formGrid4}><label className={styles.label}>Label<input className={styles.input} onChange={(e)=>setPeriodForm(v=>({...v,label:e.target.value}))} placeholder="Gasal 2026/2027" value={periodForm.label}/></label><label className={styles.label}>Term<select className={styles.select} onChange={(e)=>setPeriodForm(v=>({...v,term:e.target.value as typeof v.term}))} value={periodForm.term}><option>Gasal</option><option>Genap</option><option>Pendek</option><option>Lainnya</option></select></label><label className={styles.label}>Tahun akademik<input className={styles.input} onChange={(e)=>setPeriodForm(v=>({...v,academicYear:e.target.value}))} placeholder="2026/2027" value={periodForm.academicYear}/></label><label className={styles.label}>Kurikulum<select className={styles.select} onChange={(e)=>setPeriodForm(v=>({...v,curriculumId:e.target.value}))} value={periodForm.curriculumId}><option value="">Belum ditentukan</option>{program.curricula.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={styles.label}>Mulai<input className={styles.input} onChange={(e)=>setPeriodForm(v=>({...v,startsAt:e.target.value}))} type="date" value={periodForm.startsAt}/></label><label className={styles.label}>Selesai<input className={styles.input} onChange={(e)=>setPeriodForm(v=>({...v,endsAt:e.target.value}))} type="date" value={periodForm.endsAt}/></label></div><div className={styles.formActions}><button className={styles.secondary} onClick={()=>setShowPeriodForm(null)} type="button">Batal</button><button className={styles.primary} disabled={busy} onClick={()=>void submitPeriod()} type="button">Simpan</button></div></div></section> : null}
          </>
        ) : null}

        {subview === "kurikulum-inspector" && inspectorProgram ? <CurriculumInspector program={inspectorProgram} period={inspectorPeriod} curriculum={inspectorCurriculum} /> : null}
        {subview === "kurikulum-inspector" && !inspectorProgram ? <><header className={styles.heading}><div><button className={styles.ghost} onClick={()=>go("/institusi-periode/periode-aktif")} type="button">← Periode Aktif</button><h1>Kurikulum Inspector</h1></div></header><div className={styles.empty}>Program studi tidak ditemukan.</div></> : null}
      </main>
    </div>
  );
}
