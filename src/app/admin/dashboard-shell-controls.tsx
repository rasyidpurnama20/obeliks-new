"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

type ShellControlsProps = {
  displayName?: string | null;
  email: string;
};

type NotificationItem = {
  title: string;
  context: string;
  due: string;
  actionLabel: string;
};

const workspaceLabel = "S1 – Informatika UNDIP";
const periodLabel = "Gasal 2026/2027";

function findRoleSelect() {
  return document.querySelector<HTMLSelectElement>('select[aria-label="Peran aktif"]');
}

function findTextButton(label: string) {
  return [...document.querySelectorAll<HTMLButtonElement>("button")]
    .find((button) => button.textContent?.trim() === label);
}

function readNotifications(): NotificationItem[] {
  const heading = [...document.querySelectorAll("h2")]
    .find((node) => node.textContent?.trim() === "Perlu tindakan Anda");
  const section = heading?.closest("section") ?? heading?.parentElement?.parentElement;
  if (!section) return [];

  return [...section.querySelectorAll("article")].slice(0, 8).map((article) => {
    const title = article.querySelector("h3")?.textContent?.trim() ?? "Tindakan memerlukan perhatian";
    const texts = [...article.querySelectorAll("span, small")].map((node) => node.textContent?.trim()).filter(Boolean) as string[];
    const button = article.querySelector<HTMLButtonElement>("button");
    return {
      title,
      context: texts.at(-1) ?? "OBELIKS",
      due: texts[0] ?? "Perlu tindakan",
      actionLabel: button?.textContent?.trim() ?? "Buka",
    };
  });
}

export function DashboardShellControls({ displayName, email }: ShellControlsProps) {
  const [mounted, setMounted] = useState(false);
  const [sidebarHost, setSidebarHost] = useState<HTMLElement | null>(null);
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [roleOptions, setRoleOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [activeRole, setActiveRole] = useState("admin");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    setMounted(true);
    setSidebarHost(document.querySelector<HTMLElement>("aside"));
    setHeaderHost(document.querySelector<HTMLElement>("header"));

    const sync = () => {
      const select = findRoleSelect();
      if (select) {
        setActiveRole(select.value);
        setRoleOptions([...select.options].map((option) => ({ value: option.value, label: option.text })));
      }
      setNotifications(readNotifications());
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("hashchange", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const initials = useMemo(() => (displayName || email).slice(0, 2).toUpperCase(), [displayName, email]);
  const activeRoleLabel = roleOptions.find((item) => item.value === activeRole)?.label ?? "Admin";

  function changeRole(value: string) {
    const select = findRoleSelect();
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setActiveRole(value);
    setAccountOpen(false);
  }

  function openInstitutions() {
    window.location.hash = "institusi-periode";
    setWorkspaceOpen(false);
  }

  function openNotification(item: NotificationItem) {
    const target = findTextButton(item.actionLabel);
    target?.click();
    setNotificationsOpen(false);
  }

  function logout() {
    document.querySelector<HTMLButtonElement>('button[class*="signOutButton"]')?.click();
  }

  if (!mounted) return null;

  const sidebarControls = sidebarHost ? createPortal(
    <div className="obe-shell-controls">
      <div className="obe-popover-wrap">
        <button className="obe-workspace-button" onClick={() => { setWorkspaceOpen((value) => !value); setAccountOpen(false); }} type="button">
          <span className="obe-caption">Ruang kerja aktif</span>
          <strong>{workspaceLabel}<b>⌄</b></strong>
          <small>{periodLabel}</small>
        </button>
        {workspaceOpen ? (
          <div className="obe-popover obe-workspace-popover">
            <span className="obe-popover-title">Ruang kerja</span>
            <button className="obe-option active" onClick={() => setWorkspaceOpen(false)} type="button"><i>✓</i><span><strong>{workspaceLabel}</strong><small>{periodLabel}</small></span></button>
            <div className="obe-separator" />
            <button className="obe-link-option" onClick={openInstitutions} type="button">Kelola Institusi &amp; Periode <span>→</span></button>
          </div>
        ) : null}
      </div>

      <div className="obe-popover-wrap">
        <button className="obe-account-button" onClick={() => { setAccountOpen((value) => !value); setWorkspaceOpen(false); }} type="button">
          <span className="obe-avatar">{initials}</span>
          <span><strong>{displayName || "Superadmin"}</strong><small>{activeRoleLabel} · {workspaceLabel.replace(" – ", " ")}</small></span>
          <b>⌄</b>
        </button>
        {accountOpen ? (
          <div className="obe-popover obe-account-popover">
            <div className="obe-account-head"><strong>{displayName || "Superadmin"}</strong><small>{email}</small></div>
            <span className="obe-popover-title">Peran aktif</span>
            {roleOptions.map((item) => (
              <button className={`obe-option ${item.value === activeRole ? "active" : ""}`} key={item.value} onClick={() => changeRole(item.value)} type="button">
                <i>{item.value === activeRole ? "✓" : ""}</i><span><strong>{item.label}</strong></span>
              </button>
            ))}
            <div className="obe-separator" />
            <button className="obe-link-option danger" onClick={logout} type="button">Keluar dari aplikasi <span>↗</span></button>
          </div>
        ) : null}
      </div>
    </div>, sidebarHost) : null;

  const headerControls = headerHost ? createPortal(
    <div className="obe-notification-wrap">
      <button aria-label="Notifikasi" className="obe-notification-button" onClick={() => { setNotifications(readNotifications()); setNotificationsOpen((value) => !value); }} type="button">
        <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
        {notifications.length ? <span>{notifications.length}</span> : null}
      </button>
      {notificationsOpen ? (
        <div className="obe-popover obe-notification-popover">
          <div className="obe-notification-head"><strong>Notifikasi</strong><small>{notifications.length} perlu tindakan</small></div>
          {notifications.length ? notifications.map((item, index) => (
            <button className="obe-notification-item" key={`${item.title}-${index}`} onClick={() => openNotification(item)} type="button">
              <i className={index === 0 ? "critical" : index === 1 ? "warning" : "info"} />
              <span><strong>{item.title}</strong><small>{item.context} · {item.due}</small></span><b>→</b>
            </button>
          )) : <p className="obe-empty">Tidak ada tindakan baru.</p>}
        </div>
      ) : null}
    </div>, headerHost) : null;

  return (
    <>
      {sidebarControls}
      {headerControls}
      <style jsx global>{`
        [class*="rolePreview"], header > [class*="avatar"], [class*="previewBanner"] { display: none !important; }
        [class*="sidebarContext"], form:has(> [class*="signOutButton"]) { display: none !important; }
        header > [class*="iconButton"] { display: none !important; }
        .obe-shell-controls { margin-top: auto; padding: 8px 3px 0; display: grid; gap: 7px; }
        .obe-popover-wrap, .obe-notification-wrap { position: relative; }
        .obe-workspace-button, .obe-account-button { width: 100%; border: 1px solid rgba(255,255,255,.1); border-radius: 11px; color: #d7e3eb; background: rgba(255,255,255,.045); text-align: left; }
        .obe-workspace-button { display: grid; gap: 4px; padding: 11px 12px; }
        .obe-workspace-button:hover, .obe-account-button:hover { background: rgba(255,255,255,.075); }
        .obe-caption { color: #8aa2b1; font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
        .obe-workspace-button strong { display: flex; justify-content: space-between; gap: 8px; color: #fff; font-size: 11px; }
        .obe-workspace-button small { color: #9eb1bd; font-size: 10px; }
        .obe-workspace-button b, .obe-account-button b { color: #8ca5b4; font-weight: 500; }
        .obe-account-button { display: grid; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 9px; border-color: transparent; background: transparent; padding: 8px; }
        .obe-account-button strong, .obe-account-button small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .obe-account-button strong { color: #fff; font-size: 11px; }
        .obe-account-button small { margin-top: 2px; color: #8da4b3; font-size: 9px; }
        .obe-avatar { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #d9f3ef; color: #08766f; font-size: 10px; font-weight: 850; }
        .obe-popover { position: absolute; z-index: 200; border: 1px solid #dde4ea; border-radius: 12px; background: #fff; box-shadow: 0 16px 40px rgba(8,28,43,.18); padding: 8px; color: #17212b; }
        .obe-workspace-popover, .obe-account-popover { left: 0; right: 0; bottom: calc(100% + 7px); }
        .obe-popover-title { display: block; padding: 6px 8px; color: #778491; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
        .obe-option, .obe-link-option { width: 100%; border: 0; border-radius: 8px; background: transparent; color: #24313d; text-align: left; }
        .obe-option { display: grid; grid-template-columns: 18px minmax(0,1fr); gap: 5px; align-items: center; padding: 8px; }
        .obe-option:hover, .obe-link-option:hover { background: #f4f7f9; }
        .obe-option i { color: #08766f; font-size: 11px; font-style: normal; }
        .obe-option strong, .obe-option small { display: block; }
        .obe-option strong { font-size: 11px; }
        .obe-option small { margin-top: 2px; color: #778491; font-size: 9px; }
        .obe-option.active { background: #edf9f7; }
        .obe-separator { height: 1px; margin: 6px 3px; background: #e7ecf0; }
        .obe-link-option { display: flex; justify-content: space-between; padding: 9px 8px; font-size: 10px; font-weight: 700; }
        .obe-link-option.danger { color: #b42318; }
        .obe-account-head { display: grid; gap: 2px; padding: 7px 8px 9px; }
        .obe-account-head strong { font-size: 11px; }
        .obe-account-head small { overflow: hidden; color: #778491; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
        .obe-notification-wrap { margin-left: auto; }
        .obe-notification-button { position: relative; width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid #e2e8ee; border-radius: 9px; background: #fff; color: #536272; }
        .obe-notification-button:hover { border-color: #bcc7d1; color: #102b3f; }
        .obe-notification-button svg { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.75; }
        .obe-notification-button > span { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; display: grid; place-items: center; border: 2px solid #fff; border-radius: 999px; background: #b42318; color: #fff; font-size: 8px; font-weight: 800; padding: 0 3px; }
        .obe-notification-popover { top: calc(100% + 8px); right: 0; width: min(370px, calc(100vw - 32px)); padding: 7px; }
        .obe-notification-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 9px 10px; }
        .obe-notification-head strong { font-size: 13px; }
        .obe-notification-head small { color: #b42318; font-size: 9px; font-weight: 700; }
        .obe-notification-item { width: 100%; display: grid; grid-template-columns: 8px minmax(0,1fr) auto; align-items: center; gap: 10px; border: 0; border-radius: 9px; background: transparent; padding: 10px 9px; text-align: left; }
        .obe-notification-item:hover { background: #f5f7f9; }
        .obe-notification-item i { width: 7px; height: 7px; border-radius: 50%; background: #2176ff; }
        .obe-notification-item i.critical { background: #b42318; }
        .obe-notification-item i.warning { background: #e28a00; }
        .obe-notification-item strong, .obe-notification-item small { display: block; }
        .obe-notification-item strong { color: #17212b; font-size: 11px; line-height: 1.3; }
        .obe-notification-item small { margin-top: 3px; color: #778491; font-size: 9px; }
        .obe-notification-item b { color: #175cd3; font-weight: 700; }
        .obe-empty { margin: 0; padding: 16px 10px; color: #778491; font-size: 10px; }
        @media (max-width: 920px) {
          .obe-shell-controls { padding-bottom: 4px; }
          .obe-notification-popover { position: fixed; top: 60px; right: 12px; }
        }
      `}</style>
    </>
  );
}
