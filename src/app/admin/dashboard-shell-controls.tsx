"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ManagedUser } from "@/lib/admin/user-types";
import { courseOfferings, getNavigationForRole, roleDashboards, rpsRecords } from "@/lib/mvp/data";
import type { ActionItem, RoleId } from "@/lib/mvp/types";
import { pathForScreen, screenFromHref, smartSearchScore } from "@/lib/navigation/routes";

type ShellControlsProps = {
  displayName?: string | null;
  email: string;
  managedUsers?: ManagedUser[];
};

type OpenPanel = "workspace" | "account" | "notifications" | "search" | null;
type RoleOption = { value: string; label: string };
type SearchItem = {
  id: string;
  type: "Menu" | "Mata kuliah" | "RPS" | "Pengguna";
  title: string;
  subtitle: string;
  keywords: string;
  path: string;
};

const workspaceLabel = "S1 – Informatika UNDIP";
const periodLabel = "Gasal 2026/2027";
const validRoles = new Set<RoleId>(["admin", "kaprodi", "gpm", "dosen", "mahasiswa"]);

function findRoleSelect() {
  return document.querySelector<HTMLSelectElement>('select[aria-label="Peran aktif"]');
}

function roleForValue(value: string): RoleId {
  return validRoles.has(value as RoleId) ? value as RoleId : "admin";
}

function readRoleOptions(select: HTMLSelectElement): RoleOption[] {
  return [...select.options].map((option) => ({ value: option.value, label: option.text }));
}

function sameRoleOptions(left: RoleOption[], right: RoleOption[]) {
  return left.length === right.length
    && left.every((item, index) => item.value === right[index]?.value && item.label === right[index]?.label);
}

function notificationActions(role: RoleId, managedUsers: ManagedUser[]) {
  const dashboard = roleDashboards[role];
  if (role !== "admin") return dashboard.actions;
  const invited = managedUsers.filter((user) => user.status === "invited").length;
  return dashboard.actions.map((action) => action.id === "adm-2" ? {
    ...action,
    title: invited ? `${invited} undangan belum diselesaikan` : "Tidak ada undangan tertunda",
    description: invited
      ? "Kirim ulang tautan onboarding atau arsipkan akun yang tidak lagi diperlukan."
      : "Semua undangan akun sudah ditindaklanjuti.",
  } : action);
}

function actionPath(action: ActionItem) {
  const screen = screenFromHref(action.href);
  return pathForScreen(screen);
}

function navigateClient(path: string, replace = false) {
  const target = new URL(path, window.location.origin);
  if (target.origin !== window.location.origin) return;
  if (replace) window.history.replaceState(null, "", `${target.pathname}${target.search}${target.hash}`);
  else if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== `${target.pathname}${target.search}${target.hash}`) {
    window.history.pushState(null, "", `${target.pathname}${target.search}${target.hash}`);
  }
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function DashboardShellControls({ displayName, email, managedUsers = [] }: ShellControlsProps) {
  const [mounted, setMounted] = useState(false);
  const [sidebarHost, setSidebarHost] = useState<HTMLElement | null>(null);
  const [headerHost, setHeaderHost] = useState<HTMLElement | null>(null);
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [roleOptions, setRoleOptions] = useState<RoleOption[]>([]);
  const [activeRole, setActiveRole] = useState<RoleId>("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    setSidebarHost(document.querySelector<HTMLElement>("aside"));
    setHeaderHost(document.querySelector<HTMLElement>("header"));

    let disposed = false;
    let frame = 0;
    let boundSelect: HTMLSelectElement | null = null;

    const sync = (select: HTMLSelectElement) => {
      const nextRole = roleForValue(select.value);
      const nextOptions = readRoleOptions(select);
      setActiveRole((current) => current === nextRole ? current : nextRole);
      setRoleOptions((current) => sameRoleOptions(current, nextOptions) ? current : nextOptions);
    };

    const bind = (attempt = 0) => {
      if (disposed) return;
      const select = findRoleSelect();
      if (!select) {
        if (attempt < 12) frame = window.requestAnimationFrame(() => bind(attempt + 1));
        return;
      }
      boundSelect = select;
      sync(select);
      select.addEventListener("change", () => sync(select));
    };

    bind();
    return () => {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      if (boundSelect) {
        const select = boundSelect;
        // A cloned select has no listeners; replacing it is safer than retaining
        // a document-wide MutationObserver that used to create a render loop.
        const clone = select.cloneNode(true);
        select.parentNode?.replaceChild(clone, select);
      }
    };
  }, []);

  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest(".obe-shell-interactive")) setOpenPanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("id-ID") === "k") {
        event.preventDefault();
        setOpenPanel("search");
        window.requestAnimationFrame(() => searchInputRef.current?.focus());
      } else if (event.key === "Escape") {
        setOpenPanel(null);
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const initials = useMemo(() => (displayName || email).slice(0, 2).toUpperCase(), [displayName, email]);
  const activeRoleLabel = roleOptions.find((item) => item.value === activeRole)?.label ?? "Admin";
  const notifications = useMemo(() => notificationActions(activeRole, managedUsers), [activeRole, managedUsers]);

  const allSearchItems = useMemo<SearchItem[]>(() => {
    const navigation = getNavigationForRole(activeRole).flatMap((section) => section.items).map((item) => ({
      id: `menu-${item.id}`,
      type: "Menu" as const,
      title: item.label,
      subtitle: item.description,
      keywords: `${item.label} ${item.description} ${item.id}`,
      path: pathForScreen(item.id),
    }));

    const objectPath = activeRole === "dosen"
      ? "/pengajaran-saya"
      : activeRole === "mahasiswa"
        ? "/rps-saya"
        : "/monitoring-rps";
    const courses = courseOfferings.map((course) => ({
      id: `course-${course.id}`,
      type: "Mata kuliah" as const,
      title: `${course.code} · ${course.name}`,
      subtitle: `Kelas ${course.className} · ${course.lecturer}`,
      keywords: `${course.code} ${course.name} ${course.className} ${course.lecturer}`,
      path: objectPath,
    }));
    const records = rpsRecords.map((record) => ({
      id: `rps-${record.id}`,
      type: "RPS" as const,
      title: `${record.code} · ${record.courseName}`,
      subtitle: `${record.statusLabel} · ${record.owner}`,
      keywords: `${record.code} ${record.courseName} ${record.owner} ${record.reviewer} ${record.statusLabel}`,
      path: objectPath,
    }));
    const users = activeRole === "admin" ? managedUsers.filter((user) => !user.protected).map((user) => ({
      id: `user-${user.id}`,
      type: "Pengguna" as const,
      title: user.name,
      subtitle: `${user.email} · ${user.roles.join(", ") || "tanpa peran"}`,
      keywords: `${user.name} ${user.email} ${user.roles.join(" ")} ${user.status}`,
      path: "/pengguna-akses",
    })) : [];
    return [...navigation, ...courses, ...records, ...users];
  }, [activeRole, managedUsers]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return allSearchItems.filter((item) => item.type === "Menu").slice(0, 7);
    return allSearchItems
      .map((item) => ({ item, score: smartSearchScore(searchQuery, `${item.title} ${item.subtitle} ${item.keywords}`) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title, "id-ID"))
      .slice(0, 8)
      .map(({ item }) => item);
  }, [allSearchItems, searchQuery]);

  useEffect(() => setActiveSearchIndex(0), [searchQuery, activeRole]);

  function changeRole(value: string) {
    const select = findRoleSelect();
    if (!select) return;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setActiveRole(roleForValue(value));
    setOpenPanel(null);
    navigateClient("/dashboard", true);
  }

  function navigateTo(path: string) {
    setOpenPanel(null);
    setSearchQuery("");
    navigateClient(path);
  }

  function logout() {
    setOpenPanel(null);
    document.querySelector<HTMLButtonElement>('button[class*="signOutButton"]')?.click();
  }

  function handleSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSearchIndex((index) => Math.min(index + 1, Math.max(0, searchResults.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSearchIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter" && searchResults[activeSearchIndex]) {
      event.preventDefault();
      navigateTo(searchResults[activeSearchIndex].path);
    }
  }

  if (!mounted) return null;

  const sidebarControls = sidebarHost ? createPortal(
    <div className="obe-shell-controls obe-shell-interactive">
      <div className="obe-popover-wrap">
        <button className="obe-workspace-button" aria-expanded={openPanel === "workspace"} onClick={() => setOpenPanel((current) => current === "workspace" ? null : "workspace")} type="button">
          <span className="obe-caption">Ruang kerja aktif</span>
          <strong>{workspaceLabel}<b>⌄</b></strong>
          <small>{periodLabel}</small>
        </button>
        {openPanel === "workspace" ? <div className="obe-popover obe-workspace-popover">
          <span className="obe-popover-title">Ruang kerja</span>
          <button className="obe-option active" onClick={() => setOpenPanel(null)} type="button"><i>✓</i><span><strong>{workspaceLabel}</strong><small>{periodLabel}</small></span></button>
          <div className="obe-separator" />
          <button className="obe-link-option" onClick={() => navigateTo("/institusi-periode")} type="button">Kelola Institusi &amp; Periode <span>→</span></button>
        </div> : null}
      </div>

      <div className="obe-popover-wrap">
        <button className="obe-account-button" aria-expanded={openPanel === "account"} onClick={() => setOpenPanel((current) => current === "account" ? null : "account")} type="button">
          <span className="obe-avatar">{initials}</span>
          <span><strong>{displayName || "Superadmin"}</strong><small>{activeRoleLabel} · {workspaceLabel.replace(" – ", " ")}</small></span><b>⌄</b>
        </button>
        {openPanel === "account" ? <div className="obe-popover obe-account-popover">
          <div className="obe-account-head"><strong>{displayName || "Superadmin"}</strong><small>{email}</small></div>
          <span className="obe-popover-title">Peran aktif</span>
          {roleOptions.map((item) => <button className={`obe-option ${item.value === activeRole ? "active" : ""}`} key={item.value} onClick={() => changeRole(item.value)} type="button"><i>{item.value === activeRole ? "✓" : ""}</i><span><strong>{item.label}</strong></span></button>)}
          <div className="obe-separator" />
          <button className="obe-link-option danger" onClick={logout} type="button">Keluar dari aplikasi <span>↗</span></button>
        </div> : null}
      </div>
    </div>, sidebarHost) : null;

  const headerControls = headerHost ? createPortal(
    <div className="obe-header-tools obe-shell-interactive">
      <div className="obe-search-wrap">
        <span className="obe-search-icon" aria-hidden="true">⌕</span>
        <input
          aria-label="Smart search"
          aria-expanded={openPanel === "search"}
          autoComplete="off"
          onChange={(event) => { setSearchQuery(event.target.value); setOpenPanel("search"); }}
          onFocus={() => setOpenPanel("search")}
          onKeyDown={handleSearchKeyDown}
          placeholder="Cari menu, mata kuliah, RPS, pengguna…"
          ref={searchInputRef}
          type="search"
          value={searchQuery}
        />
        <kbd>⌘K</kbd>
        {openPanel === "search" ? <div className="obe-popover obe-search-popover">
          <div className="obe-search-head"><strong>{searchQuery ? "Hasil pencarian" : "Pintasan"}</strong><small>{searchResults.length} hasil</small></div>
          {searchResults.length ? searchResults.map((item, index) => <button className={`obe-search-result ${index === activeSearchIndex ? "active" : ""}`} key={item.id} onMouseEnter={() => setActiveSearchIndex(index)} onClick={() => navigateTo(item.path)} type="button"><span>{item.type}</span><div><strong>{item.title}</strong><small>{item.subtitle}</small></div><b>↵</b></button>) : <p className="obe-empty">Tidak ada menu atau objek yang cocok.</p>}
          <div className="obe-search-footer">↑↓ pilih · Enter buka · Esc tutup</div>
        </div> : null}
      </div>

      <div className="obe-notification-wrap">
        <button aria-label="Notifikasi" aria-expanded={openPanel === "notifications"} className="obe-notification-button" onClick={() => setOpenPanel((current) => current === "notifications" ? null : "notifications")} type="button">
          <svg aria-hidden="true" height="18" viewBox="0 0 24 24" width="18"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
          {notifications.length ? <span>{notifications.length}</span> : null}
        </button>
        {openPanel === "notifications" ? <div className="obe-popover obe-notification-popover">
          <div className="obe-notification-head"><strong>Notifikasi</strong><small>{notifications.length} perlu tindakan</small></div>
          {notifications.length ? notifications.map((item) => <button className="obe-notification-item" key={item.id} onClick={() => navigateTo(actionPath(item))} type="button"><i className={item.priority === "critical" ? "critical" : item.priority === "high" ? "warning" : "info"} /><span><strong>{item.title}</strong><small>{item.context} · {item.dueLabel}</small></span><b>→</b></button>) : <p className="obe-empty">Tidak ada tindakan baru.</p>}
        </div> : null}
      </div>
    </div>, headerHost) : null;

  return <>{sidebarControls}{headerControls}<style jsx global>{`
    [class*="rolePreview"], header > [class*="avatar"], [class*="previewBanner"] { display: none !important; }
    [class*="sidebarContext"], form:has(> [class*="signOutButton"]) { display: none !important; }
    header > [class*="iconButton"] { display: none !important; }
    .obe-shell-controls { margin-top: auto; padding: 8px 3px 0; display: grid; gap: 7px; }
    .obe-popover-wrap, .obe-notification-wrap, .obe-search-wrap { position: relative; }
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
    .obe-popover { position: absolute; z-index: 300; border: 1px solid #dde4ea; border-radius: 12px; background: #fff; box-shadow: 0 16px 40px rgba(8,28,43,.18); padding: 8px; color: #17212b; }
    .obe-workspace-popover, .obe-account-popover { left: 0; right: 0; bottom: calc(100% + 7px); }
    .obe-popover-title { display: block; padding: 6px 8px; color: #778491; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .obe-option, .obe-link-option { width: 100%; border: 0; border-radius: 8px; background: transparent; color: #24313d; text-align: left; }
    .obe-option { display: grid; grid-template-columns: 18px minmax(0,1fr); gap: 5px; align-items: center; padding: 8px; }
    .obe-option:hover, .obe-link-option:hover { background: #f4f7f9; }
    .obe-option i { color: #08766f; font-size: 11px; font-style: normal; }
    .obe-option strong, .obe-option small { display: block; }
    .obe-option strong { font-size: 11px; }.obe-option small { margin-top: 2px; color: #778491; font-size: 9px; }.obe-option.active { background: #edf9f7; }
    .obe-separator { height: 1px; margin: 6px 3px; background: #e7ecf0; }
    .obe-link-option { display: flex; justify-content: space-between; padding: 9px 8px; font-size: 10px; font-weight: 700; }.obe-link-option.danger { color: #b42318; }
    .obe-account-head { display: grid; gap: 2px; padding: 7px 8px 9px; }.obe-account-head strong { font-size: 11px; }.obe-account-head small { overflow: hidden; color: #778491; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .obe-header-tools { margin-left: auto; display: flex; align-items: center; gap: 9px; }
    .obe-search-wrap { width: clamp(250px, 30vw, 390px); }
    .obe-search-wrap > input { width: 100%; height: 38px; border: 1px solid #dfe6eb; border-radius: 10px; background: #fff; padding: 0 48px 0 34px; color: #24313d; font: inherit; font-size: 10px; outline: none; }
    .obe-search-wrap > input:focus { border-color: #7fb8b3; box-shadow: 0 0 0 3px rgba(8,118,111,.08); }
    .obe-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); z-index: 1; color: #72808d; font-size: 17px; }
    .obe-search-wrap > kbd { position: absolute; right: 9px; top: 50%; transform: translateY(-50%); border: 1px solid #dfe5e9; border-radius: 6px; background: #f5f7f8; padding: 3px 5px; color: #6f7d88; font-family: inherit; font-size: 8px; }
    .obe-search-popover { top: calc(100% + 8px); left: 0; right: 0; min-width: 360px; padding: 7px; }
    .obe-search-head, .obe-notification-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 9px 10px; }
    .obe-search-head strong, .obe-notification-head strong { font-size: 13px; }.obe-search-head small { color: #778491; font-size: 9px; }
    .obe-search-result { width: 100%; display: grid; grid-template-columns: 74px minmax(0,1fr) auto; gap: 9px; align-items: center; border: 0; border-radius: 9px; background: transparent; padding: 9px; text-align: left; }
    .obe-search-result:hover, .obe-search-result.active { background: #f1f8f7; }
    .obe-search-result > span { color: #08766f; font-size: 8px; font-weight: 800; text-transform: uppercase; }.obe-search-result strong,.obe-search-result small { display:block; }.obe-search-result strong { font-size: 10px; }.obe-search-result small { margin-top:2px; color:#778491; font-size:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }.obe-search-result b { color:#8a98a3; font-size:9px; }
    .obe-search-footer { margin: 6px -1px -1px; border-top: 1px solid #edf1f3; padding: 8px 9px 2px; color:#84919b; font-size:8px; }
    .obe-notification-button { position: relative; width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid #e2e8ee; border-radius: 9px; background: #fff; color: #536272; }.obe-notification-button:hover { border-color: #bcc7d1; color: #102b3f; }.obe-notification-button svg { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.75; }
    .obe-notification-button > span { position: absolute; top: -5px; right: -5px; min-width: 17px; height: 17px; display: grid; place-items: center; border: 2px solid #fff; border-radius: 999px; background: #b42318; color: #fff; font-size: 8px; font-weight: 800; padding: 0 3px; }
    .obe-notification-popover { top: calc(100% + 8px); right: 0; width: min(370px, calc(100vw - 32px)); padding: 7px; }.obe-notification-head small { color: #b42318; font-size: 9px; font-weight: 700; }
    .obe-notification-item { width: 100%; display: grid; grid-template-columns: 8px minmax(0,1fr) auto; align-items: center; gap: 10px; border: 0; border-radius: 9px; background: transparent; padding: 10px 9px; text-align: left; }.obe-notification-item:hover { background: #f5f7f9; }.obe-notification-item i { width: 7px; height: 7px; border-radius: 50%; background: #2176ff; }.obe-notification-item i.critical { background: #b42318; }.obe-notification-item i.warning { background: #e28a00; }.obe-notification-item strong,.obe-notification-item small { display:block; }.obe-notification-item strong { color:#17212b; font-size:11px; line-height:1.3; }.obe-notification-item small { margin-top:3px; color:#778491; font-size:9px; }.obe-notification-item b { color:#175cd3; font-weight:700; }
    .obe-empty { margin: 0; padding: 16px 10px; color: #778491; font-size: 10px; }
    @media (max-width: 920px) { .obe-shell-controls { padding-bottom:4px; }.obe-header-tools { width:min(76vw,460px); }.obe-search-wrap { width:100%; }.obe-search-popover,.obe-notification-popover { position:fixed; top:60px; right:12px; left:auto; width:min(420px,calc(100vw - 24px)); }.obe-search-wrap > kbd { display:none; } }
    @media (max-width: 560px) { .obe-header-tools { width:auto; }.obe-search-wrap { width:160px; }.obe-search-wrap > input { padding-right:10px; }.obe-search-wrap > input::placeholder { color:transparent; } }
  `}</style></>;
}
