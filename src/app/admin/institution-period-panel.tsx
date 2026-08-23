"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAcademicInstitution,
  createAcademicPeriod,
  deleteAcademicClass,
  deleteAcademicInstitution,
  loadAcademicWorkspace,
  saveAcademicSchedule,
  upsertAcademicClass,
  type AcademicClassConfig,
  type AcademicInstitutionConfig,
  type AcademicPeriodConfig,
  type AcademicWorkspacePayload,
} from "./institution-period-actions";

type PeriodTab = "summary" | "period" | "classes";
type Modal = "institution" | "period" | "delete-institution" | "class" | null;

type InstitutionPeriodPanelProps = { initialRole: string };

function formatDate(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${value}T00:00:00`));
}

function readActiveRole(fallback: string) {
  return document.querySelector<HTMLSelectElement>('select[aria-label="Peran aktif"]')?.value ?? fallback;
}

function isInstitutionPeriodRoute() {
  const legacyHash = window.location.hash.replace(/^#/, "").split("/")[0];
  return window.location.pathname === "/institusi-periode" || legacyHash === "institusi-periode";
}

function clonePeriod(period: AcademicPeriodConfig): AcademicPeriodConfig {
  return {
    ...period,
    stages: period.stages.map((stage) => ({ ...stage })),
    classes: period.classes.map((item) => ({ ...item, lecturerIds: [...item.lecturerIds], lecturerNames: [...item.lecturerNames] })),
  };
}

export function InstitutionPeriodPanel({ initialRole }: InstitutionPeriodPanelProps) {
  const [visible, setVisible] = useState(false);
  const [role, setRole] = useState(initialRole);
  const [tab, setTab] = useState<PeriodTab>("summary");
  const [payload, setPayload] = useState<AcademicWorkspacePayload | null>(null);
  const [institutionId, setInstitutionId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState<AcademicPeriodConfig | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [newInstitutionName, setNewInstitutionName] = useState("");
  const [deleteName, setDeleteName] = useState("");
  const [deleteToken, setDeleteToken] = useState("");
  const [newPeriod, setNewPeriod] = useState({ label: "", startsAt: "", endsAt: "" });
  const [editingClass, setEditingClass] = useState<AcademicClassConfig | null>(null);
  const [classCourse, setClassCourse] = useState("");
  const [className, setClassName] = useState("");
  const [classLecturers, setClassLecturers] = useState<string[]>([]);

  useEffect(() => {
    let disposed = false;
    let frame = 0;
    let roleSelect: HTMLSelectElement | null = null;
    let roleHandler: (() => void) | null = null;

    const syncRoute = () => {
      const next = isInstitutionPeriodRoute();
      if (!disposed) setVisible((current) => current === next ? current : next);
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

  const refresh = useCallback(async (preferredInstitution?: string, preferredPeriod?: string) => {
    setBusy(true);
    const result = await loadAcademicWorkspace();
    if (!result.ok) {
      setMessage(result.message);
      setBusy(false);
      return;
    }
    setPayload(result.data);
    const nextInstitution = result.data.institutions.find((item) => item.id === preferredInstitution)
      ?? result.data.institutions.find((item) => item.protected)
      ?? result.data.institutions[0];
    const nextPeriod = nextInstitution?.periods.find((item) => item.id === preferredPeriod)
      ?? nextInstitution?.periods[0];
    setInstitutionId(nextInstitution?.id ?? "");
    setPeriodId(nextPeriod?.id ?? "");
    setScheduleDraft(nextPeriod ? clonePeriod(nextPeriod) : null);
    setMessage("");
    setBusy(false);
  }, []);

  useEffect(() => {
    if (visible && ["admin", "kaprodi"].includes(role) && !payload && !busy) void refresh();
  }, [busy, payload, refresh, role, visible]);

  const institution = useMemo(
    () => payload?.institutions.find((item) => item.id === institutionId) ?? null,
    [institutionId, payload],
  );
  const period = useMemo(
    () => institution?.periods.find((item) => item.id === periodId) ?? null,
    [institution, periodId],
  );

  useEffect(() => {
    if (!institution) return;
    if (!institution.periods.some((item) => item.id === periodId)) {
      const next = institution.periods[0];
      setPeriodId(next?.id ?? "");
      setScheduleDraft(next ? clonePeriod(next) : null);
    }
  }, [institution, periodId]);

  const filteredClasses = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    const items = period?.classes ?? [];
    if (!needle) return items;
    return items.filter((item) => `${item.courseCode} ${item.courseName} ${item.className} ${item.lecturerNames.join(" ")}`.toLocaleLowerCase("id-ID").includes(needle));
  }, [period, query]);

  const canManageInstitutions = role === "admin" && payload?.canManageInstitutions === true;
  const canManagePeriods = role === "admin" && payload?.canManagePeriods === true;
  const canAssign = role === "admin" || role === "kaprodi";

  function selectInstitution(nextId: string) {
    const nextInstitution = payload?.institutions.find((item) => item.id === nextId) ?? null;
    const nextPeriod = nextInstitution?.periods[0] ?? null;
    setInstitutionId(nextId);
    setPeriodId(nextPeriod?.id ?? "");
    setScheduleDraft(nextPeriod ? clonePeriod(nextPeriod) : null);
    setTab("summary");
    setQuery("");
    setMessage("");
  }

  function selectPeriod(nextId: string) {
    const next = institution?.periods.find((item) => item.id === nextId) ?? null;
    setPeriodId(nextId);
    setScheduleDraft(next ? clonePeriod(next) : null);
    setTab("summary");
    setQuery("");
    setMessage("");
  }

  async function createInstitution() {
    if (busy) return;
    setBusy(true);
    const result = await createAcademicInstitution({ name: newInstitutionName });
    setMessage(result.message);
    if (result.ok) {
      setNewInstitutionName("");
      setModal(null);
      await refresh();
    } else setBusy(false);
  }

  async function removeInstitution() {
    if (!institution || busy) return;
    setBusy(true);
    const result = await deleteAcademicInstitution({ institutionId: institution.id, confirmationName: deleteName, finalToken: deleteToken });
    setMessage(result.message);
    if (result.ok) {
      setDeleteName("");
      setDeleteToken("");
      setModal(null);
      await refresh();
    } else setBusy(false);
  }

  async function createPeriod() {
    if (!institution || busy) return;
    setBusy(true);
    const result = await createAcademicPeriod({ institutionId: institution.id, ...newPeriod });
    setMessage(result.message);
    if (result.ok) {
      setNewPeriod({ label: "", startsAt: "", endsAt: "" });
      setModal(null);
      await refresh(institution.id);
    } else setBusy(false);
  }

  async function saveSchedule() {
    if (!institution || !scheduleDraft || busy) return;
    setBusy(true);
    const result = await saveAcademicSchedule({
      institutionId: institution.id,
      periodId: scheduleDraft.id,
      startsAt: scheduleDraft.startsAt,
      endsAt: scheduleDraft.endsAt,
      dateLocked: scheduleDraft.dateLocked,
      stages: scheduleDraft.stages.map(({ stage, startsAt, endsAt, locked }) => ({ stage, startsAt, endsAt, locked })),
    });
    setMessage(result.message);
    if (result.ok) await refresh(institution.id, scheduleDraft.id);
    else setBusy(false);
  }

  function openClassEditor(item?: AcademicClassConfig) {
    setEditingClass(item ?? null);
    setClassCourse(item?.courseCode ?? institution?.courses[0]?.code ?? "");
    setClassName(item?.className ?? "");
    setClassLecturers(item?.lecturerIds ?? []);
    setModal("class");
    setMessage("");
  }

  async function saveClass() {
    if (!institution || !period || busy) return;
    setBusy(true);
    const result = await upsertAcademicClass({
      institutionId: institution.id,
      periodId: period.id,
      classId: editingClass?.id,
      courseCode: classCourse,
      className,
      lecturerIds: classLecturers,
    });
    setMessage(result.message);
    if (result.ok) {
      setModal(null);
      await refresh(institution.id, period.id);
    } else setBusy(false);
  }

  async function removeClass(item: AcademicClassConfig) {
    if (!institution || !period || busy || !window.confirm(`Hapus pemetaan ${item.courseCode} kelas ${item.className}?`)) return;
    setBusy(true);
    const result = await deleteAcademicClass({ institutionId: institution.id, periodId: period.id, classId: item.id });
    setMessage(result.message);
    if (result.ok) await refresh(institution.id, period.id);
    else setBusy(false);
  }

  if (!visible || !["admin", "kaprodi"].includes(role)) return null;

  return (
    <div className="obe-period-overlay">
      <div className="obe-period-page">
        <header className="obe-period-heading">
          <div><p>ADMINISTRASI AKADEMIK</p><h1>Institusi &amp; Periode</h1></div>
          {busy ? <span className="obe-period-status">MEMPROSES…</span> : <span className="obe-period-status">AKTIF</span>}
        </header>

        {message ? <div className="obe-academic-message" role="status">{message}</div> : null}

        <section className="obe-context-lock" aria-label="Konteks institusi dan periode">
          <label>
            <span>🔒 Institusi</span>
            <select aria-label="Institusi aktif" disabled={busy || !payload?.institutions.length} onChange={(event) => selectInstitution(event.target.value)} value={institutionId}>
              {(payload?.institutions ?? []).map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}
            </select>
          </label>
          <label>
            <span>Periode</span>
            <select aria-label="Periode aktif" disabled={busy || !institution?.periods.length} onChange={(event) => selectPeriod(event.target.value)} value={periodId}>
              {(institution?.periods ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <div className="obe-context-actions">
            {canManageInstitutions ? <button onClick={() => setModal("institution")} type="button">+ Institusi</button> : null}
            {canManageInstitutions && institution && !institution.protected ? <button className="danger" onClick={() => { setDeleteName(""); setDeleteToken(""); setModal("delete-institution"); }} type="button">Hapus institusi</button> : null}
            {canManagePeriods && institution ? <button onClick={() => setModal("period")} type="button">+ Periode</button> : null}
          </div>
          {institution?.protected ? <small className="obe-lock-note">Institusi baseline dikunci: S1 - Informatika UNDIP.</small> : null}
        </section>

        <nav aria-label="Bagian Institusi dan Periode" className="obe-period-tabs">
          <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")} type="button">Ringkasan</button>
          <button className={tab === "period" ? "active" : ""} onClick={() => setTab("period")} type="button">Periode &amp; Tahapan</button>
          <button className={tab === "classes" ? "active" : ""} onClick={() => setTab("classes")} type="button">Kelas &amp; Pengampu</button>
        </nav>

        {!institution ? <section className="obe-panel-card obe-empty-panel">Belum ada institusi yang dapat diakses.</section> : !period ? (
          <section className="obe-panel-card obe-empty-panel">Belum ada periode pada <strong>{institution.displayName}</strong>. {canManagePeriods ? "Buat periode baru untuk melanjutkan." : "Hubungi Superadmin."}</section>
        ) : null}

        {institution && period && tab === "summary" ? (
          <div className="obe-period-stack">
            <section className="obe-stat-grid">
              <article><strong>{institution.courses.length}</strong><span>Mata kuliah</span></article>
              <article><strong>{period.classes.length}</strong><span>Kelas periode ini</span></article>
              <article><strong>{new Set(period.classes.flatMap((item) => item.lecturerNames)).size}</strong><span>Pengampu terpetakan</span></article>
              <article><strong>{period.stages.filter((item) => item.locked).length}/6</strong><span>Tahap terkunci</span></article>
            </section>
            <section className="obe-panel-card">
              <div className="obe-section-head"><div><h2>{institution.displayName}</h2><p>{period.label} · {formatDate(period.startsAt)} – {formatDate(period.endsAt)}</p></div><button onClick={() => setTab("period")} type="button">Atur tanggal &gt;</button></div>
              <div className="obe-stage-list">
                {period.stages.map((stage) => <div className="obe-stage" key={stage.id}><i>{stage.locked ? "🔒" : "○"}</i><span><strong>{stage.title}</strong><small>{formatDate(stage.startsAt)} – {formatDate(stage.endsAt)}</small></span><b className={stage.locked ? "locked" : "open"}>{stage.locked ? "Terkunci" : "Terbuka"}</b></div>)}
              </div>
            </section>
          </div>
        ) : null}

        {institution && period && tab === "period" && scheduleDraft ? (
          <section className="obe-panel-card">
            <div className="obe-section-head"><div><h2>Periode &amp; Tahapan</h2><p>Semua tanggal mengikuti institusi dan periode yang sedang dipilih.</p></div>{canManagePeriods ? <button className="primary" disabled={busy} onClick={() => void saveSchedule()} type="button">Simpan pengaturan</button> : <span className="obe-readonly">Read-only</span>}</div>
            <div className="obe-period-meta">
              <label><span>Mulai periode</span><input disabled={!canManagePeriods || period.dateLocked || busy} onChange={(event) => setScheduleDraft((current) => current ? { ...current, startsAt: event.target.value } : current)} type="date" value={scheduleDraft.startsAt} /></label>
              <label><span>Selesai periode</span><input disabled={!canManagePeriods || period.dateLocked || busy} onChange={(event) => setScheduleDraft((current) => current ? { ...current, endsAt: event.target.value } : current)} type="date" value={scheduleDraft.endsAt} /></label>
              <button className={`obe-lock-button ${scheduleDraft.dateLocked ? "locked" : ""}`} disabled={!canManagePeriods || busy} onClick={() => setScheduleDraft((current) => current ? { ...current, dateLocked: !current.dateLocked } : current)} type="button">{scheduleDraft.dateLocked ? "🔒 Buka kunci tanggal" : "🔓 Kunci tanggal periode"}</button>
            </div>
            {period.dateLocked && !scheduleDraft.dateLocked ? <p className="obe-unlock-note">Simpan dulu untuk membuka kunci. Setelah tersimpan, tanggal baru dapat diedit.</p> : null}
            <div className="obe-stage-list detailed">
              {scheduleDraft.stages.map((stage, index) => {
                const persisted = period.stages.find((item) => item.stage === stage.stage);
                const wasLocked = persisted?.locked === true;
                return <div className="obe-stage detailed-row" key={stage.id}>
                  <i>{stage.locked ? "🔒" : String(index + 1)}</i>
                  <span><strong>{stage.title}</strong><small>{stage.locked ? "Tanggal tahap dikunci" : "Tanggal tahap dapat diatur"}</small></span>
                  <div className="obe-stage-dates">
                    <input disabled={!canManagePeriods || period.dateLocked || wasLocked || busy} onChange={(event) => setScheduleDraft((current) => current ? { ...current, stages: current.stages.map((item) => item.stage === stage.stage ? { ...item, startsAt: event.target.value } : item) } : current)} type="date" value={stage.startsAt} />
                    <span>–</span>
                    <input disabled={!canManagePeriods || period.dateLocked || wasLocked || busy} onChange={(event) => setScheduleDraft((current) => current ? { ...current, stages: current.stages.map((item) => item.stage === stage.stage ? { ...item, endsAt: event.target.value } : item) } : current)} type="date" value={stage.endsAt} />
                    {canManagePeriods ? <button className="mini-lock" disabled={busy || period.dateLocked} onClick={() => setScheduleDraft((current) => current ? { ...current, stages: current.stages.map((item) => item.stage === stage.stage ? { ...item, locked: !item.locked } : item) } : current)} type="button">{stage.locked ? "Buka kunci" : "Kunci"}</button> : null}
                  </div>
                </div>;
              })}
            </div>
          </section>
        ) : null}

        {institution && period && tab === "classes" ? (
          <section className="obe-panel-card">
            <div className="obe-section-head"><div><h2>Kelas &amp; Pengampu</h2><p>Satu mata kuliah dapat memiliki banyak kelas dan satu kelas dapat memiliki banyak pengampu.</p></div>{canAssign ? <button className="primary" disabled={busy || !institution.courses.length || !institution.lecturers.length} onClick={() => openClassEditor()} type="button">+ Tambah kelas</button> : null}</div>
            {!institution.lecturers.length ? <div className="obe-academic-message">Belum ada akun Dosen aktif pada institusi ini. Tambahkan peran Dosen terlebih dahulu sebelum membuat pemetaan baru.</div> : null}
            <div className="obe-class-toolbar"><input aria-label="Cari pemetaan kelas" onChange={(event) => setQuery(event.target.value)} placeholder="Cari mata kuliah, kelas, atau pengampu…" type="search" value={query} /><span>{filteredClasses.length} kelas</span></div>
            <div className="obe-class-table">
              <div className="obe-class-head"><span>Mata kuliah</span><span>Kelas</span><span>Pengampu</span><span>Aksi</span></div>
              {filteredClasses.map((item) => <div className="obe-class-row" key={item.id}>
                <span><strong>{item.courseCode}</strong><small>{item.courseName} · {item.credits} SKS</small></span>
                <span><strong>{item.className}</strong></span>
                <span className="lecturers">{item.lecturerNames.length ? item.lecturerNames.map((name) => <small key={name}>{name}</small>) : <small>Belum terhubung ke akun dosen</small>}</span>
                <span className="actions">{canAssign ? <><button onClick={() => openClassEditor(item)} type="button">Ubah</button><button className="danger-link" onClick={() => void removeClass(item)} type="button">Hapus</button></> : null}</span>
              </div>)}
              {!filteredClasses.length ? <div className="obe-empty-row">Belum ada kelas yang cocok pada periode ini.</div> : null}
            </div>
          </section>
        ) : null}
      </div>

      {modal ? <div className="obe-admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModal(null); }}>
        <section aria-modal="true" className="obe-admin-modal" role="dialog">
          <div className="obe-admin-modal-head"><h2>{modal === "institution" ? "Tambah institusi" : modal === "period" ? "Buat periode" : modal === "delete-institution" ? "Hapus institusi" : editingClass ? "Ubah kelas & pengampu" : "Tambah kelas & pengampu"}</h2><button disabled={busy} onClick={() => setModal(null)} type="button">×</button></div>
          <div className="obe-admin-modal-body">
            {modal === "institution" ? <label><span>Nama institusi</span><input autoFocus maxLength={120} onChange={(event) => setNewInstitutionName(event.target.value)} placeholder="Contoh: S1 - Matematika UNDIP" value={newInstitutionName} /></label> : null}
            {modal === "period" ? <><label><span>Nama periode</span><input autoFocus maxLength={80} onChange={(event) => setNewPeriod((current) => ({ ...current, label: event.target.value }))} placeholder="Contoh: Genap 2027/2028" value={newPeriod.label} /></label><div className="two"><label><span>Mulai</span><input onChange={(event) => setNewPeriod((current) => ({ ...current, startsAt: event.target.value }))} type="date" value={newPeriod.startsAt} /></label><label><span>Selesai</span><input onChange={(event) => setNewPeriod((current) => ({ ...current, endsAt: event.target.value }))} type="date" value={newPeriod.endsAt} /></label></div></> : null}
            {modal === "delete-institution" && institution ? <><p className="danger-box">Penghapusan menghapus seluruh data yang berada di bawah institusi tersebut. Konfirmasi dilakukan dua lapis.</p><label><span>1. Ketik nama persis: {institution.name}</span><input autoFocus onChange={(event) => setDeleteName(event.target.value)} value={deleteName} /></label><label><span>2. Ketik HAPUS</span><input onChange={(event) => setDeleteToken(event.target.value)} value={deleteToken} /></label></> : null}
            {modal === "class" && institution ? <><label><span>Mata kuliah</span><select disabled={Boolean(editingClass)} onChange={(event) => setClassCourse(event.target.value)} value={classCourse}>{institution.courses.map((course) => <option key={course.code} value={course.code}>{course.code} · {course.name}</option>)}</select></label><label><span>Nama kelas</span><input maxLength={30} onChange={(event) => setClassName(event.target.value)} placeholder="A" value={className} /></label><fieldset><legend>Pengampu (bisa lebih dari satu)</legend>{institution.lecturers.map((lecturer) => <label className="check" key={lecturer.id}><input checked={classLecturers.includes(lecturer.id)} onChange={() => setClassLecturers((current) => current.includes(lecturer.id) ? current.filter((id) => id !== lecturer.id) : [...current, lecturer.id])} type="checkbox" /><span><strong>{lecturer.name}</strong><small>{lecturer.email}</small></span></label>)}</fieldset></> : null}
            {message ? <p className="modal-message">{message}</p> : null}
          </div>
          <div className="obe-admin-modal-actions"><button disabled={busy} onClick={() => setModal(null)} type="button">Batal</button>{modal === "institution" ? <button className="primary" disabled={busy || newInstitutionName.trim().length < 3} onClick={() => void createInstitution()} type="button">Tambah institusi</button> : modal === "period" ? <button className="primary" disabled={busy || !newPeriod.label || !newPeriod.startsAt || !newPeriod.endsAt} onClick={() => void createPeriod()} type="button">Buat periode</button> : modal === "delete-institution" ? <button className="danger" disabled={busy || deleteName !== institution?.name || deleteToken.trim().toUpperCase() !== "HAPUS"} onClick={() => void removeInstitution()} type="button">Hapus permanen</button> : <button className="primary" disabled={busy || !classCourse || !className.trim() || !classLecturers.length} onClick={() => void saveClass()} type="button">Simpan pemetaan</button>}</div>
        </section>
      </div> : null}

      <style jsx global>{`
        .obe-period-overlay{position:fixed;z-index:45;left:264px;right:0;top:66px;bottom:0;overflow:auto;background:#f5f7f9;color:#17212b}.obe-period-page{width:min(100%,1480px);margin:0 auto;padding:26px 28px 56px}.obe-period-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:16px}.obe-period-heading p{margin:0 0 5px;color:#08766f;font-size:10px;font-weight:850;letter-spacing:.1em}.obe-period-heading h1{margin:0;color:#081c2b;font-size:30px}.obe-period-status{border-radius:999px;background:#d9f4e7;color:#087443;font-size:9px;font-weight:850;padding:6px 10px}.obe-academic-message{margin-bottom:12px;border:1px solid #d7e4eb;border-radius:10px;background:#fff;padding:10px 12px;color:#536371;font-size:10px}.obe-context-lock{display:grid;grid-template-columns:minmax(240px,1.2fr) minmax(210px,1fr) auto;gap:12px;align-items:end;margin-bottom:18px;border:1px solid #e2e8ee;border-radius:13px;background:#fff;padding:14px 16px;box-shadow:0 8px 24px rgba(16,43,63,.04)}.obe-context-lock label{display:grid;gap:6px}.obe-context-lock label>span{color:#667382;font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}.obe-context-lock select,.obe-context-lock input,.obe-admin-modal input,.obe-admin-modal select{height:38px;border:1px solid #d7e0e5;border-radius:9px;background:#fff;padding:0 10px;color:#17212b;font:inherit;font-size:10px}.obe-context-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}.obe-context-actions button,.obe-section-head button,.obe-lock-button,.mini-lock,.obe-class-row button,.obe-admin-modal-actions button{min-height:34px;border:1px solid #d8e0e6;border-radius:8px;background:#fff;color:#175cd3;padding:0 11px;font-size:10px;font-weight:750;cursor:pointer}.obe-context-actions button.danger,.obe-admin-modal-actions button.danger{border-color:#f1b7b2;color:#b42318;background:#fff7f6}.obe-lock-note{grid-column:1/-1;color:#6e7b87;font-size:9px}.obe-period-tabs{display:flex;gap:5px;margin-bottom:18px;border-bottom:1px solid #dfe6eb}.obe-period-tabs button{border:0;border-bottom:2px solid transparent;background:transparent;color:#667382;font-size:12px;font-weight:750;padding:10px 13px;cursor:pointer}.obe-period-tabs button.active{border-bottom-color:#2176ff;color:#102b3f}.obe-period-stack{display:grid;gap:14px}.obe-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.obe-stat-grid article,.obe-panel-card{border:1px solid #e2e8ee;border-radius:13px;background:#fff;box-shadow:0 8px 24px rgba(16,43,63,.05)}.obe-stat-grid article{display:grid;gap:4px;padding:18px}.obe-stat-grid strong{color:#081c2b;font-size:25px}.obe-stat-grid span{color:#667382;font-size:11px}.obe-panel-card{padding:19px}.obe-empty-panel{color:#667382;font-size:11px}.obe-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:16px}.obe-section-head h2{margin:0;color:#081c2b;font-size:15px}.obe-section-head p{margin:4px 0 0;color:#667382;font-size:11px;line-height:1.5}.obe-section-head button.primary,.obe-admin-modal-actions button.primary{border-color:#2176ff;background:#2176ff;color:#fff}.obe-readonly{border-radius:999px;background:#eaf2ff;color:#175cd3;font-size:9px;font-weight:800;padding:6px 9px}.obe-stage-list{display:grid}.obe-stage{min-height:58px;display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:11px;border-top:1px solid #edf1f4}.obe-stage:first-child{border-top:0}.obe-stage>i{width:26px;height:26px;display:grid;place-items:center;border-radius:50%;background:#edf0f3;color:#667382;font-size:9px;font-style:normal}.obe-stage strong,.obe-stage small{display:block}.obe-stage strong{font-size:11px}.obe-stage small{margin-top:3px;color:#778491;font-size:9px}.obe-stage>b{border-radius:999px;font-size:8px;padding:5px 8px}.obe-stage>b.locked{background:#fff0ef;color:#b42318}.obe-stage>b.open{background:#eaf7f3;color:#087443}.obe-period-meta{display:grid;grid-template-columns:minmax(0,220px) minmax(0,220px) auto;gap:12px;align-items:end;margin-bottom:8px}.obe-period-meta label{display:grid;gap:5px}.obe-period-meta label span{color:#667382;font-size:9px;font-weight:750}.obe-period-meta input,.obe-stage-dates input,.obe-class-toolbar input{min-height:36px;border:1px solid #dce3e8;border-radius:8px;background:#fff;color:#17212b;padding:0 10px;font:inherit;font-size:10px}.obe-period-meta input:disabled,.obe-stage-dates input:disabled{background:#f5f7f8;color:#7c8892}.obe-lock-button.locked{border-color:#f1b7b2;color:#b42318}.obe-unlock-note{margin:6px 0 12px;color:#9a6700;font-size:9px}.obe-stage.detailed-row{grid-template-columns:30px minmax(180px,1fr) minmax(380px,auto);padding:6px 0}.obe-stage-dates{display:flex;align-items:center;gap:6px}.obe-stage-dates input{width:130px}.mini-lock{min-width:78px}.obe-class-toolbar{display:flex;align-items:center;gap:10px;margin-bottom:12px}.obe-class-toolbar input{flex:1;max-width:460px}.obe-class-toolbar span{color:#778491;font-size:9px}.obe-class-table{overflow:hidden;border:1px solid #e5eaee;border-radius:10px}.obe-class-head,.obe-class-row{display:grid;grid-template-columns:1.2fr .45fr 1.5fr 150px;align-items:center;gap:12px;padding:10px 12px}.obe-class-head{background:#f7f9fa;color:#778491;font-size:9px;font-weight:800}.obe-class-row{border-top:1px solid #edf1f4;font-size:10px}.obe-class-row strong,.obe-class-row small{display:block}.obe-class-row small{margin-top:2px;color:#778491}.obe-class-row .lecturers{display:grid;gap:3px}.obe-class-row .actions{display:flex;gap:6px;justify-content:flex-end}.obe-class-row button.danger-link{color:#b42318}.obe-empty-row{padding:18px;color:#778491;font-size:10px;text-align:center}.obe-admin-modal-backdrop{position:fixed;inset:0;z-index:700;display:grid;place-items:center;padding:18px;background:rgba(8,25,38,.48)}.obe-admin-modal{width:min(520px,100%);max-height:min(760px,92vh);overflow:auto;border-radius:15px;background:#fff;box-shadow:0 24px 70px rgba(8,25,38,.28);color:#17212b}.obe-admin-modal-head{display:flex;align-items:center;justify-content:space-between;padding:17px 19px;border-bottom:1px solid #e7ecef}.obe-admin-modal-head h2{margin:0;font-size:16px}.obe-admin-modal-head button{width:31px;height:31px;border:0;border-radius:8px;background:#f2f5f7;font-size:18px}.obe-admin-modal-body{display:grid;gap:13px;padding:18px 19px 8px}.obe-admin-modal-body>label{display:grid;gap:6px}.obe-admin-modal-body label>span,.obe-admin-modal legend{color:#667382;font-size:9px;font-weight:750}.obe-admin-modal .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.obe-admin-modal .two label{display:grid;gap:6px}.obe-admin-modal fieldset{display:grid;gap:7px;margin:0;border:1px solid #e2e8ee;border-radius:10px;padding:10px}.obe-admin-modal .check{display:flex;align-items:flex-start;gap:8px;border-radius:8px;padding:7px}.obe-admin-modal .check:hover{background:#f7f9fa}.obe-admin-modal .check input{width:15px;height:15px;margin-top:1px}.obe-admin-modal .check strong,.obe-admin-modal .check small{display:block}.obe-admin-modal .check strong{font-size:10px}.obe-admin-modal .check small{margin-top:2px;color:#778491;font-size:8px}.danger-box{margin:0;border-radius:9px;background:#fff0ef;padding:10px;color:#b42318;font-size:10px;line-height:1.45}.modal-message{margin:0;border-radius:9px;background:#f5f8fa;padding:9px;color:#536371;font-size:9px}.obe-admin-modal-actions{display:flex;justify-content:flex-end;gap:8px;padding:15px 19px 19px}.obe-context-actions button:disabled,.obe-section-head button:disabled,.obe-lock-button:disabled,.mini-lock:disabled,.obe-admin-modal button:disabled{opacity:.5;cursor:not-allowed}@media(max-width:920px){.obe-period-overlay{left:0}.obe-period-page{padding:20px 16px 42px}.obe-context-lock{grid-template-columns:1fr 1fr}.obe-context-actions{grid-column:1/-1;justify-content:flex-start}.obe-stat-grid{grid-template-columns:repeat(2,1fr)}.obe-stage.detailed-row{grid-template-columns:30px 1fr}.obe-stage-dates{grid-column:2;flex-wrap:wrap}.obe-class-table{overflow-x:auto}.obe-class-head,.obe-class-row{min-width:760px}}@media(max-width:620px){.obe-context-lock,.obe-period-meta,.obe-admin-modal .two{grid-template-columns:1fr}.obe-context-actions{grid-column:auto}.obe-stat-grid{grid-template-columns:1fr 1fr}.obe-period-tabs{overflow-x:auto}.obe-stage-dates input{width:120px}}
      `}</style>
    </div>
  );
}
