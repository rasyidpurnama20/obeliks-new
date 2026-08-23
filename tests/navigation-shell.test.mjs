import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  canonicalizeDashboardUrl,
  pathForScreen,
  screenFromPathname,
  smartSearchScore,
} from "../src/lib/navigation/routes.ts";

const shell = await readFile(new URL("../src/app/admin/dashboard-shell-controls.tsx", import.meta.url), "utf8");
const coordinator = await readFile(new URL("../src/app/admin/route-coordinator.tsx", import.meta.url), "utf8");
const loginPage = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const loginForm = await readFile(new URL("../src/app/login-form.tsx", import.meta.url), "utf8");
const userFilters = await readFile(new URL("../src/app/admin/user-filter-unifier.tsx", import.meta.url), "utf8");

test("every primary menu has a canonical top-level URL", () => {
  assert.equal(pathForScreen("dashboard"), "/dashboard");
  assert.equal(pathForScreen("institusi-periode"), "/institusi-periode");
  assert.equal(pathForScreen("pengguna-akses"), "/pengguna-akses");
  assert.equal(pathForScreen("monitoring-rps"), "/monitoring-rps");
  assert.equal(pathForScreen("pengajaran-saya"), "/pengajaran-saya");
  assert.equal(pathForScreen("rps-saya"), "/rps-saya");
  assert.equal(pathForScreen("ai-parser"), "/ai-parser");
  assert.equal(pathForScreen("audit-log"), "/audit-log");
  assert.equal(pathForScreen("pengaturan"), "/pengaturan");
  assert.equal(screenFromPathname("/pengguna-akses"), "pengguna-akses");
});

test("legacy hash navigation is canonicalized without leaving admin/hash URLs", () => {
  assert.equal(
    canonicalizeDashboardUrl("https://obeliks.test/admin#monitoring-rps", "https://obeliks.test"),
    "/monitoring-rps",
  );
  assert.equal(
    canonicalizeDashboardUrl("https://obeliks.test/dashboard#pengguna-akses", "https://obeliks.test"),
    "/pengguna-akses",
  );
  assert.match(coordinator, /canonicalizeDashboardUrl/);
  assert.match(coordinator, /screenFromPathname/);
});

test("smart search ranks exact, prefix, substring, and multi-token matches", () => {
  const exact = smartSearchScore("Monitoring RPS", "Monitoring RPS");
  const prefix = smartSearchScore("monitor", "Monitoring RPS");
  const substring = smartSearchScore("RPS", "Monitoring RPS");
  const tokens = smartSearchScore("basis data", "IF204 Basis Data kelas B");
  const miss = smartSearchScore("keuangan", "Monitoring RPS");
  assert.ok(exact > prefix && prefix > substring && substring > 0);
  assert.ok(tokens > 0);
  assert.equal(miss, 0);
});

test("global shell notifications no longer scrape only the current dashboard DOM", () => {
  assert.match(shell, /roleDashboards\[role\]/);
  assert.doesNotMatch(shell, /Perlu tindakan Anda[\s\S]*querySelectorAll\("article"\)/);
  assert.match(shell, /notificationActions\(activeRole, managedUsers\)/);
});

test("workspace, account, notification, and search popovers dismiss on outside click", () => {
  assert.match(shell, /document\.addEventListener\("pointerdown", closeOutside\)/);
  assert.match(shell, /closest\("\.obe-shell-interactive"\)/);
  assert.match(shell, /setOpenPanel\(null\)/);
});

test("smart search has keyboard shortcut and keyboard navigation", () => {
  assert.match(shell, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(shell, /ArrowDown/);
  assert.match(shell, /ArrowUp/);
  assert.match(shell, /event\.key === "Enter"/);
  assert.match(shell, /Cari menu, mata kuliah, RPS, pengguna/);
});

test("login route redirects authorized sessions and successful login lands on dashboard", () => {
  assert.match(loginPage, /if \(hasAccess\) redirect\("\/dashboard"\)/);
  assert.match(loginForm, /router\.replace\("\/dashboard"\)/);
});

test("Pengguna & Akses status and role filters share one visual contract", () => {
  assert.match(userFilters, /Filter status akun/);
  assert.match(userFilters, /\.obe-role-filter/);
  assert.match(userFilters, /height: 34px/);
  assert.match(userFilters, /width: 160px/);
});
