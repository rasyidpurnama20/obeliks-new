"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { ManagedUserInputError, parseManagedUserDraft } from "@/lib/admin/user-policy";
import { getManagedOrganization, loadManagedUsers } from "@/lib/admin/users-server";
import type { ManagedUserActionResult } from "@/lib/admin/user-types";

const DEFAULT_CUSTOM_USER_PASSWORD = "user123";
const PERMANENT_BAN_DURATION = "876000h";

type CustomUserSource = "manual" | "siap";

class CustomUserActionError extends Error {}

async function requireActiveSuperadmin() {
  const sessionClient = await createClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) throw new CustomUserActionError("Sesi Superadmin telah berakhir. Silakan masuk kembali.");

  const [{ data: profile }, { data: platformRole }] = await Promise.all([
    sessionClient.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    sessionClient.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profile?.status !== "active" || platformRole?.role !== "superadmin") {
    throw new CustomUserActionError("Hanya Superadmin aktif yang dapat membuat Custom User.");
  }

  return { actorUserId: user.id, admin: getSupabaseAdmin() };
}

function parseInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ManagedUserInputError("Data akun tidak valid.");
  }
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["draft", "source"].includes(key))) {
    throw new ManagedUserInputError("Data akun memuat field yang tidak diizinkan.");
  }
  if (record.source !== "manual" && record.source !== "siap") {
    throw new ManagedUserInputError("Sumber pembuatan akun tidak valid.");
  }
  const draft = parseManagedUserDraft(record.draft);
  const source = record.source as CustomUserSource;
  if (source === "siap" && (draft.roles.length !== 1 || draft.roles[0] !== "mahasiswa")) {
    throw new ManagedUserInputError("Sinkron SIAP hanya dapat membuat akun Mahasiswa.", {
      roles: "Peran SIAP dikunci ke Mahasiswa.",
    });
  }
  return { draft, source };
}

function failure(error: unknown): ManagedUserActionResult {
  if (error instanceof ManagedUserInputError) {
    return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof CustomUserActionError) return { ok: false, message: error.message };
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("already") || message.includes("duplicate") || message.includes("registered")) {
    return { ok: false, message: "Email tersebut sudah terdaftar. Cari dan perbarui akun yang ada." };
  }
  console.error("Custom user creation failed", error instanceof Error ? error.message : "unknown_error");
  return { ok: false, message: "Custom User gagal dibuat. Tidak ada hak akses tambahan yang diberikan." };
}

export async function createCustomManagedUser(input: unknown): Promise<ManagedUserActionResult> {
  let createdUserId: string | null = null;
  let admin: ReturnType<typeof getSupabaseAdmin> | null = null;

  try {
    const { draft, source } = parseInput(input);
    const context = await requireActiveSuperadmin();
    admin = context.admin;
    const organization = await getManagedOrganization(admin);

    const { data: duplicateProfile, error: duplicateError } = await admin
      .from("profiles")
      .select("id")
      .eq("email", draft.email)
      .limit(1)
      .maybeSingle();
    if (duplicateError) throw duplicateError;
    if (duplicateProfile) throw new CustomUserActionError("Email tersebut sudah terdaftar. Cari dan perbarui akun yang ada.");

    const { data, error: createError } = await admin.auth.admin.createUser({
      email: draft.email,
      password: DEFAULT_CUSTOM_USER_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: draft.displayName,
        must_change_password: true,
      },
      app_metadata: {
        onboarding_source: source,
        bootstrap_password: true,
      },
    });
    if (createError) throw createError;
    if (!data.user) throw new Error("Supabase did not return the created user.");
    createdUserId = data.user.id;

    const { error: accessError } = await admin.rpc("admin_apply_user_access", {
      p_actor_user_id: context.actorUserId,
      p_target_user_id: data.user.id,
      p_organization_id: organization.id,
      p_display_name: draft.displayName,
      p_status: "active",
      p_roles: draft.roles,
      p_action: "account.custom_created",
      p_metadata: {
        source,
        bootstrap_password: true,
        password_change_required: true,
      },
    });
    if (accessError) throw accessError;
    createdUserId = null;

    revalidatePath("/pengguna-akses");
    revalidatePath("/dashboard");
    try {
      return {
        ok: true,
        message: source === "siap"
          ? "Akun Mahasiswa berhasil dibuat dari ekspor SIAP. Password awal user123 dan wajib diganti saat login pertama."
          : "Custom User berhasil dibuat. Password awal user123 dan wajib diganti saat login pertama.",
        users: await loadManagedUsers(admin, context.actorUserId, organization.id),
      };
    } catch (refreshError) {
      console.error("Custom user list refresh failed", refreshError instanceof Error ? refreshError.message : "unknown_error");
      return {
        ok: true,
        message: "Custom User berhasil dibuat. Muat ulang daftar untuk melihat perubahan.",
        users: null,
        refreshRequired: true,
      };
    }
  } catch (error) {
    if (admin && createdUserId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(createdUserId, false);
      if (deleteError) {
        await admin.auth.admin.updateUserById(createdUserId, { ban_duration: PERMANENT_BAN_DURATION });
      }
    }
    return failure(error);
  }
}
