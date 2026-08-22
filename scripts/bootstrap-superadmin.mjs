import { createClient } from "@supabase/supabase-js";
import { normalizeProductionSiteUrl } from "./site-url.mjs";

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const siteUrlInput = process.env.SITE_URL?.trim();
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  throw new Error("SUPERADMIN_EMAIL must contain a valid email address.");
}
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const siteUrl = normalizeProductionSiteUrl(siteUrlInput);

const redirectUrl = new URL("/reset-password", siteUrl);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserByEmail(targetEmail) {
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === targetEmail);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }
}

let user = await findUserByEmail(email);
let invitationSent = false;

if (!user) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectUrl.toString(),
    data: { display_name: "Superadmin" },
  });
  if (error) throw error;
  user = data.user;
  invitationSent = true;
}

if (!user) throw new Error("Supabase did not return a user after the invitation.");

const { error: profileError } = await supabase.from("profiles").upsert({
  id: user.id,
  email,
  display_name: user.user_metadata?.display_name ?? "Superadmin",
  status: "active",
  created_by: user.id,
});
if (profileError) throw profileError;

const { error: roleError } = await supabase.from("platform_roles").upsert({
  user_id: user.id,
  role: "superadmin",
  granted_by: user.id,
});
if (roleError) throw roleError;

const { error: auditError } = await supabase.from("audit_logs").insert({
  actor_user_id: user.id,
  target_user_id: user.id,
  action: "platform.superadmin_bootstrapped",
  metadata: { source: "github-actions", invitation_sent: invitationSent },
});
if (auditError) throw auditError;

console.log(
  invitationSent
    ? `Superadmin ${email} is ready. Check the invitation email.`
    : `Existing user ${email} is now an active superadmin. Use password recovery if needed.`,
);
