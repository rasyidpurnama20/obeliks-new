import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("src/app/admin/minimal-dashboard-panel.tsx", "utf8");
const monitoring = fs.readFileSync("src/app/admin/monitoring-rps-panel.tsx", "utf8");
const monitoringActions = fs.readFileSync("src/app/admin/monitoring-rps-actions.ts", "utf8");
const inspector = fs.readFileSync("src/app/admin/rps-inspector-panel.tsx", "utf8");
const studioModel = fs.readFileSync("src/app/admin/rps-studio-model.ts", "utf8");
const studioActions = fs.readFileSync("src/app/admin/rps-studio-actions.ts", "utf8");
const docx = fs.readFileSync("src/app/admin/rps-docx.ts", "utf8");
const entry = fs.readFileSync("src/app/dashboard-entry.tsx", "utf8");
const routing = fs.readFileSync("src/app/admin/route-coordinator.tsx", "utf8");
const reset = fs.readFileSync("supabase/migrations/20260824011000_reset_domain_data_keep_two_users.sql", "utf8");
const seed = fs.readFileSync("supabase/migrations/20260824022000_seed_real_if_undip_curriculum.sql", "utf8");
const truncateBlock = reset.match(/truncate table([\s\S]*?)restart identity cascade;/i)?.[1] ?? "";

test("dashboard remains intentionally minimal", () => {
  assert.match(dashboard, /Selamat Datang, \{name\}/);
  assert.doesNotMatch(dashboard, /metric|workflow|Perlu tindakan|Kesehatan sistem/i);
  assert.match(entry, /<MinimalDashboardPanel/);
});

test("visible menu terminology is Kurikulum and Manajemen Pengguna without a global mutation observer", () => {
  assert.match(routing, /"institusi-periode": "Kurikulum"/);
  assert.match(routing, /"pengguna-akses": "Manajemen Pengguna"/);
  assert.match(routing, /Kelola Kurikulum/);
  assert.match(routing, /obeliks:navigation/);
  assert.doesNotMatch(routing, /MutationObserver/);
});

test("monitoring RPS remains database backed, searchable and stage gated", () => {
  assert.match(monitoringActions, /from\("rps_documents"\)/);
  assert.match(monitoringActions, /from\("academic_stages"\)/);
  assert.match(monitoringActions, /canCompose: currentStageKey === "rps-authoring"/);
  assert.match(monitoringActions, /canEvaluate: currentStageKey === "teaching" \|\| currentStageKey === "evaluation"/);
  assert.match(monitoring, /Cari mata kuliah, kode, dosen, atau periode/);
  assert.match(monitoring, /Filter status RPS/);
  assert.match(monitoring, />Susun<\/button>/);
  assert.match(monitoring, />Eval<\/button>/);
});

test("RPS OBE Studio follows the final 9-section template and is dynamic", () => {
  for (const label of ["Identitas & CPL", "CPMK & Alignment", "Jadwal & Materi", "Evaluasi", "Rubrik & Evidence", "Attainment", "Continuous Improvement", "Curriculum Context", "Final Document"]) {
    assert.match(inspector, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(inspector, /Generator Contoh/);
  assert.match(inspector, /\+ Tambah CPL/);
  assert.match(inspector, /\+ Tambah CPMK/);
  assert.match(inspector, /Matriks CPL–CPMK/);
  assert.match(inspector, /OBE Inspector/);
  assert.match(inspector, /Verifikasi Ulang &amp; Kunci/);
  assert.match(inspector, /Export DOCX/);
  assert.match(studioModel, /cplCatalog: RpsOutcome\[\]/);
  assert.match(studioModel, /cpmk: RpsCpmk\[\]/);
  assert.doesNotMatch(studioModel, /letters\s*=\s*\[/);
});

test("DOCX is a native dynamic Word export and studio saves through authenticated server action", () => {
  assert.match(docx, /application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/);
  assert.match(docx, /state\.cpl\.map/);
  assert.match(docx, /Matriks CPL–CPMK/);
  assert.match(docx, /zipStore/);
  assert.match(studioActions, /saveRpsStudioData/);
  assert.match(studioActions, /session\.auth\.getUser/);
  assert.match(studioActions, /from\("rps_documents"\)/);
  assert.match(studioActions, /\["kaprodi", "dosen"\]/);
});

test("clean reset still preserves the two real identities", () => {
  assert.match(reset, /from auth\.users/);
  assert.match(reset, /auth_user_count <> 2/);
  assert.match(truncateBlock, /public\.rps_documents/);
  assert.match(truncateBlock, /public\.academic_programs/);
  assert.doesNotMatch(truncateBlock, /public\.profiles/);
  assert.doesNotMatch(truncateBlock, /public\.platform_roles/);
  assert.doesNotMatch(truncateBlock, /public\.user_role_assignments/);
  assert.doesNotMatch(reset, /delete from auth\.users/);
});

test("real IF UNDIP seed restores 83 source course codes, 12 CPL and starter RPS without fake auth users or unpublished mappings", () => {
  const courseBlock = seed.match(/insert into if_undip_course_seed[\s\S]*?if \(select count\(\*\) from if_undip_course_seed\)/i)?.[0] ?? "";
  const courseCodes = courseBlock.match(/\('(MIK|UUW)[^']+'/g) ?? [];
  assert.equal(courseCodes.length, 83);
  assert.match(seed, /'IF-2024-OBE'/);
  assert.match(seed, /'CPL-01'/);
  assert.match(seed, /'CPL-12'/);
  assert.match(seed, /course_cpl_mapping','not_published'/);
  assert.match(seed, /course_learning_outcomes','not_published'/);
  assert.match(seed, /from public\.profiles p[\s\S]*join auth\.users u/);
  assert.match(seed, /created_by,[\s\S]*v_actor/);
  assert.doesNotMatch(seed, /insert into auth\.users/);
  assert.doesNotMatch(seed, /insert into public\.course_learning_outcomes/);
  assert.doesNotMatch(seed, /insert into public\.clo_plo_mappings/);
});
