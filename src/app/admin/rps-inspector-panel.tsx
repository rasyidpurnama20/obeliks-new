"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMonitoringRps, type MonitoringRpsItem } from "./monitoring-rps-actions";
import { saveRpsStudioData } from "./rps-studio-actions";
import { downloadRpsDocx } from "./rps-docx";
import {
  createStudioState,
  detectBloom,
  generateExample,
  markDirty,
  simpleHash,
  totalEvaluationWeight,
  uid,
  validationIssues,
  type Contribution,
  type RpsStudioState,
} from "./rps-studio-model";
import styles from "./rps-studio.module.css";

type InspectorMode = "penyusunan" | "evaluasi";
type SectionId = "identity" | "alignment" | "schedule" | "evaluation" | "rubric" | "attainment" | "improvement" | "curriculum" | "final";

const sections: Array<{ id: SectionId; number: number; label: string }> = [
  { id: "identity", number: 1, label: "Identitas & CPL" },
  { id: "alignment", number: 2, label: "CPMK & Alignment" },
  { id: "schedule", number: 3, label: "Jadwal & Materi" },
  { id: "evaluation", number: 4, label: "Evaluasi" },
  { id: "rubric", number: 5, label: "Rubrik & Evidence" },
  { id: "attainment", number: 6, label: "Attainment" },
  { id: "improvement", number: 7, label: "Continuous Improvement" },
  { id: "curriculum", number: 8, label: "Curriculum Context" },
  { id: "final", number: 9, label: "Final Document" },
];

function getPath() { return typeof window === "undefined" ? "" : window.location.pathname.replace(/\/$/, "") || "/"; }
function go(path: string) { window.history.pushState(null, "", path); window.dispatchEvent(new Event("obeliks:navigation")); }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className={styles.field}><span>{label}</span>{children}</label>; }
function Section({ id, title, subtitle, children, print = false }: { id: string; title: string; subtitle: string; children: React.ReactNode; print?: boolean }) { return <section className={styles.section} data-print={print ? "true" : undefined} id={id}><header className={styles.sectionHead}><h2>{title}</h2><p>{subtitle}</p></header><div className={styles.sectionBody}>{children}</div></section>; }
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={styles.input} />; }
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={styles.select} />; }
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={styles.textarea} />; }
function Empty({ children }: { children: React.ReactNode }) { return <div className={styles.empty}>{children}</div>; }
function cpmkCode(state: RpsStudioState, id: string) { return state.cpmk.find((item) => item.id === id)?.code ?? "—"; }

function FinalPreview({ state }: { state: RpsStudioState }) {
  return <div className={styles.preview}>
    <h1>RENCANA PEMBELAJARAN SEMESTER (RPS)</h1><p style={{ textAlign: "center", fontWeight: 800 }}>OUTCOME-BASED EDUCATION</p>
    <table><tbody><tr><th>Institusi</th><td>{state.meta.institution}</td><th>Program Studi</th><td>{state.meta.program}</td></tr><tr><th>Mata Kuliah</th><td>{state.meta.courseName}</td><th>Kode</th><td>{state.meta.code}</td></tr><tr><th>SKS</th><td>{state.meta.credits || "—"}</td><th>Semester</th><td>{state.meta.semester || "—"}</td></tr></tbody></table>
    <h2>CPL yang Dibebankan</h2><table><thead><tr><th>Kode</th><th>Deskripsi</th></tr></thead><tbody>{state.cpl.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.description}</td></tr>)}</tbody></table>
    <h2>CPMK</h2><table><thead><tr><th>Kode</th><th>Pernyataan</th><th>Bobot</th></tr></thead><tbody>{state.cpmk.map((item) => <tr key={item.id}><td>{item.code}</td><td>{item.text}</td><td>{item.weight}%</td></tr>)}</tbody></table>
    <h2>Matriks CPL–CPMK</h2><div style={{ overflow: "auto" }}><table><thead><tr><th>CPMK</th>{state.cpl.map((item) => <th key={item.id}>{item.code}</th>)}</tr></thead><tbody>{state.cpmk.map((cpmk) => <tr key={cpmk.id}><td>{cpmk.code}</td>{state.cpl.map((cpl) => <td key={cpl.id}>{cpmk.maps[cpl.id] ?? 0}</td>)}</tr>)}</tbody></table></div>
    <h2>Rencana Evaluasi</h2><table><thead><tr><th>Asesmen</th><th>Bobot</th><th>CPMK</th></tr></thead><tbody>{state.evaluations.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.weight}%</td><td>{item.cpmkIds.map((id) => cpmkCode(state, id)).join(", ")}</td></tr>)}</tbody></table>
    <h2>Verifikasi</h2><p>{state.audit.reverified ? `${state.audit.verifiedAt} · ${state.audit.hash}` : "Belum diverifikasi ulang."}</p>
  </div>;
}

export function RpsInspectorPanel() {
  const [path, setPath] = useState("");
  const [record, setRecord] = useState<MonitoringRpsItem | null>(null);
  const [state, setState] = useState<RpsStudioState | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("identity");
  const [catalogChoice, setCatalogChoice] = useState("");
  const [manualVerified, setManualVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { const sync = () => setPath(getPath()); sync(); window.addEventListener("popstate", sync); window.addEventListener("obeliks:navigation", sync); return () => { window.removeEventListener("popstate", sync); window.removeEventListener("obeliks:navigation", sync); }; }, []);
  const mode: InspectorMode | null = path === "/monitoring-rps/penyusunan" ? "penyusunan" : path === "/monitoring-rps/evaluasi" ? "evaluasi" : null;

  const load = useCallback(async () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) { setError("ID RPS tidak ditemukan pada URL."); return; }
    setBusy(true);
    const result = await loadMonitoringRps();
    if (!result.ok) { setError(result.message); setRecord(null); setState(null); }
    else {
      const item = result.data.items.find((candidate) => candidate.id === id) ?? null;
      setRecord(item);
      setState(item ? createStudioState({ code: item.code, courseName: item.courseName, owner: item.owner, period: item.period, structuredData: item.structuredData }) : null);
      setError(item ? "" : "RPS tidak ditemukan pada lingkup akses Anda.");
    }
    setBusy(false);
  }, []);

  useEffect(() => { if (!mode) return; setActiveSection(mode === "evaluasi" ? "attainment" : "identity"); if (!record && !busy && !error) void load(); }, [busy, error, load, mode, record]);

  const update = useCallback((mutator: (draft: RpsStudioState) => void) => {
    setState((current) => { if (!current) return current; const draft = structuredClone(current); mutator(draft); return markDirty(draft); });
    setManualVerified(false); setMessage("");
  }, []);

  const issues = useMemo(() => state ? validationIssues(state) : [], [state]);
  const counts = useMemo(() => ({ errors: issues.filter((item) => item.severity === "error").length, warnings: issues.filter((item) => item.severity === "warning").length, passes: issues.filter((item) => item.severity === "pass").length }), [issues]);
  if (!mode) return null;

  async function save() {
    if (!record || !state || saving) return;
    setSaving(true); setError(""); setMessage("");
    const result = await saveRpsStudioData({ documentId: record.id, state: state as unknown as Record<string, unknown>, issues });
    result.ok ? setMessage(result.message) : setError(result.message); setSaving(false);
  }
  function validate() {
    if (!state) return;
    const candidate = { ...state, audit: { ...state.audit, validated: true, reverified: false, verifiedAt: "", hash: "" } };
    const blocking = validationIssues({ ...candidate, audit: { ...candidate.audit, reverified: true } }).filter((item) => item.severity === "error");
    setState(candidate); setManualVerified(false); setMessage(blocking.length ? `Validasi menemukan ${blocking.length} blocker. Perbaiki sebelum verifikasi ulang.` : "Validasi struktur selesai. Centang pemeriksaan manual untuk mengunci dokumen.");
  }
  function reverify() {
    if (!state || !manualVerified || !state.audit.validated) return;
    const candidate = { ...state, audit: { ...state.audit, reverified: true, verifiedAt: new Date().toISOString(), hash: "" } };
    const blocking = validationIssues(candidate).filter((item) => item.severity === "error" && item.title !== "Belum verifikasi ulang");
    if (blocking.length) { setError(`Masih ada ${blocking.length} blocker. Dokumen belum dikunci.`); return; }
    const hash = simpleHash(JSON.stringify(candidate)); setState({ ...candidate, audit: { ...candidate.audit, hash } }); setMessage("Dokumen terverifikasi. Export DOCX sekarang tersedia."); setError("");
  }
  function addCplFromCatalog() {
    if (!state || !catalogChoice) return;
    const item = state.cplCatalog.find((candidate) => candidate.id === catalogChoice);
    if (!item || state.cpl.some((candidate) => candidate.code === item.code)) return;
    update((draft) => { draft.cpl.push({ ...item, id: uid("cpl") }); }); setCatalogChoice("");
  }

  return <div className={styles.overlay} data-clean-workspace={`rps-${mode}`}><main className={styles.page}>
    <header className={styles.heading}><div><button className={styles.back} onClick={() => go("/monitoring-rps")} type="button">← Monitoring RPS</button><h1>RPS OBE Studio</h1><p>{record ? `${record.code} · ${record.courseName} · ${record.owner} · ${record.period}` : "Template builder Level 2 + 3 + 4"}</p></div><div className={styles.actions}><button className={styles.button} disabled={!state} onClick={() => { if (state) { setState(generateExample(state)); setManualVerified(false); setMessage("Generator Contoh diterapkan sebagai draft. Review semua CPMK, mapping, jadwal, asesmen, dan rubrik sebelum finalisasi."); } }} type="button">Generator Contoh</button><button className={styles.buttonPrimary} disabled={!state || saving} onClick={() => void save()} type="button">{saving ? "Menyimpan…" : "Simpan"}</button><button className={styles.button} disabled={!state?.audit.reverified} onClick={() => state && downloadRpsDocx(state)} type="button">Export DOCX</button></div></header>
    <div className={styles.banner}>Studio mengikuti struktur <strong>rps-obe-template-final.html</strong>: 9 bagian dari Identitas &amp; CPL sampai Final Document. Jumlah CPL, CPMK, Sub-CPMK, asesmen, rubrik, evidence, dan improvement <strong>dinamis</strong>, bukan array tetap.</div>
    {state?.audit.exampleGenerated ? <div className={styles.warning}>Konten hasil <strong>Generator Contoh</strong> bukan data akademik resmi. Gunakan sebagai starting point lalu review manual sebelum verifikasi dan export.</div> : null}
    {message ? <div className={styles.success} role="status">{message}</div> : null}{error ? <div className={styles.error} role="alert">{error}</div> : null}{busy ? <div className={styles.banner}>Memuat data RPS…</div> : null}

    {state ? <div className={styles.layout}>
      <nav aria-label="RPS OBE Studio sections" className={styles.nav}>{sections.map((section) => <button data-active={activeSection === section.id} key={section.id} onClick={() => { setActiveSection(section.id); document.getElementById(`studio-${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} type="button">{section.number}. {section.label}</button>)}</nav>
      <div className={styles.main}>
        <Section id="studio-identity" title="1. Identitas & CPL" subtitle="Metadata RPS dan CPL/PLO yang benar-benar dibebankan ke mata kuliah.">
          <div className={styles.grid3}><Field label="Institusi"><Input value={state.meta.institution} onChange={(e) => update((draft) => { draft.meta.institution = e.target.value; })} /></Field><Field label="Fakultas"><Input value={state.meta.faculty} onChange={(e) => update((draft) => { draft.meta.faculty = e.target.value; })} /></Field><Field label="Program Studi"><Input value={state.meta.program} onChange={(e) => update((draft) => { draft.meta.program = e.target.value; })} /></Field><Field label="Mata Kuliah"><Input value={state.meta.courseName} onChange={(e) => update((draft) => { draft.meta.courseName = e.target.value; })} /></Field><Field label="Course Name"><Input value={state.meta.courseNameEn} onChange={(e) => update((draft) => { draft.meta.courseNameEn = e.target.value; })} /></Field><Field label="Kode"><Input value={state.meta.code} onChange={(e) => update((draft) => { draft.meta.code = e.target.value; })} /></Field><Field label="Kelompok/KBK"><Input value={state.meta.kbk} onChange={(e) => update((draft) => { draft.meta.kbk = e.target.value; })} /></Field><Field label="SKS"><Input min={0} step={0.5} type="number" value={state.meta.credits || ""} onChange={(e) => update((draft) => { draft.meta.credits = Number(e.target.value); })} /></Field><Field label="Semester"><Input min={1} max={14} type="number" value={state.meta.semester || ""} onChange={(e) => update((draft) => { draft.meta.semester = Number(e.target.value); })} /></Field></div>
          <div className={styles.grid2} style={{ marginTop: 10 }}><Field label="Deskripsi Mata Kuliah"><Textarea value={state.meta.descriptionId} onChange={(e) => update((draft) => { draft.meta.descriptionId = e.target.value; })} /></Field><Field label="Course Description"><Textarea value={state.meta.descriptionEn} onChange={(e) => update((draft) => { draft.meta.descriptionEn = e.target.value; })} /></Field></div>
          <div className={styles.toolbar} style={{ marginTop: 14 }}><strong style={{ fontSize: 10 }}>CPL dibebankan: {state.cpl.length}</strong><Select aria-label="Pilih CPL dari katalog" value={catalogChoice} onChange={(e) => setCatalogChoice(e.target.value)}><option value="">Pilih dari katalog program ({state.cplCatalog.length})</option>{state.cplCatalog.filter((item) => !state.cpl.some((selected) => selected.code === item.code)).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.description.slice(0, 80)}</option>)}</Select><button className={styles.button} disabled={!catalogChoice} onClick={addCplFromCatalog} type="button">Tambah dari katalog</button><button className={styles.button} onClick={() => update((draft) => { draft.cpl.push({ id: uid("cpl"), code: `CPL-${String(draft.cpl.length + 1).padStart(2, "0")}`, description: "", english: "" }); })} type="button">+ Tambah CPL</button></div>
          {state.cpl.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Kode</th><th>Deskripsi</th><th>English</th><th /></tr></thead><tbody>{state.cpl.map((item, index) => <tr key={item.id}><td><Input value={item.code} onChange={(e) => update((draft) => { draft.cpl[index].code = e.target.value; })} /></td><td><Textarea value={item.description} onChange={(e) => update((draft) => { draft.cpl[index].description = e.target.value; })} /></td><td><Textarea value={item.english} onChange={(e) => update((draft) => { draft.cpl[index].english = e.target.value; })} /></td><td><button className={styles.buttonDanger} onClick={() => update((draft) => { const removed = draft.cpl[index].id; draft.cpl.splice(index, 1); draft.cpmk.forEach((cpmk) => { delete cpmk.maps[removed]; }); })} type="button">Hapus</button></td></tr>)}</tbody></table></div> : <Empty>Belum ada CPL yang dibebankan. Katalog program tetap tersimpan dan dapat dipilih tanpa mengarang pemetaan mata kuliah.</Empty>}
        </Section>

        <Section id="studio-alignment" title="2. CPMK & Alignment" subtitle="CPMK dinamis, Bloom Inspector, Sub-CPMK, dan matriks kontribusi CPL–CPMK.">
          <div className={styles.toolbar}><button className={styles.button} onClick={() => update((draft) => { draft.cpmk.push({ id: uid("cpmk"), code: `CPMK-${String(draft.cpmk.length + 1).padStart(2, "0")}`, text: "", english: "", weight: 0, maps: {} }); })} type="button">+ Tambah CPMK</button><button className={styles.button} disabled={!state.cpmk.length} onClick={() => update((draft) => { const count = Math.max(1, Math.ceil(8 / Math.max(1, draft.cpmk.length))); draft.subCpmk = Array.from({ length: count * draft.cpmk.length }, (_, index) => { const cpmk = draft.cpmk[Math.floor(index / count)]; return { id: uid("sub"), code: `Sub-CPMK-${index + 1}`, cpmkId: cpmk.id, text: "", level: detectBloom(cpmk.text).level === "?" ? "C3" : detectBloom(cpmk.text).level }; }); })} type="button">Generator Sub-CPMK</button></div>
          {state.cpmk.length ? <><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Kode</th><th>Pernyataan CPMK</th><th>English</th><th>Bloom</th><th>Bobot</th><th /></tr></thead><tbody>{state.cpmk.map((item, index) => { const bloom = detectBloom(item.text); return <tr key={item.id}><td><Input value={item.code} onChange={(e) => update((draft) => { draft.cpmk[index].code = e.target.value; })} /></td><td><Textarea value={item.text} onChange={(e) => update((draft) => { draft.cpmk[index].text = e.target.value; })} /></td><td><Textarea value={item.english} onChange={(e) => update((draft) => { draft.cpmk[index].english = e.target.value; })} /></td><td><span className={`${styles.chip} ${bloom.level === "?" ? styles.chipWarn : ""}`}>{bloom.level} · {bloom.verb}</span></td><td><Input min={0} max={100} type="number" value={item.weight} onChange={(e) => update((draft) => { draft.cpmk[index].weight = Number(e.target.value); })} /></td><td><button className={styles.buttonDanger} onClick={() => update((draft) => { const removed = draft.cpmk[index].id; draft.cpmk.splice(index, 1); draft.subCpmk = draft.subCpmk.filter((sub) => sub.cpmkId !== removed); draft.evaluations.forEach((evaluation) => { evaluation.cpmkIds = evaluation.cpmkIds.filter((id) => id !== removed); }); })} type="button">Hapus</button></td></tr>; })}</tbody></table></div>
          <h3 style={{ fontSize: 11, marginTop: 16 }}>Matriks CPL–CPMK · 0=None, 1=Low, 2=Medium, 3=High</h3>{state.cpl.length ? <div className={styles.tableWrap}><table className={`${styles.table} ${styles.matrix}`}><thead><tr><th>CPMK</th>{state.cpl.map((cpl) => <th key={cpl.id}>{cpl.code}</th>)}<th>Bobot</th></tr></thead><tbody>{state.cpmk.map((cpmk, rowIndex) => <tr key={cpmk.id}><td><strong>{cpmk.code}</strong></td>{state.cpl.map((cpl) => <td key={cpl.id}><Select aria-label={`${cpmk.code} ke ${cpl.code}`} value={cpmk.maps[cpl.id] ?? 0} onChange={(e) => update((draft) => { draft.cpmk[rowIndex].maps[cpl.id] = Number(e.target.value) as Contribution; })}><option value={0}>0</option><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></Select></td>)}<td>{cpmk.weight}%</td></tr>)}</tbody></table></div> : <Empty>Pilih CPL pada Bagian 1 untuk membentuk matriks dinamis.</Empty>}</> : <Empty>Tambahkan CPMK atau gunakan Generator Contoh.</Empty>}
          <h3 style={{ fontSize: 11, marginTop: 16 }}>Sub-CPMK ({state.subCpmk.length})</h3><div className={styles.toolbar}><button className={styles.button} onClick={() => update((draft) => { draft.subCpmk.push({ id: uid("sub"), code: `Sub-CPMK-${draft.subCpmk.length + 1}`, cpmkId: draft.cpmk[0]?.id ?? "", text: "", level: "C3" }); })} type="button">+ Tambah Sub-CPMK</button></div>{state.subCpmk.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Kode</th><th>CPMK</th><th>Pernyataan</th><th>Bloom</th><th /></tr></thead><tbody>{state.subCpmk.map((item, index) => <tr key={item.id}><td><Input value={item.code} onChange={(e) => update((draft) => { draft.subCpmk[index].code = e.target.value; })} /></td><td><Select value={item.cpmkId} onChange={(e) => update((draft) => { draft.subCpmk[index].cpmkId = e.target.value; })}><option value="">Pilih</option>{state.cpmk.map((cpmk) => <option key={cpmk.id} value={cpmk.id}>{cpmk.code}</option>)}</Select></td><td><Textarea value={item.text} onChange={(e) => update((draft) => { draft.subCpmk[index].text = e.target.value; })} /></td><td><Select value={item.level} onChange={(e) => update((draft) => { draft.subCpmk[index].level = e.target.value; })}>{["C1","C2","C3","C4","C5","C6"].map((level) => <option key={level}>{level}</option>)}</Select></td><td><button className={styles.buttonDanger} onClick={() => update((draft) => { draft.subCpmk.splice(index, 1); })} type="button">Hapus</button></td></tr>)}</tbody></table></div> : <Empty>Belum ada Sub-CPMK.</Empty>}
        </Section>

        <Section id="studio-schedule" title="3. Jadwal & Materi" subtitle="Rencana 16 minggu dengan outcome, topik, metode, media, dan assessment.">
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Minggu</th><th>CPMK</th><th>Sub-CPMK</th><th>Topik</th><th>Subtopik</th><th>Metode</th><th>Media</th><th>Asesmen</th></tr></thead><tbody>{state.schedule.map((row, index) => <tr key={row.week}><td>{row.week}</td><td><Select value={row.cpmkId} onChange={(e) => update((draft) => { draft.schedule[index].cpmkId = e.target.value; })}><option value="">—</option>{state.cpmk.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select></td><td><Select value={row.subCpmkId} onChange={(e) => update((draft) => { draft.schedule[index].subCpmkId = e.target.value; })}><option value="">—</option>{state.subCpmk.map((item) => <option key={item.id} value={item.id}>{item.code}</option>)}</Select></td><td><Input value={row.topic} onChange={(e) => update((draft) => { draft.schedule[index].topic = e.target.value; })} /></td><td><Input value={row.subtopic} onChange={(e) => update((draft) => { draft.schedule[index].subtopic = e.target.value; })} /></td><td><Input value={row.method} onChange={(e) => update((draft) => { draft.schedule[index].method = e.target.value; })} /></td><td><Input value={row.media} onChange={(e) => update((draft) => { draft.schedule[index].media = e.target.value; })} /></td><td><Input value={row.assessment} onChange={(e) => update((draft) => { draft.schedule[index].assessment = e.target.value; })} /></td></tr>)}</tbody></table></div>
          <div className={styles.grid2} style={{ marginTop: 14 }}><Field label="Referensi Utama (satu per baris)"><Textarea value={state.references.main.join("\n")} onChange={(e) => update((draft) => { draft.references.main = e.target.value.split("\n").filter(Boolean); })} /></Field><Field label="Referensi Tambahan (satu per baris)"><Textarea value={state.references.additional.join("\n")} onChange={(e) => update((draft) => { draft.references.additional = e.target.value.split("\n").filter(Boolean); })} /></Field></div>
        </Section>

        <Section id="studio-evaluation" title="4. Evaluasi" subtitle={`Assessment Blueprint · total bobot ${totalEvaluationWeight(state)}%.`}>
          <div className={styles.toolbar}><button className={styles.button} onClick={() => update((draft) => { draft.evaluations.push({ id: uid("eval"), name: "", weight: 0, cpmkIds: [], notes: "" }); })} type="button">+ Tambah Asesmen</button><span className={`${styles.chip} ${Math.abs(totalEvaluationWeight(state) - 100) > 0.01 ? styles.chipWarn : ""}`}>Total {totalEvaluationWeight(state)}%</span></div>
          {state.evaluations.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Asesmen</th><th>Bobot</th><th>CPMK yang diukur</th><th>Catatan</th><th /></tr></thead><tbody>{state.evaluations.map((item, index) => <tr key={item.id}><td><Input value={item.name} onChange={(e) => update((draft) => { draft.evaluations[index].name = e.target.value; })} /></td><td><Input min={0} max={100} type="number" value={item.weight} onChange={(e) => update((draft) => { draft.evaluations[index].weight = Number(e.target.value); })} /></td><td>{state.cpmk.map((cpmk) => <label key={cpmk.id} style={{ display: "inline-flex", gap: 4, margin: "2px 7px 2px 0" }}><input checked={item.cpmkIds.includes(cpmk.id)} onChange={(e) => update((draft) => { const ids = draft.evaluations[index].cpmkIds; draft.evaluations[index].cpmkIds = e.target.checked ? [...new Set([...ids, cpmk.id])] : ids.filter((id) => id !== cpmk.id); })} type="checkbox" />{cpmk.code}</label>)}</td><td><Textarea value={item.notes} onChange={(e) => update((draft) => { draft.evaluations[index].notes = e.target.value; })} /></td><td><button className={styles.buttonDanger} onClick={() => update((draft) => { draft.evaluations.splice(index, 1); })} type="button">Hapus</button></td></tr>)}</tbody></table></div> : <Empty>Belum ada asesmen.</Empty>}
        </Section>

        <Section id="studio-rubric" title="5. Rubrik & Evidence" subtitle="Rubrik 4 level dan evidence yang dapat ditelusuri.">
          <div className={styles.toolbar}><button className={styles.button} onClick={() => update((draft) => { draft.rubrics.push({ id: uid("rubric"), criterion: "", cpmkId: draft.cpmk[0]?.id ?? "", weight: 0, level4: "", level3: "", level2: "", level1: "" }); })} type="button">+ Kriteria Rubrik</button><button className={styles.button} onClick={() => update((draft) => { draft.evidence.push({ id: uid("ev"), code: `EV-${String(draft.evidence.length + 1).padStart(2, "0")}`, assessment: "", cpmkId: draft.cpmk[0]?.id ?? "", type: "", location: "", semester: draft.meta.review, status: "Pending" }); })} type="button">+ Evidence</button></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Kriteria</th><th>CPMK</th><th>Bobot</th><th>Level 4</th><th>Level 3</th><th>Level 2</th><th>Level 1</th><th /></tr></thead><tbody>{state.rubrics.map((item, index) => <tr key={item.id}><td><Input value={item.criterion} onChange={(e) => update((draft) => { draft.rubrics[index].criterion = e.target.value; })} /></td><td><Select value={item.cpmkId} onChange={(e) => update((draft) => { draft.rubrics[index].cpmkId = e.target.value; })}>{state.cpmk.map((cpmk) => <option key={cpmk.id} value={cpmk.id}>{cpmk.code}</option>)}</Select></td><td><Input type="number" value={item.weight} onChange={(e) => update((draft) => { draft.rubrics[index].weight = Number(e.target.value); })} /></td>{(["level4","level3","level2","level1"] as const).map((field) => <td key={field}><Textarea value={item[field]} onChange={(e) => update((draft) => { draft.rubrics[index][field] = e.target.value; })} /></td>)}<td><button className={styles.buttonDanger} onClick={() => update((draft) => { draft.rubrics.splice(index, 1); })} type="button">Hapus</button></td></tr>)}{!state.rubrics.length ? <tr><td colSpan={8}>Belum ada rubrik.</td></tr> : null}</tbody></table></div>
          <h3 style={{ fontSize: 11, marginTop: 16 }}>Assessment Evidence</h3><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Kode</th><th>Asesmen</th><th>CPMK</th><th>Tipe</th><th>Lokasi</th><th>Semester</th><th>Status</th><th /></tr></thead><tbody>{state.evidence.map((item, index) => <tr key={item.id}><td><Input value={item.code} onChange={(e) => update((draft) => { draft.evidence[index].code = e.target.value; })} /></td><td><Input value={item.assessment} onChange={(e) => update((draft) => { draft.evidence[index].assessment = e.target.value; })} /></td><td><Select value={item.cpmkId} onChange={(e) => update((draft) => { draft.evidence[index].cpmkId = e.target.value; })}>{state.cpmk.map((cpmk) => <option key={cpmk.id} value={cpmk.id}>{cpmk.code}</option>)}</Select></td><td><Input value={item.type} onChange={(e) => update((draft) => { draft.evidence[index].type = e.target.value; })} /></td><td><Input value={item.location} onChange={(e) => update((draft) => { draft.evidence[index].location = e.target.value; })} /></td><td><Input value={item.semester} onChange={(e) => update((draft) => { draft.evidence[index].semester = e.target.value; })} /></td><td><Select value={item.status} onChange={(e) => update((draft) => { draft.evidence[index].status = e.target.value as "Pending" | "Verified"; })}><option>Pending</option><option>Verified</option></Select></td><td><button className={styles.buttonDanger} onClick={() => update((draft) => { draft.evidence.splice(index, 1); })} type="button">Hapus</button></td></tr>)}{!state.evidence.length ? <tr><td colSpan={8}>Belum ada evidence.</td></tr> : null}</tbody></table></div>
        </Section>

        <Section id="studio-attainment" title="6. Attainment" subtitle="Level 4 · target dan evidence ketercapaian CPMK.">
          <div className={styles.toolbar}><button className={styles.button} onClick={() => update((draft) => { draft.attainment = draft.cpmk.map((cpmk, index) => draft.attainment.find((item) => item.cpmkId === cpmk.id) ?? { id: `att-${index + 1}`, cpmkId: cpmk.id, targetScore: 70, targetStudents: 75, mean: null, achievedStudents: null, notes: "" }); })} type="button">Sinkronkan CPMK</button></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>CPMK</th><th>Target Nilai</th><th>Target Mahasiswa %</th><th>Mean</th><th>Tercapai %</th><th>Catatan</th></tr></thead><tbody>{state.attainment.map((item, index) => <tr key={item.id}><td>{cpmkCode(state, item.cpmkId)}</td><td><Input type="number" value={item.targetScore} onChange={(e) => update((draft) => { draft.attainment[index].targetScore = Number(e.target.value); })} /></td><td><Input type="number" value={item.targetStudents} onChange={(e) => update((draft) => { draft.attainment[index].targetStudents = Number(e.target.value); })} /></td><td><Input placeholder="belum ada" type="number" value={item.mean ?? ""} onChange={(e) => update((draft) => { draft.attainment[index].mean = e.target.value ? Number(e.target.value) : null; })} /></td><td><Input placeholder="belum ada" type="number" value={item.achievedStudents ?? ""} onChange={(e) => update((draft) => { draft.attainment[index].achievedStudents = e.target.value ? Number(e.target.value) : null; })} /></td><td><Textarea value={item.notes} onChange={(e) => update((draft) => { draft.attainment[index].notes = e.target.value; })} /></td></tr>)}{!state.attainment.length ? <tr><td colSpan={6}>Belum ada attainment. Sinkronkan CPMK saat siap mengevaluasi.</td></tr> : null}</tbody></table></div>
        </Section>

        <Section id="studio-improvement" title="7. Continuous Improvement" subtitle="Closed loop: outcome gap → evidence → root cause → action → PIC → status.">
          <div className={styles.toolbar}><button className={styles.button} onClick={() => update((draft) => { draft.improvements.push({ id: uid("imp"), outcome: "", finding: "", evidence: "", rootCause: "", action: "", pic: "", status: "Planned" }); })} type="button">+ Improvement</button></div>
          <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Outcome</th><th>Finding</th><th>Evidence</th><th>Root Cause</th><th>Action</th><th>PIC</th><th>Status</th><th /></tr></thead><tbody>{state.improvements.map((item, index) => <tr key={item.id}><td><Input value={item.outcome} onChange={(e) => update((draft) => { draft.improvements[index].outcome = e.target.value; })} /></td><td><Textarea value={item.finding} onChange={(e) => update((draft) => { draft.improvements[index].finding = e.target.value; })} /></td><td><Textarea value={item.evidence} onChange={(e) => update((draft) => { draft.improvements[index].evidence = e.target.value; })} /></td><td><Textarea value={item.rootCause} onChange={(e) => update((draft) => { draft.improvements[index].rootCause = e.target.value; })} /></td><td><Textarea value={item.action} onChange={(e) => update((draft) => { draft.improvements[index].action = e.target.value; })} /></td><td><Input value={item.pic} onChange={(e) => update((draft) => { draft.improvements[index].pic = e.target.value; })} /></td><td><Select value={item.status} onChange={(e) => update((draft) => { draft.improvements[index].status = e.target.value as "Planned" | "Done" | "Verified"; })}><option>Planned</option><option>Done</option><option>Verified</option></Select></td><td><button className={styles.buttonDanger} onClick={() => update((draft) => { draft.improvements.splice(index, 1); })} type="button">Hapus</button></td></tr>)}{!state.improvements.length ? <tr><td colSpan={8}>Belum ada continuous improvement.</td></tr> : null}</tbody></table></div>
        </Section>

        <Section id="studio-curriculum" title="8. Curriculum Context" subtitle="Level 3 — Curriculum Intelligence Context tanpa mengarang mapping yang belum dipublikasikan.">
          <div className={styles.grid3}><Field label="Program"><Input value={state.curriculumContext.program} onChange={(e) => update((draft) => { draft.curriculumContext.program = e.target.value; })} /></Field><Field label="Kurikulum"><Input value={state.curriculumContext.curriculum} onChange={(e) => update((draft) => { draft.curriculumContext.curriculum = e.target.value; })} /></Field><Field label="I-R-M"><Select value={state.curriculumContext.currentRole} onChange={(e) => update((draft) => { draft.curriculumContext.currentRole = e.target.value as "I" | "R" | "M"; })}><option value="I">I · Introductory</option><option value="R">R · Reinforce</option><option value="M">M · Mastery</option></Select></Field></div>
          <div className={styles.banner} style={{ marginTop: 12, marginBottom: 0 }}>Katalog program memiliki <strong>{state.cplCatalog.length} CPL</strong>; RPS ini saat ini membebankan <strong>{state.cpl.length} CPL</strong>. Matriks mengikuti jumlah CPL yang dipilih secara dinamis.</div>
        </Section>

        <Section id="studio-final" title="9. Final Document" subtitle="Validasi deterministik, verifikasi manual, preview cetak, dan DOCX." print>
          <div className={styles.grid3}><Field label="Penyusun"><Input value={state.validation.author} onChange={(e) => update((draft) => { draft.validation.author = e.target.value; })} /></Field><Field label="ID Penyusun"><Input value={state.validation.authorId} onChange={(e) => update((draft) => { draft.validation.authorId = e.target.value; })} /></Field><Field label="Koordinator"><Input value={state.validation.coordinator} onChange={(e) => update((draft) => { draft.validation.coordinator = e.target.value; })} /></Field><Field label="ID Koordinator"><Input value={state.validation.coordinatorId} onChange={(e) => update((draft) => { draft.validation.coordinatorId = e.target.value; })} /></Field><Field label="Kaprodi"><Input value={state.validation.head} onChange={(e) => update((draft) => { draft.validation.head = e.target.value; })} /></Field><Field label="ID Kaprodi"><Input value={state.validation.headId} onChange={(e) => update((draft) => { draft.validation.headId = e.target.value; })} /></Field></div>
          <div className={styles.toolbar} style={{ marginTop: 12 }}><button className={styles.buttonPrimary} onClick={validate} type="button">Validasi Dokumen</button><button className={styles.button} onClick={() => window.print()} type="button">Cetak Preview</button></div>
          <label className={styles.verifyBox}><input checked={manualVerified} onChange={(e) => setManualVerified(e.target.checked)} type="checkbox" /><span>Saya sudah memeriksa identitas, CPL, CPMK, alignment, jadwal, asesmen, rubrik, evidence, dan continuous improvement. Saya memahami bahwa hasil Generator Contoh harus ditinjau manual.</span></label>
          <div className={styles.toolbar} style={{ marginTop: 10 }}><button className={styles.buttonPrimary} disabled={!manualVerified || !state.audit.validated} onClick={reverify} type="button">Verifikasi Ulang &amp; Kunci</button><button className={styles.buttonPrimary} disabled={!state.audit.reverified} onClick={() => downloadRpsDocx(state)} type="button">Export DOCX</button>{state.audit.reverified ? <span className={styles.chip}>{state.audit.hash}</span> : <span className={`${styles.chip} ${styles.chipGray}`}>Belum terkunci</span>}</div><FinalPreview state={state} />
        </Section>
      </div>
      <aside className={styles.inspector}><header className={styles.inspectorHead}><h2>OBE Inspector</h2><p>Rules-first · dinamis · dapat diverifikasi</p></header><div className={styles.inspectorBody}><div className={styles.scoreGrid}><div className={`${styles.score} ${styles.scoreError}`}><strong>{counts.errors}</strong><span>Critical</span></div><div className={`${styles.score} ${styles.scoreWarning}`}><strong>{counts.warnings}</strong><span>Caution</span></div><div className={`${styles.score} ${styles.scorePass}`}><strong>{counts.passes}</strong><span>Pass</span></div></div><div className={styles.metrics}><div className={styles.metric}><strong>{state.cpl.length}</strong><span>CPL aktif</span></div><div className={styles.metric}><strong>{state.cpmk.length}</strong><span>CPMK</span></div><div className={styles.metric}><strong>{totalEvaluationWeight(state)}%</strong><span>Evaluasi</span></div></div>{issues.map((issue, index) => <div className={`${styles.issue} ${issue.severity === "error" ? styles.issueError : issue.severity === "warning" ? styles.issueWarning : styles.issuePass}`} key={`${issue.title}-${index}`}><strong>{issue.title}</strong><span>{issue.detail}</span></div>)}</div></aside>
    </div> : null}
  </main></div>;
}
