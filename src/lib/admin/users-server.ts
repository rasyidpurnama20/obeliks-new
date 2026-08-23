import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { initialsForManagedUser } from "./user-policy";
import { assignableRoles, type AssignableRole, type ManagedAccountStatus, type ManagedUser } from "./user-types";

const DEFAULT_ORGANIZATION_SLUG = "informatika-undip";

export async function getManagedOrganization(admin: SupabaseClient): Promise<{
  id: string;
  name: string;
  slug: string;
}> {
  const slug = (
    process.env.OBELIKS_ORGANIZATION_SLUG
    ?? process.env.LECTURER_ORGANIZATION_SLUG
    ?? DEFAULT_ORGANIZATION_SLUG
  ).trim();
  const { data, error } = await admin
    .from("organizations")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Managed organization ${slug} is not configured.`);
  return data;
}

async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}

function safeStatus(value: unknown, emailConfirmed: boolean): ManagedAccountStatus {
  if (["invited", "active", "suspended", "archived"].includes(String(value))) {
    return value as ManagedAccountStatus;
  }
  return emailConfirmed ? "active" : "invited";
}

export async function loadManagedUsers(
  admin: SupabaseClient,
  actorUserId: string,
  organizationId: string,
): Promise<ManagedUser[]> {
  const [authUsers, profilesResult, platformRolesResult, assignmentsResult, legacyMembershipsResult] = await Promise.all([
    listAllAuthUsers(admin),
    admin.from("profiles").select("id,email,display_name,status,created_at"),
    admin.from("platform_roles").select("user_id,role"),
    admin
      .from("user_role_assignments")
      .select("user_id,role")
      .eq("organization_id", organizationId),
    admin
      .from("organization_members")
      .select("user_id,role")
      .eq("organization_id", organizationId),
  ]);

  if (profilesResult.error) throw profilesResult.error;
  if (platformRolesResult.error) throw platformRolesResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (legacyMembershipsResult.error) throw legacyMembershipsResult.error;

  const profiles = new Map(profilesResult.data.map((profile) => [profile.id, profile]));
  const superadmins = new Set(
    platformRolesResult.data
      .filter(({ role }) => role === "superadmin")
      .map(({ user_id }) => user_id),
  );
  const roleMap = new Map<string, AssignableRole[]>();
  const legacyMembershipMap = new Map(
    legacyMembershipsResult.data.map((membership) => [membership.user_id, membership.role]),
  );
  for (const assignment of assignmentsResult.data) {
    const roles = roleMap.get(assignment.user_id) ?? [];
    roles.push(assignment.role as AssignableRole);
    roleMap.set(assignment.user_id, roles);
  }

  return authUsers
    .map((authUser): ManagedUser => {
      const profile = profiles.get(authUser.id);
      const name = profile?.display_name?.trim()
        || String(authUser.user_metadata?.display_name ?? "").trim()
        || "Pengguna tanpa nama";
      const email = (profile?.email || authUser.email || "").trim().toLowerCase();
      const protectedAccount = superadmins.has(authUser.id);
      const emailConfirmed = Boolean(authUser.email_confirmed_at);
      const assignedRoleSet = new Set(roleMap.get(authUser.id) ?? []);
      const roles = protectedAccount
        ? ["admin" as const]
        : assignableRoles.filter((role) => assignedRoleSet.has(role));

      return {
        id: authUser.id,
        name,
        email,
        initials: initialsForManagedUser(name, email),
        roles,
        legacyMembershipRole: (legacyMembershipMap.get(authUser.id) as ManagedUser["legacyMembershipRole"]) ?? null,
        status: safeStatus(profile?.status, emailConfirmed),
        emailConfirmed,
        createdAt: authUser.created_at || profile?.created_at || new Date(0).toISOString(),
        lastActiveAt: authUser.last_sign_in_at ?? null,
        protected: protectedAccount,
        isSelf: authUser.id === actorUserId,
      };
    })
    .sort((left, right) => {
      if (left.protected !== right.protected) return left.protected ? -1 : 1;
      if ((left.status === "archived") !== (right.status === "archived")) {
        return left.status === "archived" ? 1 : -1;
      }
      return left.name.localeCompare(right.name, "id-ID");
    });
}

export async function getManagedTarget(
  admin: SupabaseClient,
  targetUserId: string,
  organizationId: string,
) {
  const [{ data: authData, error: authError }, profileResult, platformRoleResult, assignmentsResult] = await Promise.all([
    admin.auth.admin.getUserById(targetUserId),
    admin.from("profiles").select("id,email,display_name,status").eq("id", targetUserId).maybeSingle(),
    admin.from("platform_roles").select("role").eq("user_id", targetUserId).maybeSingle(),
    admin
      .from("user_role_assignments")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", targetUserId),
  ]);

  if (authError) throw authError;
  if (profileResult.error) throw profileResult.error;
  if (platformRoleResult.error) throw platformRoleResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (!authData.user || !profileResult.data) throw new Error("Managed user was not found.");

  return {
    authUser: authData.user,
    profile: profileResult.data,
    roles: assignmentsResult.data.map(({ role }) => role as AssignableRole),
    isSuperadmin: platformRoleResult.data?.role === "superadmin",
  };
}
