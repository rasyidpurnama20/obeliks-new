import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "./actions";
import { DashboardApp } from "./dashboard-app";
import { DashboardShellControls } from "./dashboard-shell-controls";
import { ImpersonationBanner } from "./impersonation-banner";
import { InstitutionPeriodPanel } from "./institution-period-panel";
import { UserAccessControls } from "./user-access-controls";
import { UserAccessEnhancements } from "./user-access-enhancements";
import { IMPERSONATION_COOKIE, type ImpersonatedUserView } from "@/lib/admin/impersonation";
import type { ManagedUser } from "@/lib/admin/user-types";
import type { RoleId } from "@/lib/mvp/types";
import { getManagedOrganization, getManagedTarget, loadManagedUsers } from "@/lib/admin/users-server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard — OBELIKS APPS",
  description: "MVP dashboard integrasi RPS berbasis peran.",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError) throw new Error("Sesi pengguna tidak dapat diverifikasi.");
  if (!user) redirect("/");

  const [profileResult, platformRoleResult, roleAssignmentsResult] = await Promise.all([
    supabase.from("profiles").select("display_name,status").eq("id", user.id).maybeSingle(),
    supabase.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
    supabase.from("user_role_assignments").select("role").eq("user_id", user.id),
  ]);
  if (profileResult.error || platformRoleResult.error || roleAssignmentsResult.error) {
    throw new Error("Konteks akses pengguna tidak dapat dimuat.");
  }

  const profile = profileResult.data;
  const platformRole = platformRoleResult.data;
  const roleAssignments = roleAssignmentsResult.data;

  const isSuperadmin = platformRole?.role === "superadmin";
  const assignedRoleSet = new Set((roleAssignments ?? []).map(({ role }) => role));
  const assignedRoles = (["kaprodi", "gpm", "dosen", "mahasiswa"] as const)
    .filter((role) => assignedRoleSet.has(role));
  const availableRoles: RoleId[] = isSuperadmin ? ["admin"] : [...new Set(assignedRoles)];

  if (profile?.status !== "active" || !availableRoles.length) {
    redirect("/");
  }

  let managedUsers: ManagedUser[] = [];
  let impersonatedUser: ImpersonatedUserView | null = null;

  if (isSuperadmin) {
    const admin = getSupabaseAdmin();
    const organization = await getManagedOrganization(admin);
    managedUsers = await loadManagedUsers(admin, user.id, organization.id);

    const cookieStore = await cookies();
    const targetUserId = cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
    if (targetUserId) {
      try {
        const target = await getManagedTarget(admin, targetUserId, organization.id);
        const targetRoles = (["kaprodi", "gpm", "dosen", "mahasiswa"] as const)
          .filter((role) => target.roles.includes(role));
        if (!target.isSuperadmin && target.profile.status === "active" && targetRoles.length) {
          impersonatedUser = {
            id: targetUserId,
            name: target.profile.display_name?.trim() || "Pengguna",
            email: (target.profile.email || target.authUser.email || "").trim().toLowerCase(),
            roles: [...targetRoles],
          };
        }
      } catch (error) {
        console.error("Stored impersonation target could not be resolved", error instanceof Error ? error.message : "unknown_error");
      }
    }
  }

  const email = user.email ?? "superadmin@obeliks.app";
  const effectiveRoles: RoleId[] = impersonatedUser ? [...impersonatedUser.roles] : availableRoles;
  const effectiveDisplayName = impersonatedUser?.name ?? profile.display_name;
  const effectiveEmail = impersonatedUser?.email ?? email;

  return (
    <>
      <DashboardApp
        availableRoles={effectiveRoles}
        displayName={effectiveDisplayName}
        email={effectiveEmail}
        initialManagedUsers={impersonatedUser ? [] : managedUsers}
        initialRole={effectiveRoles[0]}
        signOutAction={signOut}
      />
      <DashboardShellControls displayName={effectiveDisplayName} email={effectiveEmail} />
      <InstitutionPeriodPanel initialRole={effectiveRoles[0]} />
      {isSuperadmin && !impersonatedUser ? <UserAccessControls initialUsers={managedUsers} /> : null}
      {isSuperadmin && !impersonatedUser ? <UserAccessEnhancements users={managedUsers} /> : null}
      {impersonatedUser ? <ImpersonationBanner target={impersonatedUser} /> : null}
    </>
  );
}
