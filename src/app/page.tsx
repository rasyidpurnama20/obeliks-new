"use client";

import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, hasSupabaseBrowserEnv } from "@/lib/supabase/client";

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

function getEmailError(value: string): string {
  const email = value.trim();
  if (!email) return "Email wajib diisi.";
  if (email.length > 254) return "Email terlalu panjang.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Format email belum valid.";
  return "";
}

function getPasswordError(value: string): string {
  if (!value) return "Kata sandi wajib diisi.";
  if (value.length < 8) return "Kata sandi minimal 8 karakter.";
  if (value.length > 128) return "Kata sandi terlalu panjang.";
  if (value !== value.trim()) return "Hapus spasi di awal atau akhir kata sandi.";
  return "";
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(
    () => hasSupabaseBrowserEnv() ? createClient() : null,
    [],
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"neutral" | "error" | "success">("neutral");
  const [isLoading, setIsLoading] = useState(false);

  const emailError = emailTouched ? getEmailError(email) : "";
  const passwordError = passwordTouched ? getPasswordError(password) : "";
  const message = emailError || passwordError || (capsLock ? "Caps Lock sedang aktif." : notice);
  const messageType = emailError || passwordError ? "error" : capsLock ? "warning" : noticeType;

  function handleCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState("CapsLock"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    setNotice("");

    if (getEmailError(email) || getPasswordError(password)) return;

    if (!supabase) {
      setNotice("Konfigurasi login belum tersedia pada deployment ini.");
      setNoticeType("error");
      return;
    }

    setIsLoading(true);
    setNoticeType("neutral");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (signInError) {
      setNotice("Email atau kata sandi tidak valid.");
      setNoticeType("error");
      setIsLoading(false);
      return;
    }

    const [{ data: profile }, { data: platformRole }] = await Promise.all([
      supabase.from("profiles").select("status").maybeSingle(),
      supabase.from("platform_roles").select("role").maybeSingle(),
    ]);

    if (profile?.status !== "active") {
      await supabase.auth.signOut();
      setNotice("Akun tidak aktif. Hubungi administrator.");
      setNoticeType("error");
      setIsLoading(false);
      return;
    }

    if (platformRole?.role === "superadmin") {
      router.replace("/admin");
      router.refresh();
      return;
    }

    await supabase.auth.signOut();
    setNotice("Akun belum memiliki akses aplikasi.");
    setNoticeType("error");
    setIsLoading(false);
  }

  async function handleForgotPassword() {
    setEmailTouched(true);
    setNotice("");

    if (getEmailError(email)) return;

    if (!supabase) {
      setNotice("Konfigurasi login belum tersedia pada deployment ini.");
      setNoticeType("error");
      return;
    }

    setIsLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    setNotice("Jika email terdaftar, tautan pemulihan sudah dikirim.");
    setNoticeType("success");
    setIsLoading(false);
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">OBELIKS APPS</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="field-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              placeholder="nama@institusi.ac.id"
              maxLength={254}
              value={email}
              aria-invalid={Boolean(emailError)}
              aria-describedby="login-message"
              onBlur={() => setEmailTouched(true)}
              disabled={isLoading}
              onChange={(event) => {
                setEmail(event.target.value);
                setNotice("");
                setNoticeType("neutral");
              }}
            />
          </div>

          <div className="field-group">
            <label htmlFor="password">Kata sandi</label>
            <div className="password-field">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                minLength={8}
                maxLength={128}
                value={password}
                aria-invalid={Boolean(passwordError)}
                aria-describedby="login-message"
                onBlur={() => setPasswordTouched(true)}
                disabled={isLoading}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setNotice("");
                  setNoticeType("neutral");
                }}
                onKeyDown={handleCapsLock}
                onKeyUp={handleCapsLock}
              />
              <button
                className="password-toggle"
                type="button"
                disabled={isLoading}
                aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                <EyeIcon hidden={showPassword} />
              </button>
            </div>
          </div>

          <button className="forgot-password" type="button" disabled={isLoading} onClick={handleForgotPassword}>
            Lupa kata sandi?
          </button>

          <p id="login-message" className={`login-message ${messageType}`} role={messageType === "error" ? "alert" : "status"} aria-live="polite">
            {message}
          </p>

          <button className="submit-button" type="submit" disabled={isLoading}>
            {isLoading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}
