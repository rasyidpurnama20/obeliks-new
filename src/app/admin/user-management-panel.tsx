"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getRoleDefinition } from "@/lib/mvp/data";
import { assignableRoles, type AssignableRole, type ManagedUser } from "@/lib/admin/user-types";
import {
  archiveManagedUser,
  createManagedUser,
  sendManagedUserAccessLink,
  setManagedUserStatus,
  updateManagedUser,
} from "./user-actions";
import styles from "./dashboard.module.css";

type UserManagementPanelProps = {
  users: ManagedUser[];
  query: string;
  onQueryChange: (value: string) => void;
  onUsersChange: (users: ManagedUser[]) => void;
  notify: (message: string) => void;
};

type EditorState = "create" | string | null;
type FieldErrors = Partial<Record<"displayName" | "email" | "roles" | "confirmation", string>>;

const statusLabels = {
  invited: "Diundang",
  active: "Aktif",
  suspended: "Ditangguhkan",
  archived: "Diarsipkan",
} as const;

const statusTones = {
  invited: "amber",
  active: "green",
  suspended: "red",
  archived: "neutral",
} as const;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "Belum pernah";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

export function UserManagementPanel({
  users,
  query,
  onQueryChange,
  onUsersChange,
  notify,
}: UserManagementPanelProps) {
  const [editor, setEditor] = useState<EditorState>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<AssignableRole[]>(["dosen"]);
  const [statusFilter, setStatusFilter] = useState("current");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteCandidateId, setDeleteCandidateId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const editingUser = editor && editor !== "create" ? users.find((user) => user.id === editor) : null;
  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("id-ID");
    return users.filter((user) => {
      const matchesQuery = `${user.name} ${user.email} ${user.roles.map((role) => getRoleDefinition(role).shortLabel).join(" ")} ${user.legacyMembershipRole ?? ""} ${user.status} ${statusLabels[user.status]}`
        .toLocaleLowerCase("id-ID")
        .includes(normalizedQuery);
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "current" ? user.status !== "archived" : user.status === statusFilter);
      return matchesQuery && matchesStatus;
    });
  }, [query, statusFilter, users]);

  useEffect(() => {
    if (editor) firstInputRef.current?.focus();
  }, [editor]);

  useEffect(() => {
    if (deleteCandidateId) archiveInputRef.current?.focus();
  }, [deleteCandidateId]);

  function openCreate(trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setEditor("create");
    setDisplayName("");
    setEmail("");
    setSelectedRoles(["dosen"]);
    setFieldErrors({});
    setErrorMessage("");
    setDeleteCandidateId(null);
  }

  function openEdit(user: ManagedUser, trigger: HTMLButtonElement) {
    returnFocusRef.current = trigger;
    setEditor(user.id);
    setDisplayName(user.name);
    setEmail(user.email);
    setSelectedRoles(user.roles.filter((role): role is AssignableRole => assignableRoles.includes(role as AssignableRole)));
    setFieldErrors({});
    setErrorMessage("");
    setDeleteCandidateId(null);
  }

  function closeEditor() {
    setEditor(null);
    setFieldErrors({});
    setErrorMessage("");
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }

  function openArchive(userId: string) {
    setEditor(null);
    setDeleteCandidateId(userId);
    setDeleteConfirmation("");
    setFieldErrors({});
    setErrorMessage("");
  }

  function cancelArchive() {
    const candidateId = deleteCandidateId;
    setDeleteCandidateId(null);
    setDeleteConfirmation("");
    setFieldErrors({});
    setErrorMessage("");
    window.requestAnimationFrame(() => {
      document.getElementById(`archive-trigger-${candidateId}`)?.focus();
    });
  }

  function acceptUpdatedUsers(result: { message: string; users: ManagedUser[] | null }) {
    notify(result.message);
    if (!result.users) {
      window.location.reload();
      return false;
    }
    onUsersChange(result.users);
    return true;
  }

  function toggleRole(role: AssignableRole) {
    setSelectedRoles((current) => current.includes(role)
      ? current.filter((item) => item !== role)
      : [...current, role]);
    setFieldErrors((current) => ({ ...current, roles: undefined }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction(editor === "create" ? "create" : `edit:${editor}`);
    setFieldErrors({});
    setErrorMessage("");
    try {
      const result = editor === "create"
        ? await createManagedUser({ displayName, email, roles: selectedRoles })
        : await updateManagedUser({ userId: editor, displayName, roles: selectedRoles });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setErrorMessage(result.message);
        return;
      }
      if (acceptUpdatedUsers(result)) closeEditor();
    } catch {
      setErrorMessage("Koneksi terputus sebelum hasil perubahan dapat dipastikan. Muat ulang sebelum mencoba lagi.");
    } finally {
      setPendingAction(null);
    }
  }

  async function runStatus(user: ManagedUser, status: "active" | "suspended") {
    setPendingAction(`status:${user.id}`);
    setErrorMessage("");
    try {
      const result = await setManagedUserStatus({ userId: user.id, status });
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      acceptUpdatedUsers(result);
    } catch {
      setErrorMessage("Koneksi terputus. Muat ulang daftar untuk memastikan status akun terbaru.");
    } finally {
      setPendingAction(null);
    }
  }

  async function sendAccessLink(user: ManagedUser) {
    setPendingAction(`link:${user.id}`);
    setErrorMessage("");
    try {
      const result = await sendManagedUserAccessLink(user.id);
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }
      acceptUpdatedUsers(result);
    } catch {
      setErrorMessage("Koneksi terputus; status pengiriman tautan belum dapat dipastikan.");
    } finally {
      setPendingAction(null);
    }
  }

  async function archiveUser(user: ManagedUser) {
    setPendingAction(`archive:${user.id}`);
    setFieldErrors({});
    setErrorMessage("");
    try {
      const result = await archiveManagedUser({ userId: user.id, confirmation: deleteConfirmation });
      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setErrorMessage(result.message);
        return;
      }
      if (!acceptUpdatedUsers(result)) return;
      setDeleteCandidateId(null);
      setDeleteConfirmation("");
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    } catch {
      setErrorMessage("Koneksi terputus. Muat ulang daftar untuk memastikan akun sudah diarsipkan atau belum.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Identitas & otorisasi</p>
          <h1 tabIndex={-1}>Pengguna & Akses</h1>
          <p className={styles.pageDescription}>Kelola akun nyata melalui undangan email. Peran dapat digabung; penugasan mata kuliah tetap proses terpisah.</p>
        </div>
        <div className={styles.headingAction}>
          <button className={styles.primaryButton} disabled={Boolean(pendingAction) || Boolean(deleteCandidateId)} onClick={(event) => openCreate(event.currentTarget)} type="button">
            <span aria-hidden="true">＋</span> Tambah pengguna
          </button>
        </div>
      </div>

      {editor ? (
        <section aria-labelledby="user-editor-title" className={cx(styles.card, styles.userEditor)}>
          <div className={styles.sectionHeading}>
            <div>
              <h2 id="user-editor-title">{editor === "create" ? "Undang pengguna baru" : `Edit ${editingUser?.name ?? "pengguna"}`}</h2>
              <p>{editor === "create" ? "Tidak ada kata sandi default. Pemilik email membuat kata sandinya sendiri." : "Email menjadi identitas tetap pada MVP; ubah nama dan peran tanpa menebak lingkup akademik."}</p>
            </div>
          </div>
          <form aria-busy={Boolean(pendingAction)} noValidate onSubmit={handleSubmit}>
            <div className={styles.userFormGrid}>
              <label className={styles.formField}>
                <span>Nama lengkap</span>
                <input
                  aria-describedby={fieldErrors.displayName ? "display-name-error" : undefined}
                  aria-invalid={Boolean(fieldErrors.displayName)}
                  disabled={Boolean(pendingAction)}
                  maxLength={120}
                  onChange={(event) => {
                    setDisplayName(event.target.value);
                    setFieldErrors((current) => ({ ...current, displayName: undefined }));
                  }}
                  ref={firstInputRef}
                  value={displayName}
                />
                {fieldErrors.displayName ? <small className={styles.formError} id="display-name-error">{fieldErrors.displayName}</small> : null}
              </label>
              <label className={styles.formField}>
                <span>Email</span>
                <input
                  aria-describedby={fieldErrors.email ? "managed-email-error" : editor !== "create" ? "managed-email-help" : undefined}
                  aria-invalid={Boolean(fieldErrors.email)}
                  autoComplete="email"
                  disabled={Boolean(pendingAction) || editor !== "create"}
                  inputMode="email"
                  maxLength={254}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setFieldErrors((current) => ({ ...current, email: undefined }));
                  }}
                  type="email"
                  value={email}
                />
                {editor !== "create" ? <small id="managed-email-help">Perubahan email ditunda agar selalu melalui verifikasi ulang.</small> : null}
                {fieldErrors.email ? <small className={styles.formError} id="managed-email-error">{fieldErrors.email}</small> : null}
              </label>
            </div>
            <fieldset aria-describedby={fieldErrors.roles ? "managed-role-error" : undefined} className={styles.roleFieldset}>
              <legend>Peran aplikasi</legend>
              <div className={styles.roleOptions}>
                {assignableRoles.map((role) => (
                  <label key={role}>
                    <input
                      checked={selectedRoles.includes(role)}
                      disabled={Boolean(pendingAction)}
                      onChange={() => toggleRole(role)}
                      type="checkbox"
                    />
                    <span><strong>{getRoleDefinition(role).shortLabel}</strong><small>{getRoleDefinition(role).description}</small></span>
                  </label>
                ))}
              </div>
              {fieldErrors.roles ? <small className={styles.formError} id="managed-role-error">{fieldErrors.roles}</small> : null}
            </fieldset>
            {errorMessage ? <p className={styles.formErrorBanner} role="alert">{errorMessage}</p> : null}
            <div className={styles.formActions}>
              <button className={styles.secondaryButton} disabled={Boolean(pendingAction)} onClick={closeEditor} type="button">Batal</button>
              <button className={styles.primaryButton} disabled={Boolean(pendingAction)} type="submit">
                {pendingAction ? "Menyimpan…" : editor === "create" ? "Kirim undangan" : "Simpan perubahan"}
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section aria-busy={Boolean(pendingAction)} className={styles.card}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <span aria-hidden="true">⌕</span>
            <span className={styles.srOnly}>Cari pengguna</span>
            <input onChange={(event) => onQueryChange(event.target.value)} placeholder="Cari nama, email, peran, atau status…" ref={searchInputRef} type="search" value={query} />
          </label>
          <label>
            <span className={styles.srOnly}>Filter status akun</span>
            <select aria-label="Filter status akun" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
              <option value="current">Akun saat ini</option>
              <option value="all">Semua status</option>
              <option value="invited">Diundang</option>
              <option value="active">Aktif</option>
              <option value="suspended">Ditangguhkan</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </label>
          <span className={styles.resultCount}>{filteredUsers.length} pengguna</span>
        </div>

        {errorMessage && !editor ? <p className={styles.formErrorBanner} role="alert">{errorMessage}</p> : null}

        <div className={styles.tableWrap}>
          <table className={styles.userTable}>
            <caption className={styles.srOnly}>Daftar akun pengguna OBELIKS</caption>
            <thead>
              <tr><th scope="col">Pengguna</th><th scope="col">Peran</th><th scope="col">Verifikasi</th><th scope="col">Status</th><th scope="col">Terakhir aktif</th><th scope="col"><span className={styles.srOnly}>Tindakan</span></th></tr>
            </thead>
            <tbody>
              {filteredUsers.length ? filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td><div className={styles.userCell}><span aria-hidden="true">{user.initials}</span><div><strong>{user.name}</strong><small>{user.email}</small>{user.isSelf ? <em>Akun Anda</em> : null}</div></div></td>
                  <td><div className={styles.roleChips}>{user.roles.length ? user.roles.map((role) => <span key={role}>{getRoleDefinition(role).shortLabel}</span>) : <small>Belum ada peran</small>}{user.legacyMembershipRole ? <span className={styles.legacyRoleChip}>Akses lama: {user.legacyMembershipRole}</span> : null}</div></td>
                  <td><span className={cx(styles.badge, styles[user.emailConfirmed ? "tone_green" : "tone_amber"])}>{user.emailConfirmed ? "Terverifikasi" : "Menunggu email"}</span></td>
                  <td><span className={cx(styles.badge, styles[`tone_${statusTones[user.status]}`])}>{statusLabels[user.status]}</span></td>
                  <td>{formatDate(user.lastActiveAt)}</td>
                  <td>
                    {user.protected || user.status === "archived" ? (
                      <span className={styles.protectedLabel}>{user.protected ? "Dilindungi" : "Riwayat dipertahankan"}</span>
                    ) : deleteCandidateId === user.id ? (
                      <div
                        aria-labelledby={`archive-title-${user.id}`}
                        className={styles.inlineConfirm}
                        id={`archive-confirm-${user.id}`}
                        role="group"
                      >
                        <strong id={`archive-title-${user.id}`}>Arsipkan akun?</strong>
                        <p id={`archive-help-${user.id}`}>Hak akses dicabut, tetapi RPS dan audit tetap utuh. Ketik <b>{user.email}</b>.</p>
                        <label>
                          <span className={styles.srOnly}>Konfirmasi email {user.name}</span>
                          <input
                            aria-describedby={`${`archive-help-${user.id}`}${fieldErrors.confirmation ? ` archive-error-${user.id}` : ""}`}
                            aria-invalid={Boolean(fieldErrors.confirmation)}
                            disabled={Boolean(pendingAction)}
                            onChange={(event) => {
                              setDeleteConfirmation(event.target.value);
                              setFieldErrors((current) => ({ ...current, confirmation: undefined }));
                            }}
                            ref={archiveInputRef}
                            value={deleteConfirmation}
                          />
                        </label>
                        {fieldErrors.confirmation ? <small className={styles.formError} id={`archive-error-${user.id}`}>{fieldErrors.confirmation}</small> : null}
                        <div><button className={styles.secondaryButton} disabled={Boolean(pendingAction)} onClick={cancelArchive} type="button">Batal</button><button className={styles.dangerButton} disabled={Boolean(pendingAction)} onClick={() => void archiveUser(user)} type="button">Konfirmasi arsip</button></div>
                      </div>
                    ) : (
                      <div className={styles.userActions}>
                        <button aria-label={`Edit ${user.name}`} className={styles.kebabButton} disabled={Boolean(pendingAction) || Boolean(editor) || Boolean(deleteCandidateId)} onClick={(event) => openEdit(user, event.currentTarget)} type="button">Edit</button>
                        {user.status === "active" ? <button aria-label={`Tangguhkan ${user.name}`} className={styles.kebabButton} disabled={Boolean(pendingAction) || Boolean(editor) || Boolean(deleteCandidateId)} onClick={() => void runStatus(user, "suspended")} type="button">Tangguhkan</button> : null}
                        {user.status === "suspended" && user.emailConfirmed ? <button aria-label={`Aktifkan ${user.name}`} className={styles.kebabButton} disabled={Boolean(pendingAction) || Boolean(editor) || Boolean(deleteCandidateId)} onClick={() => void runStatus(user, "active")} type="button">Aktifkan</button> : null}
                        {user.status !== "active" || user.emailConfirmed ? <button aria-label={`${user.emailConfirmed ? "Kirim reset sandi" : "Kirim tautan onboarding"} ke ${user.name}`} className={styles.kebabButton} disabled={Boolean(pendingAction) || Boolean(editor) || Boolean(deleteCandidateId)} onClick={() => void sendAccessLink(user)} type="button">{user.emailConfirmed ? "Reset sandi" : "Tautan onboarding"}</button> : null}
                        <button aria-controls={`archive-confirm-${user.id}`} aria-expanded="false" aria-label={`Arsipkan ${user.name}`} className={styles.dangerButton} disabled={Boolean(pendingAction) || Boolean(editor) || Boolean(deleteCandidateId)} id={`archive-trigger-${user.id}`} onClick={() => openArchive(user.id)} type="button">Arsipkan</button>
                      </div>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td className={styles.emptyState} colSpan={6}>Tidak ada akun yang cocok dengan pencarian dan filter ini.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
