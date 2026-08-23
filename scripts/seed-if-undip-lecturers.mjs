import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  buildLecturerSeedPlan,
  findExistingLecturerUser,
  parseLecturerEmailMap,
  validateIfUndipSnapshot,
  validateLecturerInitialPassword,
} from "./if-undip-seed-policy.mjs";

const snapshotPath = fileURLToPath(
  new URL("../data/if-undip/public-snapshot.json", import.meta.url),
);
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const { lecturers } = validateIfUndipSnapshot(snapshot);
const emailMap = parseLecturerEmailMap(
  process.env.LECTURER_EMAIL_MAP_JSON,
  lecturers,
  process.env.LECTURER_ALLOWED_EMAIL_DOMAIN_SUFFIX ?? "undip.ac.id",
);
const plan = buildLecturerSeedPlan(lecturers, emailMap);
const apply = process.env.LECTURER_SEED_APPLY === "true";

if (!apply) {
  console.log(
    `Validated ${plan.length} IF UNDIP lecturer accounts. No remote changes were made.`,
  );
  process.exit(0);
}

if (process.env.LECTURER_EMAILS_CONFIRMED !== "true") {
  throw new Error(
    "LECTURER_EMAILS_CONFIRMED must be true after an administrator verifies all current mailbox owners.",
  );
}

const password = validateLecturerInitialPassword(
  process.env.LECTURER_INITIAL_PASSWORD,
);
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const organizationSlug = process.env.LECTURER_ORGANIZATION_SLUG?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in apply mode.");
}
if (!organizationSlug) {
  throw new Error("LECTURER_ORGANIZATION_SLUG is required in apply mode.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: organization, error: organizationError } = await supabase
  .from("organizations")
  .select("id,slug")
  .eq("slug", organizationSlug)
  .maybeSingle();

if (organizationError) throw organizationError;
if (!organization) {
  throw new Error(`Organization ${organizationSlug} does not exist. Create it before provisioning accounts.`);
}

const counts = { created: 0, existing: 0, failed: 0 };
const existingUsers = await listAllUsers();

for (const account of plan) {
  try {
    let user = findExistingLecturerUser(existingUsers, account);
    let created = false;

    if (user) {
      await ensureOnboardingState(user, account);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: account.email,
        password,
        // The account is both unconfirmed and explicitly banned. A shared
        // initial password alone can therefore never claim this identity.
        email_confirm: false,
        ban_duration: "876000h",
        user_metadata: { display_name: account.displayName },
        app_metadata: {
          onboarding_required: true,
          lecturer_group: account.lecturerGroup,
          source_external_id: account.externalId,
          source_system: account.source,
        },
      });
      if (error) throw error;
      user = data.user;
      created = true;
      if (user) existingUsers.push(user);
      await ensureOnboardingState(user, account);
    }

    counts[created ? "created" : "existing"] += 1;
  } catch (error) {
    counts.failed += 1;
    console.error(
      `Lecturer NIP ${account.externalId} failed: ${redactError(error)}`,
    );
  }
}

console.log(
  `Lecturer onboarding finished: ${counts.created} created, ${counts.existing} existing, ${counts.failed} failed.`,
);

if (counts.failed) {
  throw new Error("One or more lecturer accounts failed. No passwords or email addresses were printed.");
}

async function listAllUsers() {
  const users = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) return users;
  }
}

async function ensureOnboardingState(user, account) {
  if (!user) throw new Error("Supabase did not return a lecturer user.");

  // Never reset, re-ban, or re-suspend an identity after onboarding has been
  // completed. The activation flow must atomically clear this metadata flag.
  if (user.app_metadata?.onboarding_required !== true) return;

  const authUpdate = { ban_duration: "876000h" };
  if (user.email?.trim().toLowerCase() !== account.email) {
    authUpdate.email = account.email;
    authUpdate.email_confirm = false;
  }
  const { data: updatedAuth, error: authError } =
    await supabase.auth.admin.updateUserById(user.id, authUpdate);
  if (authError) throw authError;
  user = updatedAuth.user ?? user;

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    email: account.email,
    display_name: account.displayName,
    status: "suspended",
  });
  if (profileError) throw profileError;

  const auditAction = "organization.lecturer_onboarding_created";
  const { data: existingAudit, error: auditReadError } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("target_user_id", user.id)
    .eq("action", auditAction)
    .contains("metadata", { source_external_id: account.externalId })
    .limit(1)
    .maybeSingle();
  if (auditReadError) throw auditReadError;

  if (!existingAudit) {
    const { error: auditError } = await supabase.from("audit_logs").insert({
      target_user_id: user.id,
      action: auditAction,
      metadata: {
        organization_id: organization.id,
        organization_slug: organization.slug,
        source_external_id: account.externalId,
        lecturer_group: account.lecturerGroup,
        membership_granted: false,
      },
    });
    if (auditError) throw auditError;
  }
}

function redactError(error) {
  const raw = error instanceof Error ? error.message : "Unknown provisioning error";
  return raw
    .replaceAll(password, "<redacted-secret>")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "<redacted-email>")
    .slice(0, 300);
}
