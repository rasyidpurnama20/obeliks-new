import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../src/app/admin/dashboard-shell-controls.tsx", import.meta.url), "utf8");
const period = await readFile(new URL("../src/app/admin/institution-period-panel.tsx", import.meta.url), "utf8");
const config = await readFile(new URL("../next.config.ts", import.meta.url), "utf8");
const login = await readFile(new URL("../src/app/login-form.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const entry = await readFile(new URL("../src/app/dashboard-entry.tsx", import.meta.url), "utf8");

test("global shell does not observe every body mutation or rewrite React DOM during cleanup", () => {
  assert.doesNotMatch(shell, /new MutationObserver/);
  assert.doesNotMatch(shell, /observer\.observe\(document\.body/);
  assert.doesNotMatch(shell, /cloneNode|replaceChild/);
  assert.match(shell, /sameRoleOptions/);
  assert.match(shell, /removeEventListener\("change", boundHandler\)/);
});

test("institution period panel is route/event driven instead of body-mutation driven", () => {
  assert.doesNotMatch(period, /observer\.observe\(document\.body/);
  assert.doesNotMatch(period, /new MutationObserver/);
  assert.match(period, /window\.location\.pathname === "\/institusi-periode"/);
  assert.match(period, /addEventListener\("popstate", syncRoute\)/);
});

test("menu navigation remains client-side and avoids full document reloads", () => {
  assert.match(shell, /window\.history\.pushState/);
  assert.match(shell, /window\.history\.replaceState/);
  assert.match(shell, /dispatchEvent\(new PopStateEvent\("popstate"\)\)/);
  assert.doesNotMatch(shell, /window\.location\.assign\(path\)/);
});

test("baseline browser security headers are configured globally", () => {
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /object-src 'none'/);
  assert.match(config, /X-Frame-Options[\s\S]*DENY/);
  assert.match(config, /X-Content-Type-Options[\s\S]*nosniff/);
  assert.match(config, /Referrer-Policy[\s\S]*strict-origin-when-cross-origin/);
  assert.match(config, /Permissions-Policy/);
});

test("bootstrap password gate uses server-controlled app metadata on every protected entry", () => {
  assert.match(login, /signInData\.user\.app_metadata\?\.bootstrap_password === true/);
  assert.match(home, /user\.app_metadata\?\.bootstrap_password === true/);
  assert.match(entry, /user\.app_metadata\?\.bootstrap_password === true/);
  assert.doesNotMatch(login, /user_metadata\?\.must_change_password/);
  assert.doesNotMatch(home, /user_metadata\?\.must_change_password/);
  assert.doesNotMatch(entry, /user_metadata\?\.must_change_password/);
});
