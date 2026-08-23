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

function announceNavigation() {
  window.dispatchEvent(new Event("obeliks:navigation"));
}

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

    const boot = window.setTimeout(() => activateScreen(initialScreen), 0);

    const onPopState = () => {
      announceNavigation();
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
