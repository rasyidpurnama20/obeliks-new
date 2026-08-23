import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actions = await readFile(
  new URL("../src/app/admin/impersonation-actions.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../src/app/admin/page.tsx", import.meta.url),
  "utf8",
);
const enhancements = await readFile(
  new URL("../src/app/admin/user-access-enhancements.tsx", import.meta.url),
  "utf8",
);
const banner = await readFile(
  new URL("../src/app/admin/impersonation-banner.tsx", import.meta.url),
  "utf8",
);

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
  assert.match(actions, /path: "\/admin"/);
  assert.match(actions, /account\.impersonation_ended/);
  assert.doesNotMatch(actions, /setSession|signInWithPassword|verifyOtp|generateLink/);
});

test("ending impersonation clears the same path-scoped cookie even when end-audit has a warning", () => {
  const stopBody = actions.slice(actions.indexOf("export async function stopSupportImpersonation"));
  assert.match(stopBody, /catch \(auditError\)[\s\S]*auditWarning = true/);
  assert.match(stopBody, /cookieStore\.set\(IMPERSONATION_COOKIE, "", \{[\s\S]*path: "\/admin"[\s\S]*maxAge: 0[\s\S]*expires: new Date\(0\)/);
  assert.doesNotMatch(stopBody, /cookieStore\.delete\(IMPERSONATION_COOKIE\)/);
  assert.ok(
    stopBody.indexOf("cookieStore.set(IMPERSONATION_COOKIE, \"\"") > stopBody.indexOf("catch (auditError)"),
    "cookie clearing must still run after an audit failure is handled",
  );
});

test("return-to-superadmin UI replaces stale history and recovers from server-action rejection", () => {
  assert.match(banner, /window\.location\.replace\("\/admin"\)/);
  assert.match(banner, /try \{[\s\S]*await stopSupportImpersonation\(\)[\s\S]*\} catch \{/);
  assert.match(banner, /setStopping\(false\)/);
});

test("dashboard resolves the target only for a real superadmin and uses only the target assigned roles", () => {
  assert.match(page, /if \(isSuperadmin\) \{/);
  assert.match(page, /cookieStore\.get\(IMPERSONATION_COOKIE\)/);
  assert.match(page, /!target\.isSuperadmin && target\.profile\.status === "active" && targetRoles\.length/);
  assert.match(page, /effectiveRoles: RoleId\[\] = impersonatedUser \? \[\.\.\.impersonatedUser\.roles\] : availableRoles/);
  assert.match(page, /initialManagedUsers=\{impersonatedUser \? \[\] : managedUsers\}/);
});

test("user access UI hides descriptive heading text, provides role filtering, and never exposes impersonation for protected accounts", () => {
  assert.match(enhancements, /obeUserAccessRefined/);
  assert.match(enhancements, /Filter peran pengguna/);
  assert.match(enhancements, /user\.protected \|\| user\.isSelf \|\| user\.status !== "active" \|\| !user\.roles\.length/);
  assert.match(enhancements, /Lihat sebagai/);
  assert.match(enhancements, /Sesi login tetap milik Superadmin/);
});
