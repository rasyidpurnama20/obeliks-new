import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ManagedUserInputError,
  assertMutableTarget,
  initialsForManagedUser,
  parseArchiveCommand,
  parseManagedUserDraft,
  parseManagedUserUpdate,
  parseStatusCommand,
} from "../src/lib/admin/user-policy.ts";

const migration = await readFile(
  new URL("../supabase/migrations/20260823100000_admin_user_management.sql", import.meta.url),
  "utf8",
);
const actions = await readFile(
  new URL("../src/app/admin/user-actions.ts", import.meta.url),
  "utf8",
);
const aiRoute = await readFile(
  new URL("../src/app/api/ai/extract/route.ts", import.meta.url),
  "utf8",
);

const actorUserId = "11111111-1111-4111-8111-111111111111";
const targetUserId = "22222222-2222-4222-8222-222222222222";

test("normalizes a strict additive multi-role account payload", () => {
  assert.deepEqual(
    parseManagedUserDraft({
      displayName: "  Nadia   Karim  ",
      email: "  Nadia@UNDIP.AC.ID ",
      roles: ["dosen", "kaprodi", "dosen"],
    }),
    {
      displayName: "Nadia Karim",
      email: "nadia@undip.ac.id",
      roles: ["kaprodi", "dosen"],
    },
  );
});

test("rejects unknown fields, empty roles, and platform role injection", () => {
  assert.throws(
    () => parseManagedUserDraft({ displayName: "User Baru", email: "user@undip.ac.id", roles: ["dosen"], actorId: actorUserId }),
    /tidak diizinkan/,
  );
  assert.throws(
    () => parseManagedUserDraft({ displayName: "User Baru", email: "user@undip.ac.id", roles: [] }),
    ManagedUserInputError,
  );
  assert.throws(
    () => parseManagedUserDraft({ displayName: "User Baru", email: "user@undip.ac.id", roles: ["admin"] }),
    /Peran akun tidak valid/,
  );
  assert.throws(
    () => parseManagedUserDraft({ displayName: "User Baru", email: "user@undip.ac.id", roles: ["superadmin"] }),
    /Peran akun tidak valid/,
  );
});

test("validates update, status, and archive command shapes", () => {
  assert.deepEqual(
    parseManagedUserUpdate({ userId: targetUserId, displayName: "Adi Wibowo", roles: ["gpm"] }),
    { userId: targetUserId, displayName: "Adi Wibowo", roles: ["gpm"] },
  );
  assert.deepEqual(parseStatusCommand({ userId: targetUserId, status: "suspended" }), {
    userId: targetUserId,
    status: "suspended",
  });
  assert.deepEqual(parseArchiveCommand({ userId: targetUserId, confirmation: " USER@UNDIP.AC.ID " }), {
    userId: targetUserId,
    confirmation: "user@undip.ac.id",
  });
  assert.throws(() => parseStatusCommand({ userId: targetUserId, status: "archived" }), /Status akun tidak valid/);
  assert.throws(() => parseManagedUserUpdate({ userId: "not-a-uuid", displayName: "Adi Wibowo", roles: ["gpm"] }), /Identitas/);
});

test("protects self-management and every platform superadmin target", () => {
  assert.throws(
    () => assertMutableTarget({ actorUserId, targetUserId: actorUserId, targetIsSuperadmin: false }),
    /sendiri/,
  );
  assert.throws(
    () => assertMutableTarget({ actorUserId, targetUserId, targetIsSuperadmin: true }),
    /dilindungi/,
  );
  assert.doesNotThrow(
    () => assertMutableTarget({ actorUserId, targetUserId, targetIsSuperadmin: false }),
  );
  assert.equal(initialsForManagedUser("Nadia Karim", "nadia@undip.ac.id"), "NK");
});

test("migration blocks stale JWT access and separates dashboard roles from legacy academic membership", () => {
  assert.match(migration, /create or replace function public\.is_active_user\(\)/);
  assert.match(migration, /public\.is_active_user\(\) and \(/);
  assert.match(migration, /status in \('invited', 'active', 'suspended', 'archived'\)/);
  assert.match(migration, /create table if not exists public\.user_role_assignments/);
  assert.match(migration, /role in \('kaprodi', 'gpm', 'dosen', 'mahasiswa'\)/);
  assert.match(migration, /profiles_email_normalized_unique_idx[\s\S]*lower\(email\)/);
  assert.match(migration, /when tg_op = 'INSERT' then coalesce\(excluded\.display_name/);
  assert.doesNotMatch(migration, /update of email, email_confirmed_at, raw_user_meta_data/);
  assert.match(migration, /user_role_assignments_read_authorized[\s\S]*public\.is_active_user\(\)/);
  assert.match(migration, /drop policy if exists courses_member_all/);
  assert.match(migration, /create policy courses_member_select[\s\S]*for select to authenticated/);
  assert.match(migration, /drop policy if exists rps_documents_member_all/);
  assert.match(migration, /Legacy membership is never silently retained[\s\S]*delete from public\.organization_members/);
  assert.match(migration, /if p_status = 'archived' then[\s\S]*delete from public\.organization_members[\s\S]*where user_id = p_target_user_id/);
  assert.match(migration, /revoked_legacy_memberships/);
  assert.doesNotMatch(migration, /user_role_assignments[\s\S]{0,300}public\.is_org_member/);
});

test("trusted account command is service-only, atomic, audited, and has no normal hard-delete path", () => {
  assert.match(migration, /create or replace function public\.admin_apply_user_access/);
  assert.match(migration, /active_superadmin_required/);
  assert.match(migration, /self_management_forbidden/);
  assert.match(migration, /protected_platform_admin/);
  assert.match(migration, /delete from public\.user_role_assignments/);
  assert.match(migration, /insert into public\.audit_logs/);
  assert.match(migration, /revoke all on function public\.admin_apply_user_access\([\s\S]*from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.admin_apply_user_access\([\s\S]*to service_role/);

  const guardBody = actions.slice(actions.indexOf("async function requireActiveSuperadmin"), actions.indexOf("async function applicationOrigin"));
  assert.ok(guardBody.indexOf("profile?.status") < guardBody.indexOf("getSupabaseAdmin()"));
  assert.equal((actions.match(/\.deleteUser\(/g) ?? []).length, 1, "hard delete is reserved for create compensation only");
  assert.match(actions, /account\.archived/);
  assert.match(actions, /account\.auth_sync_pending/);
  assert.match(actions, /PERMANENT_BAN_DURATION/);

  const updateBody = actions.slice(actions.indexOf("export async function updateManagedUser"), actions.indexOf("export async function setManagedUserStatus"));
  assert.doesNotMatch(updateBody, /updateUserById/);
  assert.match(updateBody, /await applyUserAccess/);
});

test("invitation and onboarding links preserve implicit auth fragments", () => {
  assert.match(actions, /inviteUserByEmail[\s\S]{0,300}redirectTo: `\$\{origin\}\/reset-password`/);
  assert.doesNotMatch(actions, /inviteUserByEmail[\s\S]{0,300}auth\/callback/);
  assert.match(actions, /signInWithOtp\([\s\S]{0,300}shouldCreateUser: false/);
  assert.match(actions, /resetPasswordForEmail[\s\S]{0,150}\{ redirectTo \}/);
});

test("access-link delivery is preceded by a durable audit request", () => {
  const body = actions.slice(actions.indexOf("export async function sendManagedUserAccessLink"));
  const requestedAudit = body.indexOf('action: "account.access_link_requested"');
  const providerDelivery = Math.min(
    body.indexOf("resetPasswordForEmail"),
    body.indexOf("signInWithOtp"),
  );
  assert.ok(requestedAudit >= 0 && requestedAudit < providerDelivery);
  assert.match(body, /account\.access_link_failed/);
  assert.match(body, /account\.access_link_sent/);
  assert.match(body, /operation_id: operationId/);
});

test("AI extraction enforces active profile and organization membership", () => {
  assert.match(aiRoute, /authenticateRequest\(request\)/);
  assert.match(aiRoute, /assertOrganizationMember\(/);
  assert.doesNotMatch(aiRoute, /getSupabaseAdmin/);
});
