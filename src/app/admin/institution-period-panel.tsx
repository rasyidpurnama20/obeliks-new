"use client";

import { useEffect, useMemo, useState } from "react";
import { academicPeriods, academicWindows, courseOfferings } from "@/lib/mvp/data";

type PeriodTab = "summary" | "period" | "classes";

type InstitutionPeriodPanelProps = {
  initialRole: string;
};

const workspaceLabel = "S1 – Informatika UNDIP";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function readActiveRole(fallback: string) {
  return document.querySelector<HTMLSelectElement>('select[aria-label="Peran aktif"]')?.value ?? fallback;
}

export function InstitutionPeriodPanel({ initialRole }: InstitutionPeriodPanelProps) {
  const [visible, setVisible] = useState(false);
  const [role, setRole] = useState(initialRole);
  const [tab, setTab] = useState<PeriodTab>("summary");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const activePeriod = academicPeriods.find((period) => period.isActive) ?? academicPeriods[0];
  const isAdmin = role === "admin";
  const canAssign = role === "admin" || role === "kaprodi";

  useEffect(() => {
    const sync = () => {
      setVisible(window.location.hash.replace(/^#/, "").split("/")[0] === "institusi-periode");
      setRole(readActiveRole(initialRole));
    };
    sync();
    window.addEventListener("hashchange", sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    return () => {
      window.removeEventListener("hashchange", sync);
      observer.disconnect();
    };
  }, [initialRole]);

  const filteredCourses = useMemo(() => courseOfferings.filter((course) => {
    const haystack = `${course.code} ${course.name} ${course.className} ${course.lecturer}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [query]);

  if (!visible || !["admin", "kaprodi"].includes(role)) return null;

  return (
    <div className="obe-period-overlay">
      <div className="obe-period-page">
        <header className="obe-period-heading">
          <div>
            <p>ADMINISTRASI AKADEMIK</p>
            <h1>Institusi &amp; Periode</h1>
            <span>Kelola konteks semester dan pengampu tanpa menjadikan OBELIKS sebagai sistem akademik yang rumit.</span>
          </div>
          <span className="obe-period-status">AKTIF</span>
        </header>

        <section className="obe-context-card">
          <div><small>RUANG KERJA</small><strong>{workspaceLabel}</strong></div>
          <div><small>PERIODE</small><strong>{activePeriod.label}</strong></div>
          <div><small>RENTANG</small><strong>{formatDate(activePeriod.startsAt)} – {formatDate(activePeriod.endsAt)}</strong></div>
        </section>

        <nav aria-label="Bagian Institusi dan Periode" className="obe-period-tabs">
          <button className={tab === "summary" ? "active" : ""} onClick={() => setTab("summary")} type="button">Ringkasan</button>
          <button className={tab === "period" ? "active" : ""} onClick={() => setTab("period")} type="button">Periode &amp; Tahapan</button>
          <button className={tab === "classes" ? "active" : ""} onClick={() => setTab("classes")} type="button">Kelas &amp; Pengampu</button>
        </nav>

        {tab === "summary" ? (
          <div className="obe-period-stack">
            <section className="obe-stat-grid">
              <article><strong>83</strong><span>Mata kuliah</span></article>
              <article><strong>36</strong><span>Dosen</span></article>
              <article><strong>50</strong><span>RPS semester</span></article>
              <article><strong>41</strong><span>RPS siap</span></article>
            </section>
            <section className="obe-panel-card">
              <div className="obe-section-head"><div><h2>Tahap saat ini</h2><p>Satu alur sederhana untuk melihat posisi semester.</p></div><button onClick={() => setTab("period")} type="button">Kelola periode →</button></div>
              <div className="obe-stage-list">
                {academicWindows.map((window, index) => {
                  const state = index < 2 ? "done" : index === 2 ? "active" : "upcoming";
                  return <div className={`obe-stage ${state}`} key={window.id}><i>{state === "done" ? "✓" : state === "active" ? "●" : "○"}</i><span><strong>{window.title}</strong><small>{formatDate(window.startsAt)} – {formatDate(window.deadlineAt)}</small></span>{state === "active" ? <b>Berjalan</b> : null}</div>;
                })}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "period" ? (
          <section className="obe-panel-card">
            <div className="obe-section-head">
              <div><h2>Periode &amp; Tahapan</h2><p>{isAdmin ? "Admin dapat mengatur periode; detail teknis lock disembunyikan dari tampilan utama." : "Kaprodi melihat jadwal secara read-only."}</p></div>
              {isAdmin ? <button className="primary" onClick={() => setEditing((value) => !value)} type="button">{editing ? "Selesai" : "Edit periode"}</button> : <span className="obe-readonly">Read-only</span>}
            </div>
            <div className="obe-period-meta">
              <label><span>Mulai</span><input disabled={!editing} type="date" defaultValue={activePeriod.startsAt} /></label>
              <label><span>Selesai</span><input disabled={!editing} type="date" defaultValue={activePeriod.endsAt} /></label>
            </div>
            <div className="obe-stage-list detailed">
              {academicWindows.map((window, index) => <div className="obe-stage" key={window.id}><i>{index < 2 ? "✓" : index === 2 ? "●" : "○"}</i><span><strong>{window.title}</strong><small>{window.description}</small></span><div className="obe-stage-dates"><input disabled={!editing} type="date" defaultValue={window.startsAt} /><span>–</span><input disabled={!editing} type="date" defaultValue={window.deadlineAt} /></div></div>)}
            </div>
            {editing ? <div className="obe-save-note"><span>Perubahan pada tahap ini masih pratinjau MVP dan belum dipersistenkan.</span><button onClick={() => setEditing(false)} type="button">Simpan pratinjau</button></div> : null}
          </section>
        ) : null}

        {tab === "classes" ? (
          <section className="obe-panel-card">
            <div className="obe-section-head"><div><h2>Kelas &amp; Pengampu</h2><p>Fokus hanya pada siapa mengampu kelas apa; role pengguna tetap dikelola di Pengguna &amp; Akses.</p></div>{canAssign ? <button className="primary" type="button">+ Tambah kelas</button> : null}</div>
            <div className="obe-class-toolbar"><input aria-label="Cari mata kuliah" onChange={(event) => setQuery(event.target.value)} placeholder="Cari mata kuliah, kelas, atau dosen…" type="search" value={query} /><span>{filteredCourses.length} kelas</span></div>
            <div className="obe-class-table">
              <div className="obe-class-head"><span>Mata kuliah</span><span>Kelas</span><span>Pengampu</span><span>Status</span><span /></div>
              {filteredCourses.map((course) => {
                const missing = !course.lecturer || course.lecturer.toLowerCase().includes("belum");
                return <div className="obe-class-row" key={course.id}><span><strong>{course.code}</strong><small>{course.name}</small></span><span>{course.className} · {course.credits} SKS</span><span>{course.lecturer || "Belum ada dosen"}</span><span className={missing ? "warning" : "ok"}>{missing ? "Belum lengkap" : "Lengkap"}</span><button type="button">{missing ? "Tentukan" : "Ubah"}</button></div>;
              })}
            </div>
          </section>
        ) : null}
      </div>

      <style jsx global>{`
        .obe-period-overlay { position: fixed; z-index: 45; left: 264px; right: 0; top: 66px; bottom: 0; overflow: auto; background: #f5f7f9; color: #17212b; }
        .obe-period-page { width: min(100%, 1480px); margin: 0 auto; padding: 26px 28px 56px; }
        .obe-period-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 20px; }
        .obe-period-heading p { margin: 0 0 5px; color: #08766f; font-size: 10px; font-weight: 850; letter-spacing: .1em; }
        .obe-period-heading h1 { margin: 0 0 8px; color: #081c2b; font-size: 32px; letter-spacing: -.035em; }
        .obe-period-heading span { color: #667382; font-size: 13px; line-height: 1.5; }
        .obe-period-status { border-radius: 999px; background: #d9f4e7; color: #087443 !important; font-size: 9px !important; font-weight: 850; padding: 6px 10px; }
        .obe-context-card { display: grid; grid-template-columns: 1.4fr 1fr 1fr; gap: 1px; overflow: hidden; margin-bottom: 18px; border: 1px solid #e2e8ee; border-radius: 12px; background: #e2e8ee; }
        .obe-context-card > div { display: grid; gap: 5px; background: #fff; padding: 14px 16px; }
        .obe-context-card small { color: #778491; font-size: 9px; font-weight: 800; letter-spacing: .08em; }
        .obe-context-card strong { color: #17212b; font-size: 12px; }
        .obe-period-tabs { display: flex; gap: 5px; margin-bottom: 18px; border-bottom: 1px solid #dfe6eb; }
        .obe-period-tabs button { border: 0; border-bottom: 2px solid transparent; background: transparent; color: #667382; font-size: 12px; font-weight: 750; padding: 10px 13px; }
        .obe-period-tabs button.active { border-bottom-color: #2176ff; color: #102b3f; }
        .obe-period-stack { display: grid; gap: 14px; }
        .obe-stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
        .obe-stat-grid article, .obe-panel-card { border: 1px solid #e2e8ee; border-radius: 13px; background: #fff; box-shadow: 0 8px 24px rgba(16,43,63,.05); }
        .obe-stat-grid article { display: grid; gap: 4px; padding: 18px; }
        .obe-stat-grid strong { color: #081c2b; font-size: 25px; }
        .obe-stat-grid span { color: #667382; font-size: 11px; }
        .obe-panel-card { padding: 19px; }
        .obe-section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; margin-bottom: 16px; }
        .obe-section-head h2 { margin: 0; color: #081c2b; font-size: 15px; }
        .obe-section-head p { margin: 4px 0 0; color: #667382; font-size: 11px; line-height: 1.5; }
        .obe-section-head button, .obe-save-note button, .obe-class-row button { min-height: 34px; border: 1px solid #d8e0e6; border-radius: 8px; background: #fff; color: #175cd3; font-size: 10px; font-weight: 750; padding: 0 11px; }
        .obe-section-head button.primary { border-color: #2176ff; background: #2176ff; color: #fff; }
        .obe-readonly { border-radius: 999px; background: #eaf2ff; color: #175cd3; font-size: 9px; font-weight: 800; padding: 6px 9px; }
        .obe-stage-list { display: grid; }
        .obe-stage { min-height: 58px; display: grid; grid-template-columns: 24px minmax(0,1fr) auto; align-items: center; gap: 11px; border-top: 1px solid #edf1f4; }
        .obe-stage:first-child { border-top: 0; }
        .obe-stage > i { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; background: #edf0f3; color: #667382; font-size: 10px; font-style: normal; }
        .obe-stage.done > i { background: #d9f4e7; color: #087443; }.obe-stage.active > i { background: #eaf2ff; color: #175cd3; }
        .obe-stage strong,.obe-stage small { display: block; }.obe-stage strong { font-size: 11px; }.obe-stage small { margin-top: 3px; color: #778491; font-size: 9px; }
        .obe-stage b { border-radius: 999px; background: #eaf2ff; color: #175cd3; font-size: 8px; padding: 5px 8px; }
        .obe-period-meta { display: grid; grid-template-columns: repeat(2,minmax(0,220px)); gap: 12px; margin-bottom: 10px; }
        .obe-period-meta label { display: grid; gap: 5px; }.obe-period-meta label span { color: #667382; font-size: 9px; font-weight: 750; }
        .obe-period-meta input,.obe-stage-dates input,.obe-class-toolbar input { min-height: 36px; border: 1px solid #dce3e8; border-radius: 8px; background: #fff; color: #17212b; padding: 0 10px; font: inherit; font-size: 10px; }
        .obe-period-meta input:disabled,.obe-stage-dates input:disabled { background: #f7f9fa; color: #667382; }
        .obe-stage-list.detailed .obe-stage { grid-template-columns: 24px minmax(0,1fr) minmax(280px,auto); padding: 5px 0; }
        .obe-stage-dates { display: flex; align-items: center; gap: 6px; }.obe-stage-dates input { width: 128px; }
        .obe-save-note { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 14px; border-top: 1px solid #edf1f4; padding-top: 14px; }.obe-save-note span { color: #778491; font-size: 9px; }
        .obe-class-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }.obe-class-toolbar input { flex: 1; max-width: 460px; }.obe-class-toolbar span { color: #778491; font-size: 9px; }
        .obe-class-table { overflow: hidden; border: 1px solid #e5eaee; border-radius: 10px; }
        .obe-class-head,.obe-class-row { display: grid; grid-template-columns: 1.5fr .55fr 1.2fr .65fr 80px; align-items: center; gap: 12px; padding: 10px 12px; }
        .obe-class-head { background: #f7f9fa; color: #778491; font-size: 9px; font-weight: 800; }.obe-class-row { border-top: 1px solid #edf1f4; font-size: 10px; }
        .obe-class-row strong,.obe-class-row small { display: block; }.obe-class-row small { margin-top: 2px; color: #778491; }
        .obe-class-row .ok { color: #087443; font-weight: 800; }.obe-class-row .warning { color: #b42318; font-weight: 800; }
        @media (max-width: 920px) { .obe-period-overlay { left: 0; }.obe-period-page { padding: 20px 16px 42px; }.obe-context-card { grid-template-columns: 1fr; }.obe-stat-grid { grid-template-columns: repeat(2,1fr); }.obe-stage-list.detailed .obe-stage { grid-template-columns: 22px 1fr; }.obe-stage-dates { grid-column: 2; flex-wrap: wrap; }.obe-class-table { overflow-x: auto; }.obe-class-head,.obe-class-row { min-width: 720px; } }
      `}</style>
    </div>
  );
}
