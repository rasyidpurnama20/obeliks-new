import type { NavigationItemId } from "@/lib/mvp/types";

export const dashboardRouteByScreen: Record<NavigationItemId, string> = {
  dashboard: "/dashboard",
  "institusi-periode": "/institusi-periode",
  "pengguna-akses": "/pengguna-akses",
  "monitoring-rps": "/monitoring-rps",
  "pengajaran-saya": "/pengajaran-saya",
  "rps-saya": "/rps-saya",
  "ai-parser": "/ai-parser",
  "audit-log": "/audit-log",
  pengaturan: "/pengaturan",
};

export const dashboardScreens = Object.keys(dashboardRouteByScreen) as NavigationItemId[];

export function pathForScreen(screen: NavigationItemId) {
  return dashboardRouteByScreen[screen] ?? "/dashboard";
}

export function screenFromPathname(pathname: string): NavigationItemId | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return dashboardScreens.find((screen) => dashboardRouteByScreen[screen] === normalized) ?? null;
}

export function screenFromHref(href: string): NavigationItemId {
  const candidate = href.replace(/^#/, "").split("/")[0] as NavigationItemId;
  return dashboardScreens.includes(candidate) ? candidate : "dashboard";
}

export function canonicalizeDashboardUrl(url: string | URL, currentOrigin: string): string | null {
  const parsed = typeof url === "string" ? new URL(url, currentOrigin) : url;
  if (parsed.origin !== currentOrigin) return null;
  const hashScreen = parsed.hash ? screenFromHref(parsed.hash) : null;
  if (!hashScreen) return null;
  parsed.pathname = pathForScreen(hashScreen);
  parsed.hash = "";
  return `${parsed.pathname}${parsed.search}`;
}

export function normalizeSmartQuery(value: string) {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function smartSearchScore(query: string, haystack: string) {
  const needle = normalizeSmartQuery(query);
  const target = normalizeSmartQuery(haystack);
  if (!needle) return 0;
  if (target === needle) return 100;
  if (target.startsWith(needle)) return 80;
  if (target.includes(needle)) return 60;
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.every((token) => target.includes(token))) return 40 + tokens.length;
  return 0;
}
