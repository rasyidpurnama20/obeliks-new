"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadMonitoringRps, type MonitoringRpsItem, type MonitoringRpsPayload } from "./monitoring-rps-actions";
import styles from "./clean-workspace.module.css";

type Filter = "all" | "draft" | "processing" | "review" | "approved" | "failed";

function pathNow() {
  return typeof window === "undefined" ? "" : window.location.pathname.replace(/\/$/, "") || "/";
}

function go(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new Event("obeliks:navigation"));
}

function matchesStatus(item: MonitoringRpsItem, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "processing") return ["queued", "parsing", "extracting"].includes(item.status);
  return item.status === filter;
}

function tone(status: MonitoringRpsItem["status"]) {
  if (status === "approved") return styles.green;
  if (status === "failed") return styles.red;
  if (status === "review") return styles.purple;
  if (["queued", "parsing", "extracting"].includes(status)) return styles.amber;
  return styles.gray;
}

export function MonitoringRpsPanel() {
  const [path, setPath] = useState("");
  const [payload, setPayload] = useState<MonitoringRpsPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const sync = () => setPath(pathNow());
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("obeliks:navigation", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("obeliks:navigation", sync);
    };
  }, []);

  const refresh = useCallback(async () => {
    setBusy(true);
    const result = await loadMonitoringRps();
    if (result.ok) {
      setPayload(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setBusy(false);
  }, []);

  useEffect(() => {
    if (path === "/monitoring-rps" && !payload && !busy) void refresh();
  }, [busy, path, payload, refresh]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("id-ID");
    return (payload?.items ?? []).filter((item) => {
      const haystack = `${item.code} ${item.courseName} ${item.owner} ${item.period} ${item.statusLabel}`.toLocaleLowerCase("id-ID");
      return (!needle || haystack.includes(needle)) && matchesStatus(item, filter);
    });
  }, [filter, payload, query]);

  if (path !== "/monitoring-rps") return null;

  const counts = payload?.counts ?? { draft: 0, processing: 0, review: 0, approved: 0, failed: 0 };
  const stage = payload?.currentStageTitle ?? "Belum ada tahapan aktif";

  return (
    <div className={styles.overlay} data-clean-workspace="monitoring-rps">
      <main className={styles.page}>
        <header className={styles.heading}>
          <div>
            <h1>Monitoring RPS</h1>
            <p>Tahapan saat ini: <strong>{stage}</strong></p>
          </div>
          <button className={styles.secondary} disabled={busy} onClick={() => void refresh()} type="button">Muat ulang</button>
        </header>

        {error ? <div className={styles.error} role="alert">{error}</div> : null}

        <section aria-label="Jumlah RPS per status" className={styles.metrics}>
          <article className={styles.metric}><span>Draft</span><strong>{counts.draft}</strong></article>
          <article className={styles.metric}><span>Diproses</span><strong>{counts.processing}</strong></article>
          <article className={styles.metric}><span>Review</span><strong>{counts.review}</strong></article>
          <article className={styles.metric}><span>Disetujui</span><strong>{counts.approved}</strong></article>
          <article className={styles.metric}><span>Gagal</span><strong>{counts.failed}</strong></article>
        </section>

        <section className={styles.card}>
          <div className={styles.toolbar}>
            <input aria-label="Cari RPS" className={styles.search} onChange={(event) => setQuery(event.target.value)} placeholder="Cari mata kuliah, kode, dosen, atau periode…" type="search" value={query} />
            <select aria-label="Filter status RPS" className={styles.select} onChange={(event) => setFilter(event.target.value as Filter)} value={filter}>
              <option value="all">Semua status</option>
              <option value="draft">Draft</option>
              <option value="processing">Diproses</option>
              <option value="review">Review</option>
              <option value="approved">Disetujui</option>
              <option value="failed">Gagal</option>
            </select>
            <span className={`${styles.badge} ${styles.gray}`}>{filtered.length} RPS</span>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>RPS / Mata kuliah</th><th>Penanggung jawab</th><th>Periode</th><th>Status</th><th>Progress</th><th>Aksi</th></tr></thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.code} · {item.courseName}</strong><small>Versi {item.version} · diperbarui {item.updatedAt}</small></td>
                    <td>{item.owner}</td>
                    <td>{item.period}</td>
                    <td><span className={`${styles.badge} ${tone(item.status)}`}>{item.statusLabel}</span>{item.issues ? <small>{item.issues} temuan validasi</small> : null}</td>
                    <td>
                      <div className={styles.progress}>
                        <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${item.progress}%` }} /></div>
                        <small>{item.progress}%</small>
                      </div>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.secondary} disabled={!payload?.canCompose} onClick={() => go(`/monitoring-rps/penyusunan?id=${encodeURIComponent(item.id)}`)} title={payload?.canCompose ? "Buka Penyusunan RPS Inspector" : "Tersedia pada tahap Penyusunan RPS"} type="button">Susun</button>
                        <button className={styles.secondary} disabled={!payload?.canEvaluate} onClick={() => go(`/monitoring-rps/evaluasi?id=${encodeURIComponent(item.id)}`)} title={payload?.canEvaluate ? "Buka Evaluasi RPS Inspector" : "Tersedia pada tahap pelaksanaan/evaluasi"} type="button">Eval</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!filtered.length ? <tr><td colSpan={6}><div className={styles.empty}><div><strong>Belum ada RPS</strong><span>Daftar akan muncul setelah RPS dibuat pada periode aktif.</span></div></div></td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
