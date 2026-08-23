"use server";

import { createClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type BootstrapPasswordResult = {
  ok: boolean;
  message: string;
};

export async function completeBootstrapPasswordChange(): Promise<BootstrapPasswordResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, message: "Sesi tidak dapat diverifikasi. Silakan login kembali." };
  }

  if (user.app_metadata?.bootstrap_password !== true) {
    return { ok: true, message: "Tidak ada password awal yang perlu difinalisasi." };
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...user.app_metadata,
      bootstrap_password: false,
    },
  });

  if (error) {
    console.error("Bootstrap password finalization failed", error.message);
    return { ok: false, message: "Password sudah diperbarui, tetapi finalisasi akun belum berhasil. Coba lagi." };
  }

  return { ok: true, message: "Password awal sudah diganti." };
}
