import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync("src/app/admin/institution-period-panel.tsx", "utf8");
const actions = fs.readFileSync("src/app/admin/institution-period-actions.ts", "utf8");
const route = fs.readFileSync("src/app/[screen]/[subview]/page.tsx", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260823234500_academic_context_curriculum.sql", "utf8");

test("institution landing is intentionally minimal", () => {
  assert.match(panel, /<h1>Institusi &amp; Periode<\/h1>/);
  assert.match(panel, />Kelola Institusi<\/button>/);
  assert.match(panel, />Periode Aktif<\/button>/);
  assert.match(panel, /path === "\/institusi-periode"/);
});

test("formal institution hierarchy remains normalized and Superadmin managed", () => {
  for (const field of ["universityName", "facultyName", "departmentName", "programName"]) assert.match(actions, new RegExp(field));
  assert.match(actions, /Hanya Superadmin yang dapat mengelola institusi/);
  assert.match(panel, /Universitas \/ Institusi/);
  assert.match(panel, /Fakultas \/ Sekolah/);
  assert.match(panel, /Departemen/);
  assert.match(panel, /Program Studi/);
  assert.match(migration, /create table if not exists public\.academic_programs/);
});

test("active period page exposes previous current next and curriculum choice", () => {
  assert.match(panel, /Periode Aktif/);
  assert.match(panel, /Sebelumnya/);
  assert.match(panel, /Berikutnya/);
  assert.match(panel, /aria-hidden="true">←/);
  assert.match(panel, /aria-hidden="true">→/);
  assert.match(panel, /Kurikulum Inspector/);
  assert.match(actions, /setActiveAcademicPeriod/);
  assert.match(actions, /primary_curriculum_id/);
});

test("curriculum inspector keeps Level 3 program-intelligence concepts without fake seeds", () => {
  for (const label of ["Mata Kuliah", "Curriculum Map", "CPL Coverage", "I-R-M Progression", "Gap & Recommendation", "Curriculum Inspector"]) {
    assert.match(panel, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(panel, /Inspector tidak menampilkan data contoh/);
  assert.doesNotMatch(panel, /IF101|Dasar Pemrograman|Kurikulum Baseline/);
});

test("nested routes cover academic context and curriculum inspector", () => {
  assert.match(route, /kelola-institusi/);
  assert.match(route, /periode-aktif/);
  assert.match(route, /kurikulum-inspector/);
});
