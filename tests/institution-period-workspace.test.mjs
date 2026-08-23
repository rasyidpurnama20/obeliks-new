import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const panel = fs.readFileSync("src/app/admin/institution-period-panel.tsx", "utf8");
const actions = fs.readFileSync("src/app/admin/institution-period-actions.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260823234500_academic_context_curriculum.sql", "utf8");
const routes = fs.readFileSync("src/lib/navigation/routes.ts", "utf8");
const coordinator = fs.readFileSync("src/app/admin/route-coordinator.tsx", "utf8");
const nestedPage = fs.readFileSync("src/app/[screen]/[subview]/page.tsx", "utf8");

test("institution management uses a formal four-level academic identity on a separate page", () => {
  assert.match(panel, /Kelola Institusi/);
  assert.match(panel, /\/institusi-periode\/kelola-institusi/);
  for (const label of ["Nama Universitas / Institusi", "Fakultas / Sekolah", "Departemen", "Program Studi"]) {
    assert.match(panel, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(actions, /Kelola Institusi hanya tersedia untuk Superadmin/);
  assert.match(migration, /create table if not exists public\.academic_programs/);
  assert.match(migration, /university_name text not null/);
  assert.match(migration, /faculty_name text not null/);
  assert.match(migration, /department_name text not null/);
  assert.match(migration, /program_name text not null/);
});

test("active period is a formal Superadmin gateway while Kaprodi may manage period lifecycle", () => {
  assert.match(panel, /Set Periode Aktif/);
  assert.match(panel, /\/institusi-periode\/set-periode-aktif/);
  assert.match(actions, /Set Periode Aktif hanya tersedia untuk Superadmin/);
  assert.match(actions, /Hanya satu periode ke depan yang boleh berada dalam status Draft/);
  assert.match(actions, /late modification 30 hari/);
  assert.match(actions, /periodModificationMode/);
  assert.match(migration, /status text not null default 'draft' check \(status in \('draft', 'active', 'closed'\)\)/);
  assert.match(migration, /academic_periods_one_active_per_program_idx/);
  assert.match(migration, /academic_periods_one_draft_per_program_idx/);
});

test("main workspace has exactly Curriculum, Stages, and Classes as the three academic tabs", () => {
  for (const label of ["1. Kurikulum", "2. Tahapan", "3. Kelas"]) assert.match(panel, new RegExp(label));
  assert.doesNotMatch(panel, />Ringkasan</);
  assert.doesNotMatch(panel, />Periode &amp; Tahapan</);
  assert.doesNotMatch(panel, />Kelas &amp; Pengampu</);
});

test("curriculum data is normalized and covers graduate profiles, PLO, CLO, KBK, courses, and re-offer", () => {
  for (const table of [
    "curricula",
    "graduate_profiles",
    "program_learning_outcomes",
    "knowledge_groups",
    "curriculum_courses",
    "course_learning_outcomes",
    "clo_plo_mappings",
  ]) assert.match(migration, new RegExp(`public\\.${table}`));
  assert.match(panel, /Profil Lulusan/);
  assert.match(panel, /CPL \/ PLO/);
  assert.match(panel, /CPMK \/ CLO/);
  assert.match(panel, /Kelompok MK \/ KBK/);
  assert.match(panel, /Boleh dijalankan kembali/);
  assert.match(actions, /is_available_for_reoffer/);
  assert.match(actions, /Kurikulum ditetapkan aktif/);
});

test("RPS template structure is represented by course identity and PLO-CLO mapping fields", () => {
  assert.match(panel, /kode, kelompok\/KBK, SKS, semester, CPL dan CPMK/);
  assert.match(actions, /saveCurriculumCourse/);
  assert.match(actions, /saveClo/);
  assert.match(actions, /clo_plo_mappings/);
  assert.equal(fs.existsSync("data format/rps/Template_RPS_OBE_Format_Lengkap.docx"), true);
});

test("stages use edit-save workflow without manual lock controls", () => {
  assert.match(panel, />Ubah</);
  assert.match(panel, /Simpan Perubahan/);
  assert.match(panel, /Tidak ada kunci manual/);
  assert.match(actions, /saveAcademicStages/);
  assert.match(migration, /access_roles text\[\]/);
  assert.doesNotMatch(panel, /Kunci tanggal periode/);
  assert.doesNotMatch(panel, /Buka kunci/);
  assert.doesNotMatch(panel, /mini-lock/);
});

test("classes use automatic A-B-C section numbers, searchable course picker, and multiple lecturers", () => {
  assert.match(migration, /section_number integer not null/);
  assert.match(migration, /create table if not exists public\.class_lecturers/);
  assert.match(actions, /sectionLabel\(sectionNumber\)/);
  assert.match(actions, /sectionNumber = Number\(last\.data\?\.\[0\]\?\.section_number/);
  assert.match(panel, /Cari mata kuliah/);
  assert.match(panel, /Kelas otomatis berikutnya/);
  assert.match(panel, /Pengampu · pilih satu atau lebih/);
  assert.match(panel, /type="checkbox"/);
  assert.doesNotMatch(panel, /Nama kelas/);
});

test("academic records are server mediated and role scoped", () => {
  assert.match(migration, /revoke all on public\.academic_programs/);
  assert.match(migration, /to service_role/);
  assert.match(actions, /requireActor/);
  assert.match(actions, /kaprodiOrganizationIds/);
  assert.match(actions, /requireProgramEditor/);
  assert.doesNotMatch(actions, /academic_workspace_v1/);
});

test("nested institution administration URLs survive direct load and client routing", () => {
  assert.match(nestedPage, /kelola-institusi/);
  assert.match(nestedPage, /set-periode-aktif/);
  assert.match(nestedPage, /initialScreen="institusi-periode"/);
  assert.match(routes, /normalized\.startsWith\(`\$\{route\}\//);
  assert.match(coordinator, /preserveNestedPath/);
});
