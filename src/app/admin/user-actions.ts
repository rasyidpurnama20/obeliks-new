"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  ManagedUserInputError,
  assertMutableTarget,
  normalizeUserId,
  parseArchiveCommand,
  parseManagedUserDraft,
  parseManagedUserUpdate,
  parseStatusCommand,
} from "@/lib/admin/user-policy";
import {
  getManagedOrganization,
  getManagedTarget,
  loadManagedUsers,
} from "@/lib/admin/users-server";
import type {
  AssignableRole,
  ManagedAccountStatus,
  ManagedUserActionResult,
} from "@/lib/admin/user-types";

const PERMANENT_BAN_DURATION = "876000h";

class AdminActionError extends Error {}

async function requireActiveSuperadmin() {
  const sessionClient = await createClient();
  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) throw new AdminActionError("Sesi Admin telah berakhir. Silakan masuk kembali.");

  const [{ data: profile }, { data: platformRole }] = await Promise.all([
    sessionClient.from("profiles").select("status").eq("id", user.id).maybeSingle(),
    sessionClient.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  if (profile?.status !== "active" || platformRole?.role !== "superadmin") {
    throw new AdminActionError("Anda tidak memiliki izin untuk mengelola akun pengguna.");
  }

  // The service-role client is intentionally created only after the real
  // cookie session, active profile, and platform role have all been verified.
  return { actorUserId: user.id, admin: getSupabaseAdmin() };
}

async function applicationOrigin(): Promise<string> {
  const headerStore = await headers();
  const forwardedProto = headerStore.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = headerStore.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headerStore.get("host")?.trim();
  const configured = process.env.NEXT_PUBLIC_SITE_URL
    || process.env.SITE_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL;
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new AdminActionError("NEXT_PUBLIC_SITE_URL wajib dikonfigurasi sebelum undangan dapat dikirim.");
  }
  const candidate = configured
    ? (/^https?:\/\//i.test(configured) ? configured : `https://${configured}`)
    : host
      ? `${forwardedProto || (host.startsWith("localhost") ? "http" : "https")}://${host}`
      : "";

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AdminActionError("URL aplikasi untuk tautan undangan belum dikonfigurasi.");
  }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new AdminActionError("URL aplikasi untuk tautan undangan tidak valid.");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new AdminActionError("Tautan undangan produksi wajib menggunakan HTTPS.");
  }
  return url.origin;
}

async function applyUserAccess(input: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  actorUserId: string;
  targetUserId: string;
  organizationId: string;
  displayName: string;
  status: ManagedAccountStatus;
  roles: AssignableRole[];
  action: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await input.admin.rpc("admin_apply_user_access", {
    p_actor_user_id: input.actorUserId,
    p_target_user_id: input.targetUserId,
    p_organization_id: input.organizationId,
    p_display_name: input.displayName,
    p_status: input.status,
    p_roles: input.roles,
    p_action: input.action,
    p_metadata: input.metadata ?? {},
  });
  if (error) throw error;
}

async function recordAuthSyncPending(input: {
  admin: ReturnType<typeof getSupabaseAdmin>;
  actorUserId: string;
  targetUserId: string;
  organizationId: string;
  sourceAction: string;
  desiredState: "banned";
}) {
  const { error } = await input.admin.from("audit_logs").insert({
    actor_user_id: input.actorUserId,
    target_user_id: input.targetUserId,
    action: "account.auth_sync_pending",
    metadata: {
      organization_id: input.organizationId,
      source_action: input.sourceAction,
      desired_state: input.desiredState,
    },
  });
  if (error) console.error("Auth sync warning audit append failed", error.message);
}

async function refreshedResult(
  message: string,
  admin: ReturnType<typeof getSupabaseAdmin>,
  actorUserId: string,
  organizationId: string,
): Promise<ManagedUserActionResult> {
  revalidatePath("/admin");
  try {
    return {
      ok: true,
      message,
      users: await loadManagedUsers(admin, actorUserId, organizationId),
    };
  } catch (error) {
    // The mutation has already committed. Never report it as failed merely
    // because the follow-up list query could not be refreshed.
    console.error("Managed user list refresh failed after commit", error instanceof Error ? error.message : "unknown_error");
    return { ok: true, message, users: null, refreshRequired: true };
  }
}

function actionFailure(error: unknown): ManagedUserActionResult {
  if (error instanceof ManagedUserInputError) {
    return { ok: false, message: error.message, fieldErrors: error.fieldErrors };
  }
  if (error instanceof AdminActionError) return { ok: false, message: error.message };

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("already") || message.includes("duplicate") || message.includes("registered")) {
    return { ok: false, message: "Email tersebut sudah terdaftar. Cari dan perbarui akun yang ada." };
  }
  console.error("Managed user action failed", error instanceof Error ? error.message : "unknown_error");
  return { ok: false, message: "Perubahan akun gagal disimpan. Tidak ada hak akses tambahan yang diberikan." };
}

export async function createManagedUser(input: unknown): Promise<ManagedUserActionResult> {
  let invitedUserId: string | null = null;
  let admin: ReturnType<typeof getSupabaseAdmin> | null = null;
  try {
    const draft = parseManagedUserDraft(input);
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
    if (duplicateProfile) throw new AdminActionError("Email tersebut sudah terdaftar. Cari dan perbarui akun yang ada.");

    const origin = await applicationOrigin();
    const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(draft.email, {
      data: { display_name: draft.displayName },
      // Admin invitations are implicit-flow links; their URL fragment must be
      // consumed directly by the reset page and cannot pass through a server redirect.
      redirectTo: `${origin}/reset-password`,
    });
    if (inviteError) throw inviteError;
    if (!data.user) throw new Error("Supabase did not return the invited user.");
    invitedUserId = data.user.id;

    await applyUserAccess({
      admin,
      actorUserId: context.actorUserId,
      targetUserId: data.user.id,
      organizationId: organization.id,
      displayName: draft.displayName,
      status: "invited",
      roles: draft.roles,
      action: "account.invited",
      metadata: { delivery: "supabase_email_invite" },
    });
    invitedUserId = null;

    return await refreshedResult(
      "Undangan dikirim. Pengguna menetapkan kata sandi sendiri melalui email.",
      admin,
      context.actorUserId,
      organization.id,
    );
  } catch (error) {
    // A just-created Auth identity has no academic history. If the database
    // transaction fails, remove it so a retry never leaves an orphan account.
    if (admin && invitedUserId) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(invitedUserId, false);
      if (deleteError) {
        await admin.auth.admin.updateUserById(invitedUserId, { ban_duration: PERMANENT_BAN_DURATION });
      }
    }
    return actionFailure(error);
  }
}

export async function updateManagedUser(input: unknown): Promise<ManagedUserActionResult> {
  try {
    const update = parseManagedUserUpdate(input);
    const { actorUserId, admin } = await requireActiveSuperadmin();
    const organization = await getManagedOrganization(admin);
    const target = await getManagedTarget(admin, update.userId, organization.id);
    assertMutableTarget({ actorUserId, targetUserId: update.userId, targetIsSuperadmin: target.isSuperadmin });
    if (target.profile.status === "archived") throw new AdminActionError("Akun yang sudah diarsipkan tidak dapat diedit.");

    // Profile is the canonical display-name source. Keeping this mutation in
    // the database RPC avoids an unaudited partial change when Auth metadata
    // succeeds but the role/profile transaction is later rejected.
    await applyUserAccess({
      admin,
      actorUserId,
      targetUserId: update.userId,
      organizationId: organization.id,
      displayName: update.displayName,
      status: target.profile.status as ManagedAccountStatus,
      roles: update.roles,
      action: "account.updated",
      metadata: { previous_roles: target.roles },
    });

    return await refreshedResult("Nama dan peran pengguna berhasil diperbarui.", admin, actorUserId, organization.id);
  } catch (error) {
    return actionFailure(error);
  }
}

export async function setManagedUserStatus(input: unknown): Promise<ManagedUserActionResult> {
  try {
    const command = parseStatusCommand(input);
    const { actorUserId, admin } = await requireActiveSuperadmin();
    const organization = await getManagedOrganization(admin);
    const target = await getManagedTarget(admin, command.userId, organization.id);
    assertMutableTarget({ actorUserId, targetUserId: command.userId, targetIsSuperadmin: target.isSuperadmin });
    if (target.profile.status === "archived") throw new AdminActionError("Akun yang sudah diarsipkan tidak dapat diaktifkan kembali dari panel MVP.");
    if (!target.roles.length) throw new AdminActionError("Tetapkan minimal satu peran sebelum mengubah status akun.");

    if (command.status === "active") {
      if (!target.authUser.email_confirmed_at) {
        throw new AdminActionError("Email belum diverifikasi. Minta pengguna menyelesaikan tautan akses terlebih dahulu.");
      }
      const { error: unbanError } = await admin.auth.admin.updateUserById(command.userId, {
        ban_duration: "none",
        app_metadata: { ...target.authUser.app_metadata, onboarding_required: false },
      });
      if (unbanError) throw unbanError;
      try {
        await applyUserAccess({
          admin,
          actorUserId,
          targetUserId: command.userId,
          organizationId: organization.id,
          displayName: target.profile.display_name || "Pengguna",
          status: "active",
          roles: target.roles,
          action: "account.activated",
          metadata: { previous_status: target.profile.status },
        });
      } catch (error) {
        const { error: rebanError } = await admin.auth.admin.updateUserById(command.userId, { ban_duration: PERMANENT_BAN_DURATION });
        if (rebanError) {
          await recordAuthSyncPending({
            admin,
            actorUserId,
            targetUserId: command.userId,
            organizationId: organization.id,
            sourceAction: "account.activation_compensation",
            desiredState: "banned",
          });
        }
        throw error;
      }
      return await refreshedResult("Akun berhasil diaktifkan.", admin, actorUserId, organization.id);
    }

    // Database status changes first so even an already-issued JWT is denied by
    // is_active_user() before the Auth ban is attempted.
    await applyUserAccess({
      admin,
      actorUserId,
      targetUserId: command.userId,
      organizationId: organization.id,
      displayName: target.profile.display_name || "Pengguna",
      status: "suspended",
      roles: target.roles,
      action: "account.suspended",
      metadata: { previous_status: target.profile.status },
    });
    const { error: banError } = await admin.auth.admin.updateUserById(command.userId, {
      ban_duration: PERMANENT_BAN_DURATION,
    });
    if (banError) {
      await recordAuthSyncPending({
        admin,
        actorUserId,
        targetUserId: command.userId,
        organizationId: organization.id,
        sourceAction: "account.suspended",
        desiredState: "banned",
      });
    }
    return await refreshedResult(
      banError
        ? "Akses aplikasi sudah ditangguhkan; sinkronisasi blokir Auth perlu ditinjau pada audit."
        : "Akun ditangguhkan dan sesi lamanya tidak lagi memiliki akses aplikasi.",
      admin,
      actorUserId,
      organization.id,
    );
  } catch (error) {
    return actionFailure(error);
  }
}

export async function archiveManagedUser(input: unknown): Promise<ManagedUserActionResult> {
  try {
    const command = parseArchiveCommand(input);
    const { actorUserId, admin } = await requireActiveSuperadmin();
    const organization = await getManagedOrganization(admin);
    const target = await getManagedTarget(admin, command.userId, organization.id);
    assertMutableTarget({ actorUserId, targetUserId: command.userId, targetIsSuperadmin: target.isSuperadmin });
    if (target.profile.status === "archived") throw new AdminActionError("Akun tersebut sudah diarsipkan.");
    if (command.confirmation !== target.profile.email.trim().toLowerCase()) {
      throw new ManagedUserInputError("Konfirmasi email tidak sama.", {
        confirmation: "Ketik alamat email akun persis seperti yang ditampilkan.",
      });
    }

    await applyUserAccess({
      admin,
      actorUserId,
      targetUserId: command.userId,
      organizationId: organization.id,
      displayName: target.profile.display_name || "Pengguna",
      status: "archived",
      roles: [],
      action: "account.archived",
      metadata: {
        previous_status: target.profile.status,
        previous_roles: target.roles,
        identity_snapshot: { email: target.profile.email, display_name: target.profile.display_name },
      },
    });
    const { error: banError } = await admin.auth.admin.updateUserById(command.userId, {
      ban_duration: PERMANENT_BAN_DURATION,
    });
    if (banError) {
      await recordAuthSyncPending({
        admin,
        actorUserId,
        targetUserId: command.userId,
        organizationId: organization.id,
        sourceAction: "account.archived",
        desiredState: "banned",
      });
    }

    return await refreshedResult(
      banError
        ? "Akun diarsipkan dan akses aplikasi dicabut; sinkronisasi blokir Auth perlu ditinjau pada audit."
        : "Akun diarsipkan, hak akses dicabut, dan riwayat akademik tetap dipertahankan.",
      admin,
      actorUserId,
      organization.id,
    );
  } catch (error) {
    return actionFailure(error);
  }
}

export async function sendManagedUserAccessLink(input: unknown): Promise<ManagedUserActionResult> {
  try {
    const userId = normalizeUserId(input);
    const { actorUserId, admin } = await requireActiveSuperadmin();
    const organization = await getManagedOrganization(admin);
    const target = await getManagedTarget(admin, userId, organization.id);
    assertMutableTarget({ actorUserId, targetUserId: userId, targetIsSuperadmin: target.isSuperadmin });
    if (target.profile.status === "archived") throw new AdminActionError("Akun yang diarsipkan tidak dapat menerima tautan akses.");
    const origin = await applicationOrigin();
    const redirectTo = `${origin}/reset-password`;
    const flow = target.authUser.email_confirmed_at ? "recovery" : "existing_user_magic_link";
    const operationId = randomUUID();

    // A durable request record must exist before any provider side effect.
    // If audit storage is unavailable, the email is deliberately not sent.
    const { error: requestAuditError } = await admin.from("audit_logs").insert({
      actor_user_id: actorUserId,
      target_user_id: userId,
      action: "account.access_link_requested",
      metadata: {
        organization_id: organization.id,
        flow,
        operation_id: operationId,
      },
    });
    if (requestAuditError) {
      throw new AdminActionError("Tautan tidak dikirim karena pencatatan audit belum tersedia. Coba lagi setelah layanan pulih.");
    }

    // Keep application access fail-closed in profiles while allowing the email
    // owner to complete a confirmation or recovery flow.
    if (target.profile.status === "suspended") {
      const { error: unbanError } = await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });
      if (unbanError) throw unbanError;
    }

    const { error: deliveryError } = target.authUser.email_confirmed_at
      ? await admin.auth.resetPasswordForEmail(target.profile.email, { redirectTo })
      : await admin.auth.signInWithOtp({
          email: target.profile.email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: redirectTo,
          },
        });
    if (deliveryError) {
      if (target.profile.status === "suspended") {
        await admin.auth.admin.updateUserById(userId, { ban_duration: PERMANENT_BAN_DURATION });
      }
      const { error: failureAuditError } = await admin.from("audit_logs").insert({
        actor_user_id: actorUserId,
        target_user_id: userId,
        action: "account.access_link_failed",
        metadata: {
          organization_id: organization.id,
          flow,
          operation_id: operationId,
          provider_status: deliveryError.status ?? null,
        },
      });
      if (failureAuditError) console.error("Access-link failure audit append failed", failureAuditError.message);
      throw deliveryError;
    }

    const { error: auditError } = await admin.from("audit_logs").insert({
      actor_user_id: actorUserId,
      target_user_id: userId,
      action: "account.access_link_sent",
      metadata: {
        organization_id: organization.id,
        flow,
        operation_id: operationId,
      },
    });
    if (auditError) console.error("Access-link audit append failed", auditError.message);

    return await refreshedResult(
      target.profile.status === "suspended"
        ? "Tautan akses dikirim; akun tetap ditangguhkan sampai Admin memilih Aktifkan."
        : "Tautan akses dikirim ke email pengguna. Pesan ini tidak menampilkan token atau kata sandi.",
      admin,
      actorUserId,
      organization.id,
    );
  } catch (error) {
    return actionFailure(error);
  }
}
