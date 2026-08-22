import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { signOut } from "./actions";
import { DashboardApp } from "./dashboard-app";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Dashboard — OBELIKS APPS",
  description: "MVP dashboard integrasi RPS berbasis peran.",
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [{ data: profile }, { data: platformRole }] = await Promise.all([
    supabase.from("profiles").select("display_name,status").eq("id", user.id).maybeSingle(),
    supabase.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profile?.status !== "active" || platformRole?.role !== "superadmin") {
    redirect("/");
  }

  return (
    <DashboardApp
      displayName={profile.display_name}
      email={user.email ?? "superadmin@obeliks.app"}
      signOutAction={signOut}
    />
  );
}
