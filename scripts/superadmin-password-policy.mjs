export function validateInitialPassword(input) {
  if (!input) throw new Error("SUPERADMIN_INITIAL_PASSWORD is required.");
  if (input.length < 12) {
    throw new Error("SUPERADMIN_INITIAL_PASSWORD must contain at least 12 characters.");
  }
  if (input.length > 128) {
    throw new Error("SUPERADMIN_INITIAL_PASSWORD must contain at most 128 characters.");
  }
  if (input !== input.trim()) {
    throw new Error("SUPERADMIN_INITIAL_PASSWORD must not start or end with whitespace.");
  }
  if (/[\u0000-\u001f\u007f]/.test(input)) {
    throw new Error("SUPERADMIN_INITIAL_PASSWORD must not contain control characters.");
  }

  return input;
}
