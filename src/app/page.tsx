import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    if (user.user_metadata?.must_change_password === true) {
      redirect("/reset-password?required=1");
    }

    const [profileResult, platformRoleResult, roleAssignmentsResult] = await Promise.all([
      supabase.from("profiles").select("status").eq("id", user.id).maybeSingle(),
      supabase.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
      supabase.from("user_role_assignments").select("role").eq("user_id", user.id),
    ]);
    const hasAccess = profileResult.data?.status === "active"
      && (platformRoleResult.data?.role === "superadmin" || (roleAssignmentsResult.data?.length ?? 0) > 0);
    if (hasAccess) redirect("/dashboard");
  }

  return <LoginForm />;
}
