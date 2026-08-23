import {
  assignableRoles,
  type AssignableRole,
  type ManagedUserDraft,
  type ManagedUserUpdate,
} from "./user-types.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const assignableRoleSet = new Set<string>(assignableRoles);

export class ManagedUserInputError extends Error {
  readonly fieldErrors: Partial<Record<"displayName" | "email" | "roles" | "confirmation", string>>;

  constructor(
    message: string,
    fieldErrors: Partial<Record<"displayName" | "email" | "roles" | "confirmation", string>> = {},
  ) {
    super(message);
    this.fieldErrors = fieldErrors;
  }
}

function assertPlainObject(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ManagedUserInputError("Data akun tidak valid.");
  }
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const unknownKeys = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknownKeys.length) throw new ManagedUserInputError("Data akun memuat field yang tidak diizinkan.");
}

export function normalizeManagedEmail(value: unknown): string {
  if (typeof value !== "string") {
    throw new ManagedUserInputError("Email wajib diisi.", { email: "Email wajib diisi." });
  }
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw new ManagedUserInputError("Format email belum valid.", { email: "Gunakan alamat email yang valid." });
  }
  return email;
}

export function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") {
    throw new ManagedUserInputError("Nama wajib diisi.", { displayName: "Nama wajib diisi." });
  }
  const displayName = value.trim().replace(/\s+/g, " ");
  if (displayName.length < 2 || displayName.length > 120) {
    throw new ManagedUserInputError("Nama harus berisi 2–120 karakter.", {
      displayName: "Nama harus berisi 2–120 karakter.",
    });
  }
  return displayName;
}

export function normalizeAssignableRoles(value: unknown): AssignableRole[] {
  if (!Array.isArray(value)) {
    throw new ManagedUserInputError("Pilih minimal satu peran.", { roles: "Pilih minimal satu peran." });
  }
  const roles = [...new Set(value)];
  if (!roles.length || roles.some((role) => typeof role !== "string" || !assignableRoleSet.has(role))) {
    throw new ManagedUserInputError("Peran akun tidak valid.", {
      roles: "Pilih minimal satu peran aplikasi yang tersedia.",
    });
  }
  return assignableRoles.filter((role) => roles.includes(role));
}

export function normalizeUserId(value: unknown): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new ManagedUserInputError("Identitas akun tidak valid.");
  }
  return value.toLowerCase();
}

export function parseManagedUserDraft(value: unknown): ManagedUserDraft {
  assertPlainObject(value);
  assertOnlyKeys(value, ["displayName", "email", "roles"]);
  return {
    displayName: normalizeDisplayName(value.displayName),
    email: normalizeManagedEmail(value.email),
    roles: normalizeAssignableRoles(value.roles),
  };
}

export function parseManagedUserUpdate(value: unknown): ManagedUserUpdate {
  assertPlainObject(value);
  assertOnlyKeys(value, ["userId", "displayName", "roles"]);
  return {
    userId: normalizeUserId(value.userId),
    displayName: normalizeDisplayName(value.displayName),
    roles: normalizeAssignableRoles(value.roles),
  };
}

export function parseStatusCommand(value: unknown): { userId: string; status: "active" | "suspended" } {
  assertPlainObject(value);
  assertOnlyKeys(value, ["userId", "status"]);
  if (value.status !== "active" && value.status !== "suspended") {
    throw new ManagedUserInputError("Status akun tidak valid.");
  }
  return { userId: normalizeUserId(value.userId), status: value.status };
}

export function parseArchiveCommand(value: unknown): { userId: string; confirmation: string } {
  assertPlainObject(value);
  assertOnlyKeys(value, ["userId", "confirmation"]);
  if (typeof value.confirmation !== "string") {
    throw new ManagedUserInputError("Konfirmasi email wajib diisi.", {
      confirmation: "Ketik email akun untuk mengarsipkan.",
    });
  }
  return { userId: normalizeUserId(value.userId), confirmation: value.confirmation.trim().toLowerCase() };
}

export function assertMutableTarget(input: {
  actorUserId: string;
  targetUserId: string;
  targetIsSuperadmin: boolean;
}) {
  if (input.actorUserId === input.targetUserId) {
    throw new ManagedUserInputError("Akun sendiri tidak dapat diubah melalui panel ini.");
  }
  if (input.targetIsSuperadmin) {
    throw new ManagedUserInputError("Akun platform Admin dilindungi dan tidak dapat diubah di panel pengguna.");
  }
}

export function initialsForManagedUser(displayName: string, email: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
  if (parts[0]) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}
