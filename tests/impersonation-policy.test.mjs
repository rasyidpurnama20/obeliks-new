import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actions = await readFile(new URL("../src/app/admin/impersonation-actions.ts", import.meta.url), "utf8");
const entry = await readFile(new URL("../src/app/dashboard-entry.tsx", import.meta.url), "utf8");
const enhancements = await readFile(new URL("../src/app/admin/user-access-enhancements.tsx", import.meta.url), "utf8");
const banner = await readFile(new URL("../src/app/admin/impersonation-banner.tsx", import.meta.url), "utf8");

test("impersonation is superadmin-only, excludes superadmins, and requires an active role-bearing target", () => {
  assert.match(actions, /platformRole\?\.role !== "superadmin"/);
  assert.match(actions, /targetUserId === actorUserId \|\| target\.isSuperadmin/);
  assert.match(actions, /target\.profile\.status !== "active"/);
  assert.match(actions, /!target\.roles\.length/);
});

test("impersonation is an audited support view and never swaps the target auth session", () => {
  const startAudit = actions.indexOf('action: "account.impersonation_started"');
  const cookieSet = actions.indexOf("cookieStore.set(IMPERSONATION_COOKIE");
  assert.ok(startAudit >= 0 && cookieSet > startAudit, "audit must commit before the support cookie is set");
  assert.match(actions, /mode: "read_only_support_view"/);
  assert.match(actions, /httpOnly: true/);
  assert.match(actions, /sameSite: "lax"/);
  assert.match(actions, /path: "\/"/);
  assert.match(actions, /account\.impersonation_ended/);
  assert.doesNotMatch(actions, /setSession|signInWithPassword|verifyOtp|generateLink/);
});

test("ending impersonation clears the globally scoped cookie even when end-audit has a warning", () => {
  const stopBody = actions.slice(actions.indexOf("export async function stopSupportImpersonation"));
  assert.match(stopBody, /catch \(auditError\)[\s\S]*auditWarning = true/);
  assert.match(stopBody, /cookieStore\.set\(IMPERSONATION_COOKIE, "", \{[\s\S]*path: "\/"[\s\S]*maxAge: 0[\s\S]*expires: new Date\(0\)/);
  assert.doesNotMatch(stopBody, /cookieStore\.delete\(IMPERSONATION_COOKIE\)/);
});

test("return-to-superadmin UI uses canonical dashboard and recovers from server-action rejection", () => {
  assert.match(banner, /window\.location\.replace\("\/dashboard"\)/);
  assert.match(banner, /try \{[\s\S]*await stopSupportImpersonation\(\)[\s\S]*\} catch \{/);
  assert.match(banner, /setStopping\(false\)/);
});

test("shared dashboard entry resolves impersonation and keeps managed users private during support view", () => {
  assert.match(entry, /if \(isSuperadmin\) \{/);
  assert.match(entry, /cookieStore\.get\(IMPERSONATION_COOKIE\)/);
  assert.match(entry, /!target\.isSuperadmin && target\.profile\.status === "active" && targetRoles\.length/);
  assert.match(entry, /effectiveRoles: RoleId\[\] = impersonatedUser \? \[\.\.\.impersonatedUser\.roles\] : availableRoles/);
  assert.match(entry, /initialManagedUsers=\{impersonatedUser \? \[\] : managedUsers\}/);
});

test("user access UI still excludes protected accounts from impersonation", () => {
  assert.match(enhancements, /obeUserAccessRefined/);
  assert.match(enhancements, /Filter peran pengguna/);
  assert.match(enhancements, /user\.protected \|\| user\.isSelf \|\| user\.status !== "active" \|\| !user\.roles\.length/);
  assert.match(enhancements, /Lihat sebagai/);
  assert.match(enhancements, /Sesi login tetap milik Superadmin/);
});
