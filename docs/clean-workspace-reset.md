# Clean workspace reset contract

This change intentionally resets OBELIKS domain data to a blank state while preserving the two current authentication identities shown in **Pengguna & Akses**.

## Preserved
- `auth.users` (guarded: must be exactly 2 at migration time)
- `profiles`
- `platform_roles`
- `user_role_assignments`
- technical organization `informatika-undip`, required by account management

## Cleared
- RPS documents, parser jobs/chunks, courses
- academic programs, curricula, PLO/CLO data, periods/stages, classes/lecturers
- legacy organization membership and audit/domain history
- additional organizations

The reset migration aborts before destructive work if the number of auth users is not exactly two or the technical organization is missing.

## UI source references
- Curriculum Inspector is adapted from the supplied `rps-obe-level3.html` concept.
- Penyusunan RPS Inspector is adapted from the supplied `rps-obe-level2.html` concept.
- Evaluasi RPS Inspector is adapted from the supplied `rps-obe-level4-fixed.html` concept.

No sample academic/RPS records are inserted by this change. Empty states remain empty until real data is entered.
