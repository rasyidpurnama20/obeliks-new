"use client";

import { useEffect } from "react";
import type { NavigationItemId } from "@/lib/mvp/types";
import { canonicalizeDashboardUrl, pathForScreen, screenFromPathname } from "@/lib/navigation/routes";

const displayLabels: Record<NavigationItemId, string> = {
  dashboard: "Dashboard",
  "institusi-periode": "Kurikulum",
  "pengguna-akses": "Manajemen Pengguna",
  "monitoring-rps": "Monitoring RPS",
  "pengajaran-saya": "Pengajaran Saya",
  "rps-saya": "RPS Saya",
  "ai-parser": "AI & Parser",
  "audit-log": "Audit Log",
  pengaturan: "Pengaturan",
};

const legacyLabels: Partial<Record<NavigationItemId, string>> = {
  "institusi-periode": "Institusi & Periode",
  "pengguna-akses": "Pengguna & Akses",
};

function replaceExactText(selector: string) {
  const replacements = new Map([
    ["Institusi & Periode", "Kurikulum"],
    ["Pengguna & Akses", "Manajemen Pengguna"],
    ["Kelola Institusi & Periode", "Kelola Kurikulum"],
  ]);
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const current = element.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const replacement = replacements.get(current);
    if (replacement) element.textContent = replacement;
  }
}

function relabelVisibleShell() {
  replaceExactText('nav[aria-label="Navigasi utama"] button span');
  replaceExactText('[class*="breadcrumb"] strong');
  replaceExactText('.obe-search-result strong');
  replaceExactText('.obe-link-option');
  replaceExactText('.obe-notification-item strong');
}

function announceNavigation() {
  window.dispatchEvent(new Event("obeliks:navigation"));
  window.requestAnimationFrame(relabelVisibleShell);
}

function findNavButton(screen: NavigationItemId) {
  const labels = [displayLabels[screen], legacyLabels[screen]].filter(Boolean) as string[];
  return [...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Navigasi utama"] button')]
    .find((button) => labels.some((label) => button.textContent?.replace(/\s+/g, " ").trim().startsWith(label)));
}

function activateScreen(screen: NavigationItemId, replaceAfter = true) {
  document.documentElement.dataset.obeScreen = screen;
  if (screen === "dashboard") {
    const current = document.querySelector<HTMLButtonElement>('nav[aria-label="Navigasi utama"] button[aria-current="page"]');
    if (current?.textContent?.includes("Dashboard")) {
      relabelVisibleShell();
      return;
    }
  }
  const button = findNavButton(screen);
  if (!button) return;
  button.click();
  if (replaceAfter) {
    const basePath = pathForScreen(screen);
    const currentPath = window.location.pathname.length > 1 ? window.location.pathname.replace(/\/$/, "") : window.location.pathname;
    const preserveNestedPath = currentPath.startsWith(`${basePath}/`);
    if (!preserveNestedPath) {
      window.requestAnimationFrame(() => {
        window.history.replaceState(null, "", basePath);
        announceNavigation();
      });
    }
  }
  window.requestAnimationFrame(relabelVisibleShell);
}

export function RouteCoordinator({ initialScreen }: { initialScreen: NavigationItemId }) {
  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      const canonical = url ? canonicalizeDashboardUrl(url, window.location.origin) : null;
      const result = originalPushState(data, unused, canonical ?? url);
      announceNavigation();
      return result;
    }) as History["pushState"];

    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      const canonical = url ? canonicalizeDashboardUrl(url, window.location.origin) : null;
      const result = originalReplaceState(data, unused, canonical ?? url);
      announceNavigation();
      return result;
    }) as History["replaceState"];

    const relabelAfterInteraction = () => window.requestAnimationFrame(relabelVisibleShell);
    document.addEventListener("input", relabelAfterInteraction, true);
    document.addEventListener("click", relabelAfterInteraction, true);

    const boot = window.setTimeout(() => {
      activateScreen(initialScreen);
      relabelVisibleShell();
    }, 0);

    const onPopState = () => {
      announceNavigation();
      const target = screenFromPathname(window.location.pathname) ?? "dashboard";
      window.setTimeout(() => activateScreen(target, true), 0);
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.clearTimeout(boot);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("input", relabelAfterInteraction, true);
      document.removeEventListener("click", relabelAfterInteraction, true);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      delete document.documentElement.dataset.obeScreen;
    };
  }, [initialScreen]);

  return <style jsx global>{`
    html[data-obe-screen="institusi-periode"] [data-clean-workspace="institusi-periode"] > main > [class*="heading"] > h1 {
      font-size: 0 !important;
    }
    html[data-obe-screen="institusi-periode"] [data-clean-workspace="institusi-periode"] > main > [class*="heading"] > h1::after {
      content: "Kurikulum";
      font-size: 28px;
    }
    html[data-obe-screen="pengguna-akses"][data-obe-user-access-refined="true"] [class*="pageHeading"] h1 {
      font-size: 0 !important;
    }
    html[data-obe-screen="pengguna-akses"][data-obe-user-access-refined="true"] [class*="pageHeading"] h1::after {
      content: "Manajemen Pengguna";
      font-size: clamp(24px,3vw,34px);
    }
  `}</style>;
}
