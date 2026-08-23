"use client";

import { useEffect } from "react";
import type { NavigationItemId } from "@/lib/mvp/types";
import { canonicalizeDashboardUrl, pathForScreen, screenFromPathname } from "@/lib/navigation/routes";

const labels: Record<NavigationItemId, string> = {
  dashboard: "Dashboard",
  "institusi-periode": "Institusi & Periode",
  "pengguna-akses": "Pengguna & Akses",
  "monitoring-rps": "Monitoring RPS",
  "pengajaran-saya": "Pengajaran Saya",
  "rps-saya": "RPS Saya",
  "ai-parser": "AI & Parser",
  "audit-log": "Audit Log",
  pengaturan: "Pengaturan",
};

function findNavButton(screen: NavigationItemId) {
  const label = labels[screen];
  return [...document.querySelectorAll<HTMLButtonElement>('nav[aria-label="Navigasi utama"] button')]
    .find((button) => button.textContent?.replace(/\s+/g, " ").trim().startsWith(label));
}

function activateScreen(screen: NavigationItemId, replaceAfter = true) {
  if (screen === "dashboard") {
    const current = document.querySelector<HTMLButtonElement>('nav[aria-label="Navigasi utama"] button[aria-current="page"]');
    if (current?.textContent?.includes("Dashboard")) return;
  }
  const button = findNavButton(screen);
  if (!button) return;
  button.click();
  if (replaceAfter) {
    window.requestAnimationFrame(() => window.history.replaceState(null, "", pathForScreen(screen)));
  }
}

export function RouteCoordinator({ initialScreen }: { initialScreen: NavigationItemId }) {
  useEffect(() => {
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = ((data: unknown, unused: string, url?: string | URL | null) => {
      if (url) {
        const canonical = canonicalizeDashboardUrl(url, window.location.origin);
        if (canonical) return originalPushState(data, unused, canonical);
      }
      return originalPushState(data, unused, url);
    }) as History["pushState"];

    window.history.replaceState = ((data: unknown, unused: string, url?: string | URL | null) => {
      if (url) {
        const canonical = canonicalizeDashboardUrl(url, window.location.origin);
        if (canonical) return originalReplaceState(data, unused, canonical);
      }
      return originalReplaceState(data, unused, url);
    }) as History["replaceState"];

    const boot = window.setTimeout(() => activateScreen(initialScreen), 0);

    const onPopState = () => {
      const target = screenFromPathname(window.location.pathname) ?? "dashboard";
      window.setTimeout(() => activateScreen(target, true), 0);
    };
    window.addEventListener("popstate", onPopState);

    return () => {
      window.clearTimeout(boot);
      window.removeEventListener("popstate", onPopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
    };
  }, [initialScreen]);

  return null;
}
