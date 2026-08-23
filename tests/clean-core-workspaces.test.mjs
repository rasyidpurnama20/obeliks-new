import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dashboard = fs.readFileSync("src/app/admin/minimal-dashboard-panel.tsx", "utf8");
const monitoring = fs.readFileSync("src/app/admin/monitoring-rps-panel.tsx", "utf8");
const monitoringActions = fs.readFileSync("src/app/admin/monitoring-rps-actions.ts", "utf8");
const inspector = fs.readFileSync("src/app/admin/rps-inspector-panel.tsx", "utf8");
const entry = fs.readFileSync("src/app/dashboard-entry.tsx", "utf8");
const routing = fs.readFileSync("src/app/admin/route-coordinator.tsx", "utf8");
const reset = fs.readFileSync("supabase/migrations/20260824011000_reset_domain_data_keep_two_users.sql", "utf8");
const truncateBlock = reset.match(/truncate table([\s\S]*?)restart identity cascade;/i)?.[1] ?? "";

test("dashboard is intentionally reduced to one welcome surface", () => {
  assert.match(dashboard, /Selamat Datang, \{name\}/);
  assert.doesNotMatch(dashboard, /metric|workflow|Perlu tindakan|Kesehatan sistem/i);
  assert.match(entry, /<MinimalDashboardPanel/);
});

test("route synchronization broadcasts clean workspace navigation without observers", () => {
  assert.match(routing, /obeliks:navigation/);
  assert.doesNotMatch(routing, /MutationObserver/);
});

test("monitoring RPS is database backed, searchable and stage gated", () => {
  assert.match(monitoringActions, /from\("rps_documents"\)/);
  assert.match(monitoringActions, /from\("academic_stages"\)/);
  assert.match(monitoringActions, /canCompose: currentStageKey === "rps-authoring"/);
  assert.match(monitoringActions, /canEvaluate: currentStageKey === "teaching" \|\| currentStageKey === "evaluation"/);
  assert.match(monitoring, /Cari mata kuliah, kode, dosen, atau periode/);
  assert.match(monitoring, /Filter status RPS/);
  assert.match(monitoring, />Susun<\/button>/);
  assert.match(monitoring, />Eval<\/button>/);
  assert.doesNotMatch(monitoring, /rpsRecords|Dasar Pemrograman|Analitik Data/);
});

test("RPS inspectors preserve Level 2 and Level 4 concepts without simulated evidence", () => {
  for (const label of ["Identitas", "CPL / PLO", "CPMK / CLO", "Sub-CPMK", "OBE Alignment", "Matriks CPL–CPMK", "Bloom Inspector", "Assessment Blueprint", "Quality Inspector"]) assert.match(inspector, new RegExp(label));
  for (const label of ["Student Assessment Evidence", "CPMK Attainment", "CPL Attainment", "Student Outcome Heatmap", "Outcome Gap Analysis", "Corrective & Improvement Action", "RPS Semester Berikutnya", "Closed Loop Inspector"]) assert.match(inspector, new RegExp(label.replace(/[&]/g, "&")));
  assert.match(inspector, /Inspector tidak menambahkan data contoh/);
  assert.doesNotMatch(inspector, /Math\.random|Simulate New Scores|Generate Recommendation/);
});

test("destructive reset preserves exactly two current identities and removes domain data", () => {
  assert.match(reset, /from auth\.users/);
  assert.match(reset, /auth_user_count <> 2/);
  assert.match(truncateBlock, /public\.rps_documents/);
  assert.match(truncateBlock, /public\.academic_programs/);
  assert.match(truncateBlock, /public\.courses/);
  assert.match(truncateBlock, /public\.audit_logs/);
  assert.match(reset, /where slug <> 'informatika-undip'/);
  assert.doesNotMatch(truncateBlock, /public\.profiles/);
  assert.doesNotMatch(truncateBlock, /public\.platform_roles/);
  assert.doesNotMatch(truncateBlock, /public\.user_role_assignments/);
  assert.doesNotMatch(reset, /delete from auth\.users/);
});
