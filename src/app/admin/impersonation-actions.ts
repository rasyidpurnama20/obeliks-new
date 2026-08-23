"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeUserId } from "@/lib/admin/user-policy";
import { getManagedOrganization, getManagedTarget } from "@/lib/admin/users-server";
import { IMPERSONATION_COOKIE, IMPERSONATION_MAX_AGE_SECONDS } from "@/lib/admin/impersonation";

export type ImpersonationActionResult = {
  ok: boolean;
  message: string;
};

class ImpersonationActionError extends Error {}

async function requireActiveSuperadmin() {
  const sessionClient = await createClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) throw new ImpersonationActionError("Sesi Superadmin telah berakhir. Silakan masuk kembali.");

  const [{ data: profile }, { data: platformRole }] = await Promise.all([
    sessionClient.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    sessionClient.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profile?.status !== "active" || platformRole?.role !== "superadmin") {
    throw new ImpersonationActionError("Hanya Superadmin aktif yang dapat memakai mode impersonasi.");
  }

  return { actorUserId: user.id, admin: getSupabaseAdmin() };
}

function failure(error: unknown, fallbackMessage: string): ImpersonationActionResult {
  if (error instanceof ImpersonationActionError) return { ok: false, message: error.message };
  console.error("Support impersonation action failed", error instanceof Error ? error.message : "unknown_error");
  return { ok: false, message: fallbackMessage };
}

export async function startSupportImpersonation(input: unknown): Promise<ImpersonationActionResult> {
  try {
    const targetUserId = normalizeUserId(input);
    const { actorUserId, admin } = await requireActiveSuperadmin();
    const organization = await getManagedOrganization(admin);
    const target = await getManagedTarget(admin, targetUserId, organization.id);

    if (targetUserId === actorUserId || target.isSuperadmin) {
      throw new ImpersonationActionError("Akun Superadmin tidak dapat menjadi target impersonasi.");
    }
    if (target.profile.status !== "active") {
      throw new ImpersonationActionError("Hanya akun aktif yang dapat dilihat melalui impersonasi.");
    }
    if (!target.roles.length) {
      throw new ImpersonationActionError("Akun ini belum memiliki peran aplikasi yang dapat ditampilkan.");
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_user_id: actorUserId,
      target_user_id: targetUserId,
      action: "account.impersonation_started",
      metadata: {
        organization_id: organization.id,
        mode: "read_only_support_view",
        roles: target.roles,
        expires_in_seconds: IMPERSONATION_MAX_AGE_SECONDS,
      },
    });
    if (auditError) {
      throw new ImpersonationActionError("Impersonasi tidak dimulai karena audit belum dapat dicatat.");
    }

    const cookieStore = await cookies();
    cookieStore.set(IMPERSONATION_COOKIE, targetUserId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      maxAge: IMPERSONATION_MAX_AGE_SECONDS,
    });

    revalidatePath("/admin");
    return {
      ok: true,
      message: "Mode impersonasi dimulai. Sesi login tetap milik Superadmin dan tampilan memakai peran akun target.",
    };
  } catch (error) {
    return failure(error, "Mode impersonasi tidak dapat dimulai. Tidak ada sesi pengguna yang diambil alih.");
  }
}

export async function stopSupportImpersonation(): Promise<ImpersonationActionResult> {
  try {
    const { actorUserId, admin } = await requireActiveSuperadmin();
    const cookieStore = await cookies();
    const targetUserId = cookieStore.get(IMPERSONATION_COOKIE)?.value ?? null;
    let auditWarning = false;

    if (targetUserId) {
      try {
        const organization = await getManagedOrganization(admin);
        const { error: auditError } = await admin.from("audit_logs").insert({
          actor_user_id: actorUserId,
          target_user_id: targetUserId,
          action: "account.impersonation_ended",
          metadata: {
            organization_id: organization.id,
            mode: "read_only_support_view",
          },
        });
        auditWarning = Boolean(auditError);
        if (auditError) console.error("Impersonation end audit failed", auditError.message);
      } catch (auditError) {
        auditWarning = true;
        console.error("Impersonation end audit failed", auditError instanceof Error ? auditError.message : "unknown_error");
      }
    }

    // The impersonation cookie is scoped to /admin. Clearing it with the same
    // path is required; a name-only delete may emit a Path=/ tombstone and
    // leave the original /admin cookie active in the browser.
    cookieStore.set(IMPERSONATION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      maxAge: 0,
      expires: new Date(0),
    });

    revalidatePath("/admin");
    return {
      ok: true,
      message: auditWarning
        ? "Mode impersonasi dihentikan. Audit penutupan perlu ditinjau oleh administrator sistem."
        : "Mode impersonasi dihentikan dan Anda kembali sebagai Superadmin.",
    };
  } catch (error) {
    return failure(error, "Mode impersonasi tidak dapat dihentikan. Muat ulang lalu coba kembali sebagai Superadmin.");
  }
}
