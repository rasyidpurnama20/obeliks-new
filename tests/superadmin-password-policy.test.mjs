import assert from "node:assert/strict";
import test from "node:test";
import { validateInitialPassword } from "../scripts/superadmin-password-policy.mjs";

test("accepts a trimmed password with at least 12 characters", () => {
  assert.equal(validateInitialPassword("contoh-panjang-aman"), "contoh-panjang-aman");
});

test("rejects missing and short passwords", () => {
  assert.throws(() => validateInitialPassword(""), /required/);
  assert.throws(() => validateInitialPassword("terlalu-pdk"), /at least 12/);
});

test("rejects surrounding whitespace and control characters", () => {
  assert.throws(() => validateInitialPassword(" contoh-panjang-aman"), /whitespace/);
  assert.throws(() => validateInitialPassword("contoh-panjang\naman"), /control/);
});
