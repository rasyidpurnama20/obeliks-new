import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "./actions";
import { DashboardApp } from "./dashboard-app";
import type { ManagedUser } from "@/lib/admin/user-types";
import type { RoleId } from "@/lib/mvp/types";
import { getManagedOrganization, loadManagedUsers } from "@/lib/admin/users-server";
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
  if (isSuperadmin) {
    const admin = getSupabaseAdmin();
    const organization = await getManagedOrganization(admin);
    managedUsers = await loadManagedUsers(admin, user.id, organization.id);
  }

  return (
    <DashboardApp
      availableRoles={availableRoles}
      displayName={profile.display_name}
      email={user.email ?? "superadmin@obeliks.app"}
      initialManagedUsers={managedUsers}
      initialRole={availableRoles[0]}
      signOutAction={signOut}
    />
  );
}
