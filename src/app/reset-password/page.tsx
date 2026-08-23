"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseBrowserEnv } from "@/lib/supabase/client";
import { completeBootstrapPasswordChange } from "./actions";

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 3 18 18" />
      <path d="M10.6 10.7a2 2 0 0 0 2.7 2.7" />
      <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5.5 0 9 5.2 9 5.2a15.5 15.5 0 0 1-2.1 2.7" />
      <path d="M6.6 6.6A15.6 15.6 0 0 0 3 9.2S6.5 14.4 12 14.4c.8 0 1.6-.1 2.3-.3" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12s3.5-5.2 9-5.2 9 5.2 9 5.2-3.5 5.2-9 5.2S3 12 3 12Z" />
      <circle cx="12" cy="12" r="2.4" />
    </svg>
  );
}

function getNewPasswordError(password: string) {
  if (!password) return "Kata sandi baru wajib diisi.";
  if (password.length < 12) return "Gunakan minimal 12 karakter.";
  if (password.length > 128) return "Kata sandi terlalu panjang.";
  if (password !== password.trim()) return "Hapus spasi di awal atau akhir.";
  if (!/[a-z]/.test(password)) return "Tambahkan huruf kecil.";
  if (!/[A-Z]/.test(password)) return "Tambahkan huruf kapital.";
  if (!/\d/.test(password)) return "Tambahkan angka.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Tambahkan simbol.";
  return "";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(
    () => hasSupabaseBrowserEnv()
      ? createClient({ detectSessionInUrl: false, isSingleton: false })
      : null,
    [],
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
    async function initializeSession() {
      if (!supabase) {
        setMessage("Konfigurasi login belum tersedia pada deployment ini.");
        return;
      }

      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragment.get("access_token");
      const refreshToken = fragment.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (error) {
          setMessage("Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.");
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMessage("Buka halaman ini melalui tautan undangan, pemulihan email, atau login pertama Custom User.");
        return;
      }

      setIsSessionReady(true);
    }

    void initializeSession();
  }, [supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Konfigurasi login belum tersedia pada deployment ini.");
      return;
    }
    const validationError = getNewPasswordError(password);

    if (validationError) {
      setMessage(validationError);
      return;
    }
    if (password !== confirmation) {
      setMessage("Konfirmasi kata sandi belum sama.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });

    if (error) {
      setMessage("Kata sandi belum dapat diperbarui. Coba lagi atau minta tautan baru.");
      setIsLoading(false);
      return;
    }

    const finalization = await completeBootstrapPasswordChange();
    if (!finalization.ok) {
      setMessage(finalization.message);
      setIsLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="reset-title">
        <h1 id="reset-title">BUAT KATA SANDI</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="new-password">Kata sandi baru</label>
            <div className="password-field">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={password}
                disabled={isLoading || !isSessionReady}
                aria-describedby="reset-message"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setMessage("");
                }}
              />
              <button
                className="password-toggle"
                type="button"
                disabled={isLoading || !isSessionReady}
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <EyeIcon hidden={showPassword} />
              </button>
            </div>
          </div>

          <div className="field-group">
            <label htmlFor="confirm-password">Ulangi kata sandi</label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              maxLength={128}
              value={confirmation}
              disabled={isLoading || !isSessionReady}
              aria-describedby="reset-message"
              onChange={(event) => {
                setConfirmation(event.target.value);
                setMessage("");
              }}
            />
          </div>

          <p id="reset-message" className="login-message error" role="alert" aria-live="polite">
            {message}
          </p>

          <button className="submit-button" type="submit" disabled={isLoading || !isSessionReady}>
            {isLoading ? "Menyimpan..." : isSessionReady ? "Simpan kata sandi" : "Memeriksa sesi..."}
          </button>
        </form>
      </section>
    </main>
  );
}
