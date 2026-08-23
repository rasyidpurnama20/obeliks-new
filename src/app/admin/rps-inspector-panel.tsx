"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMonitoringRps, type MonitoringRpsItem } from "./monitoring-rps-actions";
import styles from "./clean-workspace.module.css";

type InspectorMode = "penyusunan" | "evaluasi";
type UnknownRecord = Record<string, unknown>;

function getPath() {
  return typeof window === "undefined" ? "" : window.location.pathname.replace(/\/$/, "") || "/";
}

function go(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("obeliks:navigation"));
}

function asObject(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function findArray(source: UnknownRecord, aliases: string[]) {
  for (const key of aliases) {
    if (Array.isArray(source[key])) return source[key] as unknown[];
  }
  return [];
}

function textOf(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function itemText(value: unknown, fallback: string) {
  if (typeof value === "string") return value;
  const row = asObject(value);
  const code = textOf(row.code || row.kode || row.id);
  const description = textOf(row.description || row.deskripsi || row.text || row.name || row.nama || row.title);
  return [code, description].filter(Boolean).join(" · ") || fallback;
}

function validationIssues(summary: UnknownRecord) {
  if (Array.isArray(summary.issues)) return summary.issues;
  if (Array.isArray(summary.errors)) return summary.errors;
  return [];
}

function qualityStats(record: MonitoringRpsItem) {
  const data = record.structuredData;
  const cpl = findArray(data, ["cpl", "plo", "program_learning_outcomes", "programLearningOutcomes"]);
  const cpmk = findArray(data, ["cpmk", "clo", "course_learning_outcomes", "courseLearningOutcomes"]);
  const assessments = findArray(data, ["assessments", "assessment", "assessment_plan", "assessmentPlan"]);
  const issues = validationIssues(record.validationSummary);
  const errorCount = issues.filter((item) => textOf(asObject(item).severity || asObject(item).type).toLowerCase() === "error").length;
  const warningCount = Math.max(0, issues.length - errorCount);
  const ok = [cpl.length > 0, cpmk.length > 0, assessments.length > 0, issues.length === 0].filter(Boolean).length;
  return { cpl, cpmk, assessments, issues, ok, warningCount, errorCount };
}

function Section({ id, title, subtitle, children }: { id: string; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className={styles.inspectorSection} id={id}>
      <header><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</header>
      <div>{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className={styles.empty}><div><strong>Belum ada data</strong><span>{text}</span></div></div>;
}

function SimpleList({ items, empty }: { items: unknown[]; empty: string }) {
  if (!items.length) return <Empty text={empty} />;
  return <div className={styles.miniList}>{items.map((item, index) => <div className={styles.miniRow} key={index}><strong>{index + 1}</strong><span>{itemText(item, `Item ${index + 1}`)}</span><span /></div>)}</div>;
}

function authoringSections(record: MonitoringRpsItem) {
  const data = record.structuredData;
  const cpl = findArray(data, ["cpl", "plo", "program_learning_outcomes", "programLearningOutcomes"]);
  const cpmk = findArray(data, ["cpmk", "clo", "course_learning_outcomes", "courseLearningOutcomes"]);
  const subCpmk = findArray(data, ["sub_cpmk", "subCpmk", "sub_clo", "subClo"]);
  const assessments = findArray(data, ["assessments", "assessment", "assessment_plan", "assessmentPlan"]);
  const identity = asObject(data.identity || data.identitas || data.course || data.mata_kuliah);
  const matrix = findArray(data, ["cpl_cpmk_matrix", "plo_clo_matrix", "alignment_matrix", "mappings"]);
  const stats = qualityStats(record);

  return [
    { id: "identitas", label: "Identitas", node: <Section id="identitas" title="Identitas" subtitle="Identitas mata kuliah dan dokumen RPS.">{Object.keys(identity).length ? <dl className={styles.miniList}>{Object.entries(identity).slice(0,12).map(([key,value]) => <div className={styles.miniRow} key={key}><strong>{key}</strong><span>{textOf(value) || "—"}</span><span /></div>)}</dl> : <Empty text="Identitas akan muncul setelah dokumen RPS terstruktur tersedia." />}</Section> },
    { id: "cpl", label: "CPL", node: <Section id="cpl" title="CPL / PLO" subtitle="Capaian pembelajaran program yang dibebankan ke mata kuliah."><SimpleList items={cpl} empty="Belum ada CPL/PLO yang terbaca dari RPS." /></Section> },
    { id: "cpmk", label: "CPMK", node: <Section id="cpmk" title="CPMK / CLO" subtitle="Outcome mata kuliah yang harus terukur dan selaras."><SimpleList items={cpmk} empty="Belum ada CPMK/CLO yang terbaca dari RPS." /></Section> },
    { id: "sub-cpmk", label: "Sub-CPMK", node: <Section id="sub-cpmk" title="Sub-CPMK" subtitle="Turunan CPMK untuk aktivitas pembelajaran mingguan."><SimpleList items={subCpmk} empty="Belum ada Sub-CPMK yang terstruktur." /></Section> },
    { id: "alignment", label: "Alignment", node: <Section id="alignment" title="OBE Alignment" subtitle="Keterhubungan outcome, aktivitas, dan asesmen.">{matrix.length ? <SimpleList items={matrix} empty="" /> : <Empty text="Belum ada pemetaan alignment eksplisit pada data RPS." />}</Section> },
    { id: "matrix", label: "CPL Matrix", node: <Section id="matrix" title="Matriks CPL–CPMK" subtitle="Adaptasi pemeriksaan matriks dari Level 2.">{matrix.length ? <SimpleList items={matrix} empty="" /> : <Empty text="Matriks CPL–CPMK belum tersedia." />}</Section> },
    { id: "bloom", label: "Bloom", node: <Section id="bloom" title="Bloom Inspector" subtitle="Pemeriksaan awal kata kerja CPMK menggunakan data yang tersedia.">{cpmk.length ? <div className={styles.miniList}>{cpmk.map((item,index) => { const description=itemText(item,""); const low=description.toLocaleLowerCase("id-ID"); const weak=["memahami","mengetahui","mengerti"].some((word)=>low.includes(word)); return <div className={styles.miniRow} key={index}><strong>{index+1}</strong><span>{description}</span><span className={`${styles.badge} ${weak ? styles.amber : styles.green}`}>{weak ? "Periksa verb" : "Terukur"}</span></div>; })}</div> : <Empty text="CPMK diperlukan untuk menjalankan pemeriksaan Bloom." />}</Section> },
    { id: "assessment", label: "Assessment", node: <Section id="assessment" title="Assessment Blueprint" subtitle="Asesmen, bobot, dan CPMK yang diukur."><SimpleList items={assessments} empty="Belum ada blueprint asesmen yang terstruktur." /></Section> },
    { id: "quality", label: "Quality", node: <Section id="quality" title="Quality Inspector" subtitle="Temuan parser dan validasi RPS.">{stats.issues.length ? <div>{stats.issues.map((issue,index) => <div className={`${styles.issue} ${styles.issueWarn}`} key={index}><strong>{itemText(issue,`Temuan ${index+1}`)}</strong></div>)}</div> : <div className={`${styles.issue} ${styles.issueGood}`}><strong>Belum ada temuan validasi terbuka</strong>Inspector hanya menggunakan data nyata yang sudah tersimpan.</div>}</Section> },
  ];
}

function evaluationSections(record: MonitoringRpsItem) {
  const data = record.structuredData;
  const assessments = findArray(data, ["assessments", "assessment", "assessment_plan", "assessmentPlan"]);
  const evidence = findArray(data, ["student_evidence", "studentEvidence", "evidence", "students"]);
  const cpmkAttainment = findArray(data, ["cpmk_attainment", "clo_attainment", "cpmkAttainment", "cloAttainment"]);
  const cplAttainment = findArray(data, ["cpl_attainment", "plo_attainment", "cplAttainment", "ploAttainment"]);
  const heatmap = findArray(data, ["student_heatmap", "studentHeatmap", "heatmap"]);
  const gaps = findArray(data, ["gaps", "gap_analysis", "gapAnalysis"]);
  const actions = findArray(data, ["improvement_actions", "corrective_actions", "actions", "improvementActions"]);
  const nextRps = findArray(data, ["next_rps", "nextRps", "recommendations", "improvements"]);
  const configs = [
    ["ringkasan","Ringkasan","Closed Loop OBE","Evidence-based continuous improvement.", []],
    ["assessment","Assessment","Assessment Blueprint","Asesmen yang menjadi sumber evidence.", assessments],
    ["evidence","Student Evidence","Student Assessment Evidence","Nilai/evidence aktual mahasiswa.", evidence],
    ["cpmk-attainment","CPMK Attainment","CPMK Attainment","Ketercapaian CPMK dari asesmen.", cpmkAttainment],
    ["cpl-attainment","CPL Attainment","CPL Attainment","Agregasi ketercapaian CPL/PLO.", cplAttainment],
    ["heatmap","Heatmap","Student Outcome Heatmap","Deteksi outcome yang membutuhkan intervensi.", heatmap],
    ["gap","Gap Analysis","Outcome Gap Analysis","Outcome yang belum memenuhi target.", gaps],
    ["actions","Corrective Action","Corrective & Improvement Action","Root cause, action, PIC, dan status.", actions],
    ["next-rps","Next RPS","RPS Semester Berikutnya","Perubahan berbasis evidence untuk close the loop.", nextRps],
  ] as const;
  return configs.map(([id,label,title,subtitle,items]) => ({ id, label, node: <Section id={id} title={title} subtitle={subtitle}>{id === "ringkasan" ? <div className={styles.notice}>Inspector ini tidak membuat data simulasi. Ringkasan akan terisi dari evidence dan attainment yang tersimpan.</div> : <SimpleList items={[...items]} empty={`Belum ada data ${label.toLowerCase()} pada RPS ini.`} />}</Section> }));
}

export function RpsInspectorPanel() {
  const [path, setPath] = useState("");
  const [record, setRecord] = useState<MonitoringRpsItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  const mode: InspectorMode | null = path === "/monitoring-rps/penyusunan" ? "penyusunan" : path === "/monitoring-rps/evaluasi" ? "evaluasi" : null;

  const load = useCallback(async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setError("ID RPS tidak ditemukan pada URL.");
      return;
    }
    setBusy(true);
    const result = await loadMonitoringRps();
    if (!result.ok) {
      setError(result.message);
      setRecord(null);
    } else {
      const item = result.data.items.find((candidate) => candidate.id === id) ?? null;
      setRecord(item);
      setError(item ? "" : "RPS tidak ditemukan pada lingkup akses Anda.");
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    if (mode && !record && !busy && !error) void load();
  }, [busy, error, load, mode, record]);

  const sections = useMemo(() => record ? (mode === "penyusunan" ? authoringSections(record) : evaluationSections(record)) : [], [mode, record]);
  if (!mode) return null;

  const stats = record ? qualityStats(record) : { ok: 0, warningCount: 0, errorCount: 0, issues: [] as unknown[] };
  const title = mode === "penyusunan" ? "Penyusunan RPS Inspector" : "Evaluasi RPS Inspector";
  const rightTitle = mode === "penyusunan" ? "RPS Inspector" : "Closed Loop Inspector";

  return (
    <div className={styles.overlay} data-clean-workspace={`rps-${mode}`}>
      <main className={styles.page}>
        <header className={styles.heading}>
          <div>
            <button className={styles.ghost} onClick={() => go("/monitoring-rps")} type="button">← Monitoring RPS</button>
            <h1>{title}</h1>
            {record ? <p>{record.code} · {record.courseName} · {record.period} · v{record.version}</p> : null}
          </div>
        </header>

        {error ? <div className={styles.error} role="alert">{error}</div> : null}
        {busy ? <div className={styles.notice}>Memuat RPS…</div> : null}

        {record ? (
          <div className={styles.inspectorGrid}>
            <nav aria-label={`${title} navigation`} className={styles.inspectorNav}>
              {sections.map((section) => <button key={section.id} onClick={() => document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" })} type="button">{section.label}</button>)}
            </nav>
            <div className={styles.inspectorMain}>{sections.map((section) => <div key={section.id}>{section.node}</div>)}</div>
            <aside className={`${styles.card} ${styles.inspectorSide}`}>
              <div className={styles.cardHeader}><div><h2>{rightTitle}</h2><p>{mode === "penyusunan" ? "OBE alignment & quality review" : "Outcome attainment & improvement review"}</p></div></div>
              <div className={styles.cardBody}>
                <div className={styles.metrics} style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                  <article className={styles.metric}><span>{mode === "penyusunan" ? "OK" : "Achieved"}</span><strong>{stats.ok}</strong></article>
                  <article className={styles.metric}><span>Caution</span><strong>{stats.warningCount}</strong></article>
                  <article className={styles.metric}><span>Critical</span><strong>{stats.errorCount}</strong></article>
                </div>
                <div className={styles.notice}>Status dokumen: <strong>{record.statusLabel}</strong>. Inspector tidak menambahkan data contoh.</div>
              </div>
            </aside>
          </div>
        ) : null}
      </main>
    </div>
  );
}
