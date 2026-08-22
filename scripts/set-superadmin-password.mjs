import { createClient } from "@supabase/supabase-js";
import { validateInitialPassword } from "./superadmin-password-policy.mjs";

const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
const password = validateInitialPassword(process.env.SUPERADMIN_INITIAL_PASSWORD);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  throw new Error("SUPERADMIN_EMAIL must contain a valid email address.");
}
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

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
let accountCreated = false;

if (user) {
  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Superadmin" },
  });
  if (error) throw error;
  user = data.user;
  accountCreated = true;
}

if (!user) throw new Error("Supabase did not return a superadmin user.");

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
  action: "platform.superadmin_password_set",
  metadata: { source: "github-actions", account_created: accountCreated },
});
if (auditError) throw auditError;

console.log(
  `Superadmin ${email} is active and its password has been set. Delete the one-time password secret now.`,
);
