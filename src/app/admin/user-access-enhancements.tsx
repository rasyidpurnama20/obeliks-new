"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import type { AssignableRole, ManagedUser } from "@/lib/admin/user-types";
import { startSupportImpersonation } from "./impersonation-actions";

type UserAccessEnhancementsProps = {
  users: ManagedUser[];
};

type RoleFilter = "all" | AssignableRole;

type ImpersonationHost = {
  user: ManagedUser;
  host: HTMLElement;
};

const roleLabels: Record<AssignableRole, string> = {
  kaprodi: "Kaprodi",
  gpm: "GPM",
  dosen: "Dosen",
  mahasiswa: "Mahasiswa",
};

const roleOrder: AssignableRole[] = ["dosen", "gpm", "kaprodi", "mahasiswa"];

function sameHosts(left: ImpersonationHost[], right: ImpersonationHost[]) {
  return left.length === right.length
    && left.every((item, index) => item.user.id === right[index]?.user.id && item.host === right[index]?.host);
}

function rowEmail(row: HTMLTableRowElement) {
  return row.querySelector<HTMLTableCellElement>("td:first-child")
    ?.querySelector("small")
    ?.textContent
    ?.trim()
    .toLocaleLowerCase("id-ID") ?? "";
}

export function UserAccessEnhancements({ users }: UserAccessEnhancementsProps) {
  const [active, setActive] = useState(false);
  const [toolbarHost, setToolbarHost] = useState<HTMLElement | null>(null);
  const [impersonationHosts, setImpersonationHosts] = useState<ImpersonationHost[]>([]);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [visibleCount, setVisibleCount] = useState(0);
  const [candidate, setCandidate] = useState<ManagedUser | null>(null);
  const [starting, setStarting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const counts = useMemo(() => {
    const current = users.filter((user) => user.status !== "archived");
    return {
      all: current.length,
      kaprodi: current.filter((user) => user.roles.includes("kaprodi")).length,
      gpm: current.filter((user) => user.roles.includes("gpm")).length,
      dosen: current.filter((user) => user.roles.includes("dosen")).length,
      mahasiswa: current.filter((user) => user.roles.includes("mahasiswa")).length,
    };
  }, [users]);

  useEffect(() => {
    const userByEmail = new Map(users.map((user) => [user.email.toLocaleLowerCase("id-ID"), user]));

    const sync = () => {
      const heading = [...document.querySelectorAll<HTMLHeadingElement>("h1")]
        .find((item) => item.textContent?.trim() === "Pengguna & Akses");
      const pageHeading = heading?.closest<HTMLElement>('div[class*="pageHeading"]') ?? null;
      const table = document.querySelector<HTMLTableElement>('table[class*="userTable"]');
      const card = table?.closest<HTMLElement>("section") ?? null;
      const nextToolbarHost = card?.querySelector<HTMLElement>('div[class*="toolbar"]') ?? null;
      const isActive = Boolean(heading && pageHeading && table);

      setActive((current) => current === isActive ? current : isActive);
      setToolbarHost((current) => current === nextToolbarHost ? current : nextToolbarHost);

      if (!isActive || !table) {
        setImpersonationHosts((current) => current.length ? [] : current);
        return;
      }

      const nextHosts: ImpersonationHost[] = [];
      for (const row of table.querySelectorAll<HTMLTableRowElement>("tbody tr")) {
        const user = userByEmail.get(rowEmail(row));
        if (!user || user.protected || user.isSelf || user.status !== "active" || !user.roles.length) continue;
        const host = row.querySelector<HTMLElement>('td:last-child [class*="userActions"]');
        if (host) nextHosts.push({ user, host });
      }
      setImpersonationHosts((current) => sameHosts(current, nextHosts) ? current : nextHosts);
    };

    sync();
    const main = document.querySelector("#main-content");
    const observer = new MutationObserver(sync);
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [users]);

  useEffect(() => {
    if (active) document.documentElement.dataset.obeUserAccessRefined = "true";
    else delete document.documentElement.dataset.obeUserAccessRefined;
    return () => { delete document.documentElement.dataset.obeUserAccessRefined; };
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const apply = () => {
      const table = document.querySelector<HTMLTableElement>('table[class*="userTable"]');
      if (!table) return;
      let visible = 0;
      for (const row of table.querySelectorAll<HTMLTableRowElement>("tbody tr")) {
        if (row.querySelector('td[class*="emptyState"]')) {
          row.hidden = false;
          continue;
        }
        const roleText = row.querySelector<HTMLTableCellElement>("td:nth-child(2)")?.textContent ?? "";
        const matches = roleFilter === "all" || roleText.includes(roleLabels[roleFilter]);
        row.hidden = !matches;
        if (matches) visible += 1;
      }
      setVisibleCount(visible);
    };

    apply();
    const table = document.querySelector<HTMLTableElement>('table[class*="userTable"]');
    const observer = new MutationObserver(apply);
    if (table) observer.observe(table, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [active, roleFilter]);

  useEffect(() => {
    if (!candidate) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !starting) setCandidate(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [candidate, starting]);

  async function beginImpersonation() {
    if (!candidate || starting) return;
    setStarting(true);
    setErrorMessage("");
    const result = await startSupportImpersonation(candidate.id);
    if (!result.ok) {
      setErrorMessage(result.message);
      setStarting(false);
      return;
    }
    window.location.assign("/admin");
  }

  if (!active) return null;

  const roleControl = toolbarHost ? createPortal(
    <>
      <label className="obe-role-filter">
        <span>Peran</span>
        <select aria-label="Filter peran pengguna" onChange={(event) => setRoleFilter(event.target.value as RoleFilter)} value={roleFilter}>
          <option value="all">Semua peran ({counts.all})</option>
          {roleOrder.map((role) => <option key={role} value={role}>{roleLabels[role]} ({counts[role]})</option>)}
        </select>
      </label>
      <span className="obe-filter-count">{visibleCount} tampil</span>
    </>,
    toolbarHost,
  ) : null;

  return (
    <>
      {roleControl}
      {impersonationHosts.map(({ user, host }) => createPortal(
        <button
          aria-label={`Lihat aplikasi sebagai ${user.name}`}
          className="obe-impersonate-button"
          key={user.id}
          onClick={() => { setCandidate(user); setErrorMessage(""); }}
          title="Mode dukungan: melihat tampilan akun tanpa mengambil alih sesi atau kata sandi pengguna"
          type="button"
        >
          Lihat sebagai
        </button>,
        host,
        `impersonate-${user.id}`,
      ))}

      {candidate ? createPortal(
        <div className="obe-impersonate-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !starting) setCandidate(null); }}>
          <section aria-labelledby="obe-impersonate-title" aria-modal="true" className="obe-impersonate-dialog" role="dialog">
            <div className="obe-impersonate-head">
              <div>
                <span>Impersonasi dukungan</span>
                <h2 id="obe-impersonate-title">Lihat sebagai {candidate.name}?</h2>
              </div>
              <button aria-label="Tutup" disabled={starting} onClick={() => setCandidate(null)} type="button">×</button>
            </div>
            <div className="obe-impersonate-body">
              <div className="obe-target-user"><strong>{candidate.name}</strong><small>{candidate.email}</small><div>{candidate.roles.map((role) => <span key={role}>{roleLabels[role as AssignableRole] ?? role}</span>)}</div></div>
              <p>Sesi login tetap milik Superadmin. OBELIKS hanya menampilkan workspace dan peran milik akun ini selama maksimal 30 menit. Password, token login, dan sesi pengguna tidak pernah diambil.</p>
              <p className="obe-audit-note">Mulai dan selesai impersonasi dicatat pada Audit Log. Akun Superadmin lain tidak dapat menjadi target.</p>
              {errorMessage ? <p className="obe-impersonate-error" role="alert">{errorMessage}</p> : null}
            </div>
            <div className="obe-impersonate-actions">
              <button disabled={starting} onClick={() => setCandidate(null)} type="button">Batal</button>
              <button className="primary" disabled={starting} onClick={() => void beginImpersonation()} type="button">{starting ? "Membuka…" : "Mulai lihat sebagai"}</button>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}

      <style jsx global>{`
        html[data-obe-user-access-refined="true"] [class*="pageHeading"] [class*="eyebrow"],
        html[data-obe-user-access-refined="true"] [class*="pageHeading"] [class*="pageDescription"],
        html[data-obe-user-access-refined="true"] .obe-user-flow-note { display: none !important; }
        html[data-obe-user-access-refined="true"] [class*="pageHeading"] h1 { margin-top: 0 !important; }
        html[data-obe-user-access-refined="true"] [class*="resultCount"] { display: none !important; }
        .obe-role-filter { display: inline-flex; align-items: center; gap: 7px; margin-left: auto; }
        .obe-role-filter > span { color: #667785; font-size: 9px; font-weight: 750; }
        .obe-role-filter select { min-width: 150px; border: 1px solid #d7e0e5; border-radius: 9px; background: #fff; padding: 8px 9px; color: #31414e; font-size: 10px; }
        .obe-filter-count { color: #73818c; font-size: 9px; white-space: nowrap; }
        .obe-impersonate-button { border: 1px solid #b9d8d4; border-radius: 8px; background: #f2fbf9; color: #08766f; padding: 7px 9px; font: inherit; font-size: 9px; font-weight: 800; cursor: pointer; }
        .obe-impersonate-button:hover { border-color: #08766f; background: #e9f7f5; }
        .obe-impersonate-backdrop { position: fixed; inset: 0; z-index: 650; display: grid; place-items: center; padding: 18px; background: rgba(8,25,38,.48); }
        .obe-impersonate-dialog { width: min(480px, 100%); overflow: hidden; border-radius: 15px; background: #fff; box-shadow: 0 24px 70px rgba(8,25,38,.28); color: #17212b; }
        .obe-impersonate-head { display: flex; justify-content: space-between; gap: 18px; padding: 18px 20px 14px; border-bottom: 1px solid #e7ecef; }
        .obe-impersonate-head span { color: #08766f; font-size: 9px; font-weight: 850; letter-spacing: .08em; text-transform: uppercase; }
        .obe-impersonate-head h2 { margin: 4px 0 0; font-size: 17px; }
        .obe-impersonate-head > button { width: 31px; height: 31px; border: 0; border-radius: 8px; background: #f2f5f7; color: #5b6975; font-size: 18px; cursor: pointer; }
        .obe-impersonate-body { display: grid; gap: 11px; padding: 17px 20px 8px; }
        .obe-target-user { display: grid; gap: 3px; border-radius: 10px; background: #f5f8fa; padding: 11px 12px; }
        .obe-target-user strong { font-size: 12px; }
        .obe-target-user small { color: #6d7c88; font-size: 9px; }
        .obe-target-user > div { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
        .obe-target-user > div span { border-radius: 999px; background: #e8f7f5; padding: 4px 7px; color: #08766f; font-size: 8px; font-weight: 800; }
        .obe-impersonate-body p { margin: 0; color: #536371; font-size: 10px; line-height: 1.5; }
        .obe-impersonate-body .obe-audit-note { color: #6f5b2f; }
        .obe-impersonate-error { border-radius: 9px; background: #fff0ef; padding: 9px 10px; color: #b42318 !important; }
        .obe-impersonate-actions { display: flex; justify-content: flex-end; gap: 8px; padding: 15px 20px 19px; }
        .obe-impersonate-actions button { border: 1px solid #d5dee4; border-radius: 9px; background: #fff; padding: 9px 12px; color: #41515e; font-size: 10px; font-weight: 750; cursor: pointer; }
        .obe-impersonate-actions button.primary { border-color: #08766f; background: #08766f; color: #fff; }
        .obe-impersonate-actions button:disabled { opacity: .55; cursor: not-allowed; }
        @media (max-width: 720px) {
          .obe-role-filter { width: 100%; margin-left: 0; justify-content: space-between; }
          .obe-role-filter select { flex: 1; }
          .obe-impersonate-backdrop { align-items: end; padding: 0; }
          .obe-impersonate-dialog { width: 100%; border-radius: 15px 15px 0 0; }
        }
      `}</style>
    </>
  );
}
