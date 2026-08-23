import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const controls = await readFile(
  new URL("../src/app/admin/user-access-controls.tsx", import.meta.url),
  "utf8",
);
const customActions = await readFile(
  new URL("../src/app/admin/custom-user-actions.ts", import.meta.url),
  "utf8",
);
const login = await readFile(
  new URL("../src/app/login-form.tsx", import.meta.url),
  "utf8",
);
const home = await readFile(
  new URL("../src/app/page.tsx", import.meta.url),
  "utf8",
);
const dashboardEntry = await readFile(
  new URL("../src/app/dashboard-entry.tsx", import.meta.url),
  "utf8",
);
const reset = await readFile(
  new URL("../src/app/reset-password/page.tsx", import.meta.url),
  "utf8",
);
const resetActions = await readFile(
  new URL("../src/app/reset-password/actions.ts", import.meta.url),
  "utf8",
);

test("add-user picker uses the three requested onboarding methods and styled > chevrons", () => {
  assert.match(controls, /Buat akun manual/);
  assert.match(controls, /Impor CSV/);
  assert.match(controls, /Sinkron dari SIAP/);
  assert.match(controls, /className="obe-method-chevron"[^>]*>&gt;<\/b>/);
  assert.doesNotMatch(controls, /<b>→<\/b>/);
});

test("manual creation supports invite and direct Custom User with explicit controls", () => {
  assert.match(controls, /type ManualMethod = "invite" \| "custom"/);
  assert.match(controls, /Kirim undangan/);
  assert.match(controls, /Buat Custom User/);
  assert.match(controls, /Nama/);
  assert.match(controls, /Email institusi/);
  assert.match(controls, /Pilih minimal satu peran/);
  assert.match(controls, /createManagedUser\(draft\)/);
  assert.match(controls, /createCustomManagedUser\(\{ draft, source: "manual" \}\)/);
});

test("CSV import is capped at 100 and validates before mutation", () => {
  assert.match(controls, /const MAX_IMPORT = 100/);
  assert.match(controls, /rowCount > MAX_IMPORT/);
  assert.match(controls, /Maksimal \$\{MAX_IMPORT\} akun per batch/);
  assert.match(controls, /preview & validasi sebelum akun dibuat/);
  assert.match(controls, /stats\.ready/);
  assert.match(controls, /stats\.existing/);
  assert.match(controls, /stats\.error/);
  assert.match(controls, /Ganti file/);
});

test("SIAP onboarding is server-enforced as Mahasiswa-only and uses a bootstrap password", () => {
  assert.match(controls, /fallbackRole: "mahasiswa", forceRole: true/);
  assert.match(controls, /Khusus akun Mahasiswa/);
  assert.doesNotMatch(controls, /Jenis data[\s\S]*<select/);
  assert.match(customActions, /DEFAULT_CUSTOM_USER_PASSWORD = "user123"/);
  assert.match(customActions, /source === "siap" && \(draft\.roles\.length !== 1 \|\| draft\.roles\[0\] !== "mahasiswa"\)/);
  assert.match(customActions, /email_confirm: true/);
  assert.match(customActions, /bootstrap_password: true/);
  assert.match(customActions, /p_action: "account\.custom_created"/);
  assert.match(controls, /mode === "siap"[\s\S]*createCustomManagedUser\(\{ draft, source: "siap" \}\)/);
});

test("bootstrap accounts cannot reach dashboard before replacing the initial password", () => {
  assert.match(login, /value\.length < 7/);
  assert.match(login, /signInData\.user\.app_metadata\?\.bootstrap_password === true/);
  assert.match(login, /router\.replace\("\/reset-password\?required=1"\)/);
  assert.match(home, /user\.app_metadata\?\.bootstrap_password === true[\s\S]*redirect\("\/reset-password\?required=1"\)/);
  assert.match(dashboardEntry, /user\.app_metadata\?\.bootstrap_password === true[\s\S]*redirect\("\/reset-password\?required=1"\)/);
  assert.match(reset, /password\.length < 12/);
  assert.match(reset, /completeBootstrapPasswordChange\(\)/);
  assert.match(resetActions, /user\.app_metadata\?\.bootstrap_password !== true/);
  assert.match(resetActions, /bootstrap_password: false/);
});

test("custom account action validates Superadmin and never logs the bootstrap password value", () => {
  assert.match(customActions, /platformRole\?\.role !== "superadmin"/);
  assert.match(customActions, /parseManagedUserDraft\(record\.draft\)/);
  assert.match(customActions, /password_change_required: true/);
  const metadataStart = customActions.indexOf("p_metadata:");
  const metadataEnd = customActions.indexOf("});", metadataStart);
  const metadataBlock = customActions.slice(metadataStart, metadataEnd);
  assert.doesNotMatch(metadataBlock, /user123/);
});

test("bootstrap finalizer is authenticated and clears only the server-controlled flag", () => {
  assert.match(resetActions, /auth\.getUser\(\)/);
  assert.match(resetActions, /admin\.auth\.admin\.updateUserById\(user\.id/);
  assert.match(resetActions, /app_metadata: \{[\s\S]*\.\.\.user\.app_metadata,[\s\S]*bootstrap_password: false/);
  assert.doesNotMatch(resetActions, /\bpassword\s*:/);
});
