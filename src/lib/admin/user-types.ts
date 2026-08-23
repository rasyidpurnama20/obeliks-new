import type { RoleId } from "@/lib/mvp/types";

export const assignableRoles = ["kaprodi", "gpm", "dosen", "mahasiswa"] as const;

export type AssignableRole = (typeof assignableRoles)[number];
export type ManagedAccountStatus = "invited" | "active" | "suspended" | "archived";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  roles: RoleId[];
  legacyMembershipRole: "owner" | "admin" | "reviewer" | "lecturer" | null;
  status: ManagedAccountStatus;
  emailConfirmed: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  protected: boolean;
  isSelf: boolean;
}

export interface ManagedUserDraft {
  displayName: string;
  email: string;
  roles: AssignableRole[];
}

export interface ManagedUserUpdate {
  userId: string;
  displayName: string;
  roles: AssignableRole[];
}

export type ManagedUserActionResult =
  | {
      ok: true;
      message: string;
      users: ManagedUser[] | null;
      refreshRequired?: boolean;
    }
  | {
      ok: false;
      message: string;
      fieldErrors?: Partial<Record<"displayName" | "email" | "roles" | "confirmation", string>>;
    };
