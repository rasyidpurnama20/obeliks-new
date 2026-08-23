"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const MAX_STUDIO_BYTES = 1_500_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SaveResult = { ok: true; message: string } | { ok: false; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function saveRpsStudioData(input: {
  documentId: string;
  state: Record<string, unknown>;
  issues: Array<{ severity: string; title: string; detail: string }>;
}): Promise<SaveResult> {
  try {
    if (!UUID.test(input.documentId)) return { ok: false, message: "ID RPS tidak valid." };
    if (!isObject(input.state)) return { ok: false, message: "Data RPS tidak valid." };
    const serialized = JSON.stringify(input.state);
    if (new TextEncoder().encode(serialized).byteLength > MAX_STUDIO_BYTES) {
      return { ok: false, message: "Data RPS terlalu besar untuk disimpan (maksimal 1,5 MB)." };
    }

    const session = await createClient();
    const { data: { user }, error } = await session.auth.getUser();
    if (error || !user) return { ok: false, message: "Sesi telah berakhir. Silakan masuk kembali." };

    const admin = getSupabaseAdmin();
    const [profileResult, platformResult, assignmentResult, documentResult] = await Promise.all([
      admin.from("profiles").select("status").eq("id", user.id).maybeSingle(),
      admin.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle(),
      admin.from("user_role_assignments").select("organization_id,role").eq("user_id", user.id),
      admin.from("rps_documents").select("id,organization_id,status").eq("id", input.documentId).maybeSingle(),
    ]);
    if (profileResult.error || platformResult.error || assignmentResult.error || documentResult.error) {
      throw profileResult.error ?? platformResult.error ?? assignmentResult.error ?? documentResult.error;
    }
    if (profileResult.data?.status !== "active") return { ok: false, message: "Akun tidak aktif." };
    if (!documentResult.data) return { ok: false, message: "RPS tidak ditemukan." };

    const isSuperadmin = platformResult.data?.role === "superadmin";
    const assignment = (assignmentResult.data ?? []).find((row) => String(row.organization_id) === String(documentResult.data.organization_id));
    const canEdit = isSuperadmin || ["kaprodi", "dosen"].includes(String(assignment?.role));
    if (!canEdit) return { ok: false, message: "Peran aktif tidak memiliki hak mengubah isi RPS ini." };
    if (documentResult.data.status === "approved" && !isSuperadmin) {
      return { ok: false, message: "RPS yang sudah disetujui tidak dapat diubah tanpa membuat versi baru." };
    }

    const sanitizedIssues = input.issues.slice(0, 100).map((issue) => ({
      severity: ["error", "warning", "pass"].includes(issue.severity) ? issue.severity : "warning",
      title: String(issue.title ?? "").slice(0, 180),
      detail: String(issue.detail ?? "").slice(0, 800),
    }));
    const { error: updateError } = await admin
      .from("rps_documents")
      .update({
        structured_data: input.state,
        validation_summary: {
          schema_version: "rps-obe-studio-1",
          generated_at: new Date().toISOString(),
          issue_count: sanitizedIssues.filter((item) => item.severity !== "pass").length,
          issues: sanitizedIssues,
        },
      })
      .eq("id", input.documentId);
    if (updateError) throw updateError;

    revalidatePath("/monitoring-rps");
    revalidatePath("/monitoring-rps/penyusunan");
    revalidatePath("/monitoring-rps/evaluasi");
    return { ok: true, message: "RPS tersimpan." };
  } catch (error) {
    console.error("RPS studio save failed", error instanceof Error ? error.message : "unknown_error");
    return { ok: false, message: "RPS belum dapat disimpan. Muat ulang lalu coba kembali." };
  }
}
