"use client";

import { createPortal } from "react-dom";
import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AssignableRole, ManagedUser } from "@/lib/admin/user-types";
import { createManagedUser } from "./user-actions";
import { createCustomManagedUser } from "./custom-user-actions";

type UserAccessControlsProps = {
  initialUsers: ManagedUser[];
};

type AddMode = "picker" | "manual" | "bulk" | "siap" | null;
type ManualMethod = "invite" | "custom";

type ImportCandidate = {
  line: number;
  displayName: string;
  email: string;
  identifier: string;
  roles: AssignableRole[];
  error?: string;
  existing?: boolean;
};

const roleLabels: Record<AssignableRole, string> = {
  kaprodi: "Kaprodi",
  gpm: "GPM",
  dosen: "Dosen",
  mahasiswa: "Mahasiswa",
};

const roleOrder: AssignableRole[] = ["dosen", "gpm", "kaprodi", "mahasiswa"];
const MAX_IMPORT = 100;
const DEFAULT_PASSWORD = "user123";

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function findColumn(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.includes(header));
}

function parseRoles(value: string, fallback?: AssignableRole): AssignableRole[] {
  if (!value.trim() && fallback) return [fallback];
  const allowed = new Set<AssignableRole>(["kaprodi", "gpm", "dosen", "mahasiswa"]);
  const parsed = value
    .toLocaleLowerCase("id-ID")
    .split(/[|/+]/)
    .map((role) => role.trim().replace(/\s+/g, ""))
    .filter(Boolean)
    .map((role) => role === "student" ? "mahasiswa" : role === "lecturer" ? "dosen" : role)
    .filter((role): role is AssignableRole => allowed.has(role as AssignableRole));
  return [...new Set(parsed)];
}

function parseImportCsv(
  text: string,
  existingEmails: Set<string>,
  options: { fallbackRole?: AssignableRole; forceRole?: boolean } = {},
): ImportCandidate[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const rowCount = lines.length - 1;
  if (rowCount > MAX_IMPORT) {
    return [{
      line: 1,
      displayName: "",
      email: "",
      identifier: "",
      roles: [],
      error: `Maksimal ${MAX_IMPORT} akun per batch. File ini berisi ${rowCount} akun.`,
    }];
  }

  const commaCount = (lines[0].match(/,/g) ?? []).length;
  const semicolonCount = (lines[0].match(/;/g) ?? []).length;
  const delimiter = semicolonCount > commaCount ? ";" : ",";
  const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
  const nameIndex = findColumn(headers, ["nama", "name", "nama_lengkap", "display_name"]);
  const emailIndex = findColumn(headers, ["email", "email_undip", "surel"]);
  const roleIndex = findColumn(headers, ["peran", "role", "roles"]);
  const identifierIndex = findColumn(headers, ["nip_nim", "nip", "nim", "identifier", "id_pengguna"]);

  if (nameIndex < 0 || emailIndex < 0 || (roleIndex < 0 && !options.fallbackRole)) {
    return [{
      line: 1,
      displayName: "",
      email: "",
      identifier: "",
      roles: [],
      error: options.fallbackRole
        ? "Header wajib: nama dan email."
        : "Header wajib: nama, email, dan peran.",
    }];
  }

  const seen = new Set<string>();
  return lines.slice(1).map((line, offset) => {
    const cells = splitCsvLine(line, delimiter);
    const displayName = cells[nameIndex]?.trim() ?? "";
    const email = (cells[emailIndex]?.trim() ?? "").toLocaleLowerCase("id-ID");
    const identifier = identifierIndex >= 0 ? cells[identifierIndex]?.trim() ?? "" : "";
    const roles = options.forceRole && options.fallbackRole
      ? [options.fallbackRole]
      : parseRoles(roleIndex >= 0 ? cells[roleIndex] ?? "" : "", options.fallbackRole);
    let error: string | undefined;

    if (displayName.length < 2 || displayName.length > 120) error = "Nama harus 2–120 karakter";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254) error = "Email tidak valid";
    else if (!roles.length) error = "Peran tidak valid";
    else if (seen.has(email)) error = "Duplikat di file";

    seen.add(email);
    return {
      line: offset + 2,
      displayName,
      email,
      identifier,
      roles,
      error,
      existing: !error && existingEmails.has(email),
    };
  });
}

function validateManual(displayName: string, email: string, roles: AssignableRole[]) {
  const name = displayName.trim().replace(/\s+/g, " ");
  const normalizedEmail = email.trim().toLocaleLowerCase("id-ID");
  if (name.length < 2 || name.length > 120) return "Nama harus berisi 2–120 karakter.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizedEmail) || normalizedEmail.length > 254) return "Gunakan email institusi yang valid.";
  if (!roles.length) return "Pilih minimal satu peran.";
  return "";
}

export function UserAccessControls({ initialUsers }: UserAccessControlsProps) {
  const [actionHost, setActionHost] = useState<HTMLElement | null>(null);
  const [infoHost, setInfoHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<AddMode>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState("");
  const [failures, setFailures] = useState<string[]>([]);
  const [siapLoggedIn, setSiapLoggedIn] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [manualRoles, setManualRoles] = useState<AssignableRole[]>([]);
  const [manualMethod, setManualMethod] = useState<ManualMethod>("invite");
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState("");

  const existingEmails = useMemo(
    () => new Set(initialUsers.map((user) => user.email.toLocaleLowerCase("id-ID"))),
    [initialUsers],
  );

  const stats = useMemo(() => ({
    ready: candidates.filter((item) => !item.error && !item.existing).length,
    existing: candidates.filter((item) => item.existing).length,
    error: candidates.filter((item) => item.error).length,
  }), [candidates]);

  useEffect(() => {
    const sync = () => {
      const heading = [...document.querySelectorAll<HTMLHeadingElement>("h1")]
        .find((item) => item.textContent?.trim() === "Pengguna & Akses");
      const pageHeading = heading?.closest<HTMLElement>('div[class*="pageHeading"]') ?? null;
      const nextActionHost = pageHeading?.querySelector<HTMLElement>('div[class*="headingAction"]') ?? null;
      const nextInfoHost = heading?.parentElement ?? null;
      const isActive = Boolean(heading && pageHeading);
      setActive((current) => current === isActive ? current : isActive);
      setActionHost((current) => current === nextActionHost ? current : nextActionHost);
      setInfoHost((current) => current === nextInfoHost ? current : nextInfoHost);
      if (!isActive) setMode(null);
    };

    sync();
    const observer = new MutationObserver(sync);
    const main = document.querySelector("#main-content");
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (active) document.documentElement.dataset.obeUserAccess = "true";
    else delete document.documentElement.dataset.obeUserAccess;
    return () => { delete document.documentElement.dataset.obeUserAccess; };
  }, [active]);

  useEffect(() => {
    if (!mode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !importing && !manualBusy) setMode(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [importing, manualBusy, mode]);

  function resetFlow(nextMode: AddMode) {
    setCandidates([]);
    setFileName("");
    setReport("");
    setFailures([]);
    setManualMessage("");
    if (nextMode === "manual") {
      setManualName("");
      setManualEmail("");
      setManualRoles([]);
      setManualMethod("invite");
    }
    if (nextMode === "siap") setSiapLoggedIn(false);
    setMode(nextMode);
  }

  async function readCsv(file: File, siap = false) {
    setFileName(file.name);
    setReport("");
    setFailures([]);
    const text = await file.text();
    setCandidates(parseImportCsv(text, existingEmails, siap
      ? { fallbackRole: "mahasiswa", forceRole: true }
      : {}));
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (manualBusy) return;
    const validation = validateManual(manualName, manualEmail, manualRoles);
    if (validation) {
      setManualMessage(validation);
      return;
    }
    const email = manualEmail.trim().toLocaleLowerCase("id-ID");
    if (existingEmails.has(email)) {
      setManualMessage("Email tersebut sudah terdaftar. Cari akun yang ada terlebih dahulu.");
      return;
    }

    setManualBusy(true);
    setManualMessage("");
    try {
      const draft = { displayName: manualName, email, roles: manualRoles };
      const result = manualMethod === "invite"
        ? await createManagedUser(draft)
        : await createCustomManagedUser({ draft, source: "manual" });
      setManualMessage(result.message);
      if (result.ok) setReport(result.message);
    } catch {
      setManualMessage("Pembuatan akun gagal karena koneksi terputus.");
    } finally {
      setManualBusy(false);
    }
  }

  async function importUsers() {
    const ready = candidates.filter((item) => !item.error && !item.existing);
    if (!ready.length || importing) return;
    setImporting(true);
    setReport("");
    setFailures([]);
    let succeeded = 0;
    const failed: string[] = [];

    for (const candidate of ready) {
      try {
        const draft = {
          displayName: candidate.displayName,
          email: candidate.email,
          roles: mode === "siap" ? ["mahasiswa" as const] : candidate.roles,
        };
        const result = mode === "siap"
          ? await createCustomManagedUser({ draft, source: "siap" })
          : await createManagedUser(draft);
        if (result.ok) succeeded += 1;
        else failed.push(`${candidate.email}: ${result.message}`);
      } catch {
        failed.push(`${candidate.email}: koneksi terputus`);
      }
    }

    setFailures(failed.slice(0, 5));
    setReport(`${succeeded} akun berhasil dibuat${failed.length ? ` · ${failed.length} gagal` : ""}.`);
    setImporting(false);
  }

  function toggleManualRole(role: AssignableRole) {
    setManualRoles((current) => current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role]);
    setManualMessage("");
  }

  function openSiap() {
    window.open("https://siap.undip.ac.id/", "_blank", "noopener,noreferrer");
  }

  if (!active) return null;

  const trigger = actionHost ? createPortal(
    <button className="obe-user-add-button" onClick={() => resetFlow("picker")} type="button">
      <span aria-hidden="true">＋</span> Tambah pengguna
    </button>,
    actionHost,
  ) : null;

  const info = infoHost ? createPortal(
    <p className="obe-user-flow-note">
      Mahasiswa dibuat sebagai akun di sini; KRS dan keanggotaan kelas tetap dikelola pada Kelas &amp; Pengampu.
    </p>,
    infoHost,
  ) : null;

  const modalTitle = mode === "picker" ? "Tambah pengguna"
    : mode === "manual" ? "Buat akun manual"
      : mode === "bulk" ? "Impor CSV"
        : "Sinkron dari SIAP";

  return (
    <>
      {trigger}
      {info}
      {mode ? createPortal(
        <div className="obe-user-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !importing && !manualBusy) setMode(null); }}>
          <section aria-labelledby="obe-user-modal-title" aria-modal="true" className="obe-user-modal" role="dialog">
            <div className="obe-user-modal-head">
              <div>
                <span>Superadmin</span>
                <h2 id="obe-user-modal-title">{modalTitle}</h2>
              </div>
              <button aria-label="Tutup" disabled={importing || manualBusy} onClick={() => setMode(null)} type="button">×</button>
            </div>

            {mode === "picker" ? (
              <div className="obe-user-methods">
                <button onClick={() => resetFlow("manual")} type="button">
                  <strong>Buat akun manual</strong>
                  <span>Nama, email institusi, dan peran. Pilih Undangan atau Custom User.</span>
                  <b className="obe-method-chevron" aria-hidden="true">&gt;</b>
                </button>
                <button onClick={() => resetFlow("bulk")} type="button">
                  <strong>Impor CSV</strong>
                  <span>CSV sampai {MAX_IMPORT} akun per batch.</span>
                  <b className="obe-method-chevron" aria-hidden="true">&gt;</b>
                </button>
                <button onClick={() => resetFlow("siap")} type="button">
                  <strong>Sinkron dari SIAP</strong>
                  <span>Login SIAP dulu, lalu impor hasil ekspor. Khusus Mahasiswa.</span>
                  <b className="obe-method-chevron" aria-hidden="true">&gt;</b>
                </button>
              </div>
            ) : null}

            {mode === "manual" ? (
              <form className="obe-manual-body" onSubmit={submitManual}>
                <div className="obe-choice-panel" role="radiogroup" aria-label="Cara membuat akun">
                  <button aria-pressed={manualMethod === "invite"} className={manualMethod === "invite" ? "active" : ""} onClick={() => { setManualMethod("invite"); setManualMessage(""); }} type="button">
                    <span className="obe-choice-mark">{manualMethod === "invite" ? "✓" : ""}</span>
                    <span><strong>Undangan</strong><small>Kirim email aktivasi; pengguna membuat password sendiri.</small></span>
                  </button>
                  <button aria-pressed={manualMethod === "custom"} className={manualMethod === "custom" ? "active" : ""} onClick={() => { setManualMethod("custom"); setManualMessage(""); }} type="button">
                    <span className="obe-choice-mark">{manualMethod === "custom" ? "✓" : ""}</span>
                    <span><strong>Custom User</strong><small>Langsung aktif dengan password awal {DEFAULT_PASSWORD}.</small></span>
                  </button>
                </div>

                <div className="obe-form-grid">
                  <label><span>Nama</span><input autoComplete="off" disabled={manualBusy} maxLength={120} onChange={(event) => { setManualName(event.target.value); setManualMessage(""); }} placeholder="Nama lengkap" value={manualName} /></label>
                  <label><span>Email institusi</span><input autoComplete="off" disabled={manualBusy} maxLength={254} onChange={(event) => { setManualEmail(event.target.value); setManualMessage(""); }} placeholder="nama@institusi.ac.id" type="email" value={manualEmail} /></label>
                </div>

                <fieldset className="obe-role-grid">
                  <legend>Peran</legend>
                  {roleOrder.map((role) => (
                    <label key={role}><input checked={manualRoles.includes(role)} disabled={manualBusy} onChange={() => toggleManualRole(role)} type="checkbox" /><span>{roleLabels[role]}</span></label>
                  ))}
                </fieldset>

                {manualMethod === "custom" ? (
                  <div className="obe-password-panel">
                    <span className="obe-panel-mark">!</span>
                    <div><strong>Password awal <code>{DEFAULT_PASSWORD}</code></strong><small>Akun langsung aktif. Demi keamanan, pengguna wajib mengganti password pada login pertama.</small></div>
                  </div>
                ) : null}

                {manualMessage ? <p className={report ? "obe-inline-message success" : "obe-inline-message"}>{manualMessage}</p> : null}
                <div className="obe-user-modal-actions">
                  <button disabled={manualBusy} onClick={() => resetFlow("picker")} type="button">Kembali</button>
                  {report ? <button onClick={() => window.location.reload()} type="button">Muat ulang daftar</button> : null}
                  <button className="primary" disabled={manualBusy} type="submit">{manualBusy ? "Memproses…" : manualMethod === "invite" ? "Kirim undangan" : "Buat Custom User"}</button>
                </div>
              </form>
            ) : null}

            {mode === "bulk" ? (
              <div className="obe-import-body">
                <div className="obe-control-panel">
                  <span className="obe-panel-mark">✓</span>
                  <div><strong>Impor terkontrol</strong><small>Maksimal {MAX_IMPORT} akun per batch · preview & validasi sebelum akun dibuat · akun baru menerima undangan email.</small></div>
                </div>
                <div className="obe-import-note"><strong>Format CSV</strong><span><code>nama,email,peran</code>. Peran: mahasiswa, dosen, GPM, atau Kaprodi. Multi-role gunakan tanda |.</span></div>
                <label className="obe-file-box">
                  <strong>{fileName || "Pilih file CSV"}</strong>
                  <span>File tidak langsung diproses. OBELIKS menampilkan validasi, duplikat, dan jumlah akun siap terlebih dahulu.</span>
                  <input accept=".csv,text/csv" disabled={importing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCsv(file); }} type="file" />
                </label>
              </div>
            ) : null}

            {mode === "siap" ? (
              <div className="obe-import-body">
                <div className="obe-control-panel student">
                  <span className="obe-panel-mark">M</span>
                  <div><strong>Khusus akun Mahasiswa</strong><small>Peran dikunci ke Mahasiswa · password awal <code>{DEFAULT_PASSWORD}</code> · wajib diganti pada login pertama.</small></div>
                </div>
                <div className="obe-siap-step">
                  <span>1</span><div><strong>Login SIAP UNDIP terlebih dahulu</strong><small>OBELIKS tidak meminta atau menyimpan password SIAP.</small></div><button onClick={openSiap} type="button">Buka SIAP ↗</button>
                </div>
                <label className="obe-check"><input checked={siapLoggedIn} onChange={(event) => { setSiapLoggedIn(event.target.checked); setCandidates([]); setFileName(""); }} type="checkbox" /><span>Saya sudah login ke SIAP UNDIP</span></label>
                <div className="obe-siap-step">
                  <span>2</span><div><strong>Ekspor data mahasiswa dari SIAP</strong><small>Untuk sementara sinkronisasi memakai file ekspor resmi; tidak ada scraping akun.</small></div>
                </div>
                <label className={`obe-file-box ${!siapLoggedIn ? "disabled" : ""}`}>
                  <strong>{fileName || "Unggah CSV hasil ekspor mahasiswa"}</strong>
                  <span>Header minimal: nama,email. NIM boleh ada untuk referensi preview. Semua akun yang dibuat otomatis berperan Mahasiswa.</span>
                  <input accept=".csv,text/csv" disabled={!siapLoggedIn || importing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void readCsv(file, true); }} type="file" />
                </label>
              </div>
            ) : null}

            {(mode === "bulk" || mode === "siap") && candidates.length ? (
              <div className="obe-import-preview">
                <div className="obe-import-stats"><span><strong>{stats.ready}</strong> siap</span><span><strong>{stats.existing}</strong> sudah ada</span><span><strong>{stats.error}</strong> bermasalah</span></div>
                <div className="obe-import-list">
                  {candidates.slice(0, 8).map((candidate) => (
                    <div key={`${candidate.line}-${candidate.email}`}>
                      <span className={candidate.error ? "bad" : candidate.existing ? "existing" : "ok"}>{candidate.error ? "!" : candidate.existing ? "=" : "✓"}</span>
                      <div><strong>{candidate.displayName || `Baris ${candidate.line}`}</strong><small>{candidate.email || candidate.error}{candidate.identifier ? ` · ${candidate.identifier}` : ""}</small></div>
                      <em>{candidate.error ?? (candidate.existing ? "Sudah ada" : candidate.roles.map((role) => roleLabels[role]).join(", "))}</em>
                    </div>
                  ))}
                </div>
                {candidates.length > 8 ? <small className="obe-more">+ {candidates.length - 8} baris lain</small> : null}
              </div>
            ) : null}

            {(mode === "bulk" || mode === "siap") && report ? <div className="obe-import-report"><strong>{report}</strong>{failures.map((failure) => <small key={failure}>{failure}</small>)}<button onClick={() => window.location.reload()} type="button">Muat ulang daftar</button></div> : null}

            {mode === "bulk" || mode === "siap" ? (
              <div className="obe-user-modal-actions">
                <button disabled={importing} onClick={() => resetFlow("picker")} type="button">Kembali</button>
                {fileName ? <button disabled={importing} onClick={() => { setFileName(""); setCandidates([]); setReport(""); setFailures([]); }} type="button">Ganti file</button> : null}
                <button className="primary" disabled={!stats.ready || importing} onClick={() => void importUsers()} type="button">{importing ? "Memproses…" : mode === "siap" ? `Buat ${stats.ready} Mahasiswa` : `Impor ${stats.ready} akun`}</button>
              </div>
            ) : null}
          </section>
        </div>,
        document.body,
      ) : null}

      <style jsx global>{`
        html[data-obe-user-access="true"] [class*="headingAction"] > button:not(.obe-user-add-button) { display: none !important; }
        html[data-obe-user-access="true"] table[class*="userTable"] th:nth-child(3),
        html[data-obe-user-access="true"] table[class*="userTable"] td:nth-child(3),
        html[data-obe-user-access="true"] table[class*="userTable"] th:nth-child(5),
        html[data-obe-user-access="true"] table[class*="userTable"] td:nth-child(5) { display: none; }
        .obe-user-add-button { display: inline-flex; align-items: center; gap: 7px; border: 0; border-radius: 9px; background: #08766f; color: white; padding: 10px 14px; font: inherit; font-size: 11px; font-weight: 800; cursor: pointer; }
        .obe-user-add-button:hover { background: #06665f; }
        .obe-user-flow-note { margin: 8px 0 0 !important; max-width: 760px; color: #667785 !important; font-size: 10px !important; line-height: 1.45; }
        .obe-user-modal-backdrop { position: fixed; inset: 0; z-index: 500; display: grid; place-items: center; background: rgba(8,25,38,.48); padding: 18px; }
        .obe-user-modal { width: min(680px, 100%); max-height: min(800px, calc(100vh - 36px)); overflow: auto; border-radius: 16px; background: #fff; box-shadow: 0 24px 70px rgba(8,25,38,.28); color: #17212b; }
        .obe-user-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 19px 21px 15px; border-bottom: 1px solid #e7ecef; }
        .obe-user-modal-head span { color: #08766f; font-size: 9px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
        .obe-user-modal-head h2 { margin: 4px 0 0; font-size: 18px; }
        .obe-user-modal-head > button { width: 32px; height: 32px; border: 0; border-radius: 8px; background: #f2f5f7; color: #5b6975; font-size: 19px; cursor: pointer; }
        .obe-user-methods { display: grid; gap: 9px; padding: 18px 20px 21px; }
        .obe-user-methods > button { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 3px 12px; align-items: center; border: 1px solid #dfe6eb; border-radius: 12px; background: white; padding: 14px 15px; text-align: left; cursor: pointer; }
        .obe-user-methods > button:hover { border-color: #94c9c4; background: #f5fbfa; }
        .obe-user-methods strong { font-size: 12px; }
        .obe-user-methods span { color: #71808d; font-size: 10px; }
        .obe-method-chevron { grid-column: 2; grid-row: 1 / span 2; width: 28px; height: 28px; display: grid; place-items: center; border: 1px solid #b9d8d4; border-radius: 50%; background: #edf9f7; color: #08766f; font-size: 15px; font-weight: 900; line-height: 1; }
        .obe-manual-body { display: grid; gap: 14px; padding: 17px 20px 0; }
        .obe-choice-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        .obe-choice-panel > button { display: grid; grid-template-columns: 24px minmax(0,1fr); gap: 8px; align-items: start; border: 1px solid #dfe6eb; border-radius: 11px; background: #fff; padding: 11px; text-align: left; cursor: pointer; }
        .obe-choice-panel > button.active { border-color: #79bcb6; background: #f2fbf9; }
        .obe-choice-mark { width: 22px; height: 22px; display: grid; place-items: center; border: 1px solid #b8c8d1; border-radius: 50%; color: #08766f; font-size: 10px; font-weight: 900; }
        .obe-choice-panel button.active .obe-choice-mark { border-color: #08766f; background: #e2f6f3; }
        .obe-choice-panel strong, .obe-choice-panel small { display: block; }
        .obe-choice-panel strong { font-size: 10px; }
        .obe-choice-panel small { margin-top: 3px; color: #71808d; font-size: 8.5px; line-height: 1.4; }
        .obe-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .obe-form-grid label { display: grid; gap: 5px; }
        .obe-form-grid span, .obe-role-grid legend { color: #596975; font-size: 9px; font-weight: 750; }
        .obe-form-grid input { min-width: 0; border: 1px solid #d7e0e5; border-radius: 9px; background: #fff; padding: 9px 10px; color: #24313d; font: inherit; font-size: 10px; }
        .obe-role-grid { display: flex; gap: 7px; flex-wrap: wrap; margin: 0; border: 0; padding: 0; }
        .obe-role-grid legend { margin-bottom: 6px; }
        .obe-role-grid label { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #dce4e9; border-radius: 999px; padding: 7px 9px; color: #42525f; font-size: 9px; cursor: pointer; }
        .obe-password-panel, .obe-control-panel { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: 9px; align-items: center; border: 1px solid #ead8a4; border-radius: 10px; background: #fffaf0; padding: 10px 11px; }
        .obe-control-panel { border-color: #c9dedb; background: #f4fbfa; }
        .obe-control-panel.student { border-color: #cfdcf0; background: #f5f8ff; }
        .obe-panel-mark { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: #f4e6ba; color: #7a5a00; font-size: 10px; font-weight: 900; }
        .obe-control-panel .obe-panel-mark { background: #dff3f0; color: #08766f; }
        .obe-control-panel.student .obe-panel-mark { background: #e4ecfb; color: #315ca8; }
        .obe-password-panel strong, .obe-password-panel small, .obe-control-panel strong, .obe-control-panel small { display: block; }
        .obe-password-panel strong, .obe-control-panel strong { font-size: 9.5px; }
        .obe-password-panel small, .obe-control-panel small { margin-top: 2px; color: #6c7882; font-size: 8.5px; line-height: 1.4; }
        .obe-password-panel code, .obe-control-panel code { color: #0f5f59; font-weight: 900; }
        .obe-inline-message { margin: 0; border-radius: 8px; background: #fff0ef; padding: 9px 10px; color: #b42318; font-size: 9px; }
        .obe-inline-message.success { background: #eefaf6; color: #087443; }
        .obe-import-body { display: grid; gap: 12px; padding: 17px 20px 8px; }
        .obe-import-note { display: grid; gap: 4px; border-radius: 10px; background: #f5f8fa; padding: 11px 12px; }
        .obe-import-note strong { font-size: 10px; }
        .obe-import-note span { color: #667785; font-size: 9px; line-height: 1.45; }
        .obe-import-note code { color: #0f5f59; font-weight: 800; }
        .obe-file-box { display: grid; gap: 5px; border: 1px dashed #aab8c2; border-radius: 11px; padding: 14px; cursor: pointer; }
        .obe-file-box:hover { border-color: #08766f; background: #f8fcfb; }
        .obe-file-box.disabled { opacity: .55; cursor: not-allowed; }
        .obe-file-box strong { font-size: 11px; }
        .obe-file-box span { color: #71808d; font-size: 9px; line-height: 1.4; }
        .obe-file-box input { margin-top: 5px; font-size: 10px; }
        .obe-siap-step { display: grid; grid-template-columns: 28px minmax(0,1fr) auto; align-items: center; gap: 9px; }
        .obe-siap-step > span { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; background: #e8f7f5; color: #08766f; font-size: 10px; font-weight: 850; }
        .obe-siap-step strong, .obe-siap-step small { display: block; }
        .obe-siap-step strong { font-size: 10px; }
        .obe-siap-step small { margin-top: 2px; color: #75838f; font-size: 9px; }
        .obe-siap-step button { border: 1px solid #ced8de; border-radius: 8px; background: white; padding: 8px 10px; color: #175cd3; font-size: 9px; font-weight: 750; cursor: pointer; }
        .obe-check { display: flex; align-items: center; gap: 8px; margin-left: 37px; color: #536371; font-size: 9px; }
        .obe-import-preview { display: grid; gap: 10px; padding: 10px 20px 5px; }
        .obe-import-stats { display: flex; gap: 8px; flex-wrap: wrap; }
        .obe-import-stats span { border-radius: 999px; background: #f1f4f6; padding: 6px 9px; color: #62717d; font-size: 9px; }
        .obe-import-stats strong { color: #17212b; }
        .obe-import-list { display: grid; border: 1px solid #e4eaee; border-radius: 10px; overflow: hidden; }
        .obe-import-list > div { display: grid; grid-template-columns: 22px minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 9px 10px; border-bottom: 1px solid #edf1f3; }
        .obe-import-list > div:last-child { border-bottom: 0; }
        .obe-import-list > div > span { width: 20px; height: 20px; display: grid; place-items: center; border-radius: 50%; font-size: 9px; font-weight: 850; }
        .obe-import-list .ok { background: #e7f7ed; color: #087443; }
        .obe-import-list .existing { background: #eef3f7; color: #61717d; }
        .obe-import-list .bad { background: #fdecec; color: #b42318; }
        .obe-import-list strong, .obe-import-list small { display: block; }
        .obe-import-list strong { font-size: 10px; }
        .obe-import-list small { margin-top: 2px; color: #71808d; font-size: 8px; }
        .obe-import-list em { color: #63727e; font-size: 8px; font-style: normal; text-align: right; }
        .obe-more { color: #73818c; font-size: 9px; }
        .obe-import-report { display: grid; gap: 5px; margin: 10px 20px 0; border-radius: 10px; background: #f0faf8; padding: 10px 12px; }
        .obe-import-report strong { color: #085e58; font-size: 10px; }
        .obe-import-report small { color: #8b3b35; font-size: 8px; }
        .obe-import-report button { justify-self: start; margin-top: 3px; border: 0; background: transparent; color: #175cd3; padding: 0; font-size: 9px; font-weight: 800; cursor: pointer; }
        .obe-user-modal-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 15px 20px 20px; }
        .obe-manual-body .obe-user-modal-actions { margin: 0 -20px; padding-top: 13px; border-top: 1px solid #e7ecef; }
        .obe-user-modal-actions button { border: 1px solid #d5dee4; border-radius: 9px; background: white; padding: 9px 12px; color: #41515e; font-size: 10px; font-weight: 750; cursor: pointer; }
        .obe-user-modal-actions button.primary { border-color: #08766f; background: #08766f; color: white; }
        .obe-user-modal-actions button:disabled { opacity: .5; cursor: not-allowed; }
        @media (max-width: 640px) {
          .obe-user-modal-backdrop { align-items: end; padding: 0; }
          .obe-user-modal { width: 100%; max-height: 92vh; border-radius: 16px 16px 0 0; }
          .obe-choice-panel, .obe-form-grid { grid-template-columns: 1fr; }
          .obe-siap-step { grid-template-columns: 28px minmax(0,1fr); }
          .obe-siap-step button { grid-column: 2; justify-self: start; }
          .obe-import-list > div { grid-template-columns: 22px minmax(0,1fr); }
          .obe-import-list em { grid-column: 2; text-align: left; }
          .obe-check { margin-left: 0; }
        }
      `}</style>
    </>
  );
}
