import type { AssignableRole } from "./user-types";

export const IMPERSONATION_COOKIE = "obeliks_support_impersonation";
export const IMPERSONATION_MAX_AGE_SECONDS = 30 * 60;

export type ImpersonatedUserView = {
  id: string;
  name: string;
  email: string;
  roles: AssignableRole[];
};
