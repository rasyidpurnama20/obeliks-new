import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export class AccessError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
  }
}

export async function authenticateRequest(request: Request): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new AccessError("authentication_required", 401);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new AccessError("invalid_access_token", 401);

  return { supabase, user: data.user };
}

export async function assertOrganizationMember(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new AccessError("forbidden", 403);
}

