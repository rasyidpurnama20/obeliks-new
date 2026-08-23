import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync("src/app/admin/institution-period-panel.tsx", "utf8");
const actions = fs.readFileSync("src/app/admin/institution-period-actions.ts", "utf8");
const cleaner = fs.readFileSync("src/app/admin/workspace-selector-cleaner.tsx", "utf8");

test("institution workspace keeps exactly the three requested tabs", () => {
  for (const label of ["Ringkasan", "Periode &amp; Tahapan", "Kelas &amp; Pengampu"]) {
    assert.match(panel, new RegExp(label.replace(/[&]/g, "&")));
  }
  assert.match(panel, /setTab\("summary"\)/);
  assert.match(panel, /setTab\("period"\)/);
  assert.match(panel, /setTab\("classes"\)/);
});

test("workspace selector no longer exposes institution management shortcut", () => {
  assert.match(cleaner, /\.obe-workspace-popover \.obe-link-option/);
  assert.match(cleaner, /display: none !important/);
});

test("baseline institution is selected and protected from destructive deletion", () => {
  assert.match(actions, /DEFAULT_ORGANIZATION_SLUG = "informatika-undip"/);
  assert.match(actions, /S1 - Informatika UNDIP/);
  assert.match(actions, /row\.slug === DEFAULT_ORGANIZATION_SLUG/);
  assert.match(actions, /dikunci karena menjadi institusi utama/);
});

test("deletable institutions require two independent confirmations", () => {
  assert.match(actions, /confirmationName\.trim\(\) !== row\.name/);
  assert.match(actions, /finalToken\.trim\(\)\.toUpperCase\(\) !== "HAPUS"/);
  assert.match(panel, /1\. Ketik nama persis/);
  assert.match(panel, /2\. Ketik HAPUS/);
});

test("period dates and stage dates have persisted lock guards", () => {
  assert.match(actions, /dateLocked/);
  assert.match(actions, /Tanggal periode sedang dikunci/);
  assert.match(actions, /current\.locked/);
  assert.match(panel, /Kunci tanggal periode/);
  assert.match(panel, /Buka kunci/);
});

test("course mapping supports many classes and many lecturers", () => {
  assert.match(actions, /period\.classes\.push\(next\)/);
  assert.match(actions, /lecturerIds: string\[\]/);
  assert.match(actions, /new Set\(input\.lecturerIds\)/);
  assert.match(panel, /Pengampu \(bisa lebih dari satu\)/);
  assert.match(panel, /type="checkbox"/);
});

test("RPS baseline folder is reserved in git", () => {
  assert.equal(fs.existsSync("data format/rps/.gitkeep"), true);
});
