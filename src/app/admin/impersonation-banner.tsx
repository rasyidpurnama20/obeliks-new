"use client";

import { useState } from "react";
import type { ImpersonatedUserView } from "@/lib/admin/impersonation";
import { stopSupportImpersonation } from "./impersonation-actions";

const roleLabels: Record<string, string> = {
  kaprodi: "Kaprodi",
  gpm: "GPM",
  dosen: "Dosen",
  mahasiswa: "Mahasiswa",
};

export function ImpersonationBanner({ target }: { target: ImpersonatedUserView }) {
  const [stopping, setStopping] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function stop() {
    if (stopping) return;
    setStopping(true);
    setErrorMessage("");
    try {
      const result = await stopSupportImpersonation();
      if (!result.ok) {
        setErrorMessage(result.message);
        setStopping(false);
        return;
      }
      // Replace instead of assign so browser Back does not revisit a stale
      // impersonated page after the support cookie has been cleared.
      window.location.replace("/admin");
    } catch {
      setErrorMessage("Gagal kembali ke Superadmin. Coba lagi; sesi akun target tidak pernah diambil alih.");
      setStopping(false);
    }
  }

  return (
    <>
      <aside aria-live="polite" className="obe-impersonation-banner">
        <span className="obe-impersonation-dot" />
        <div>
          <strong>Melihat sebagai {target.name}</strong>
          <small>{target.roles.map((role) => roleLabels[role] ?? role).join(" · ")} · sesi login tetap Superadmin · maksimal 30 menit</small>
          {errorMessage ? <em>{errorMessage}</em> : null}
        </div>
        <button disabled={stopping} onClick={() => void stop()} type="button">{stopping ? "Mengakhiri…" : "Kembali ke Superadmin"}</button>
      </aside>
      <style jsx global>{`
        .obe-impersonation-banner { position: fixed; z-index: 900; left: 50%; bottom: 16px; transform: translateX(-50%); width: min(760px, calc(100vw - 28px)); display: grid; grid-template-columns: 10px minmax(0,1fr) auto; align-items: center; gap: 11px; border: 1px solid #b9d8d4; border-radius: 13px; background: #f2fbf9; box-shadow: 0 14px 38px rgba(8,25,38,.18); padding: 10px 11px; color: #173a37; }
        .obe-impersonation-dot { width: 9px; height: 9px; border-radius: 50%; background: #08766f; }
        .obe-impersonation-banner strong, .obe-impersonation-banner small, .obe-impersonation-banner em { display: block; }
        .obe-impersonation-banner strong { font-size: 10px; }
        .obe-impersonation-banner small { margin-top: 2px; color: #58716e; font-size: 8px; }
        .obe-impersonation-banner em { margin-top: 3px; color: #b42318; font-size: 8px; font-style: normal; }
        .obe-impersonation-banner button { border: 1px solid #08766f; border-radius: 8px; background: #08766f; color: #fff; padding: 8px 10px; font-size: 9px; font-weight: 800; cursor: pointer; white-space: nowrap; }
        .obe-impersonation-banner button:disabled { opacity: .55; cursor: not-allowed; }
        @media (max-width: 620px) {
          .obe-impersonation-banner { bottom: 10px; grid-template-columns: 9px minmax(0,1fr); }
          .obe-impersonation-banner button { grid-column: 2; justify-self: start; }
        }
      `}</style>
    </>
  );
}
