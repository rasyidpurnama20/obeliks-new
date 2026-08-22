import { redirect } from "next/navigation";
import { signOut } from "./actions";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const [{ data: profile }, { data: platformRole }] = await Promise.all([
    supabase.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    supabase.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profile?.status !== "active" || platformRole?.role !== "superadmin") {
    redirect("/");
  }

  return (
    <main className="admin-page">
      <section className="admin-shell">
        <div>
          <p className="admin-eyebrow">OBELIKS APPS</p>
          <h1>Superadmin aktif</h1>
          <p>{user.email}</p>
        </div>
        <p className="admin-note">Ruang superadmin siap dirancang pada tahap UI berikutnya.</p>
        <form action={signOut}>
          <button className="secondary-button" type="submit">Keluar</button>
        </form>
      </section>
    </main>
  );
}
