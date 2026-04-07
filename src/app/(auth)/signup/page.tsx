"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useLang } from "@/lib/i18n/store";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { RadioCard } from "@/components/ui/RadioCard";

type Role = "buyer" | "photographer";

export default function SignupPage() {
  const { t } = useLang();
  const a = t.auth.signup;

  const [role, setRole]           = useState<Role>("buyer");
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  async function handleGoogleSignup() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Pass role via callback URL; server route will attach it to user metadata
        redirectTo: `${window.location.origin}/api/auth/callback?role=${role}`,
      },
    });
    if (error) { setError(t.auth.login.errorOAuth); setLoading(false); }
  }

  async function handleEmailSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, role },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Session may not exist yet if email confirmation is required
      setEmailSent(true);
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-16 bg-on-surface">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://picsum.photos/seed/authbg2/1200/900"
            alt="Archive imagery"
            fill
            className="object-cover opacity-30"
            unoptimized
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-primary/20" />

        <Link href="/" className="relative z-10 text-lg font-headline font-black uppercase tracking-tighter text-white">
          IMAGE PARTNERS
        </Link>

        <div className="relative z-10">
          <p className="text-white/50 text-xs uppercase tracking-[0.3em] mb-6">Est. 1994</p>
          <p className="font-headline text-3xl font-extrabold text-white leading-snug mb-4">
            {t.auth.brand.tagline}
          </p>
          <p className="text-white/60 text-sm italic">{t.auth.brand.quote}</p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 xl:px-24 py-16 bg-surface overflow-y-auto">

        {/* Mobile brand */}
        <Link href="/" className="lg:hidden mb-12 text-base font-headline font-black uppercase tracking-tighter text-on-surface">
          IMAGE PARTNERS
        </Link>

        <div className="max-w-md w-full mx-auto">
          <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-2 tracking-tight">
            {a.title}
          </h1>
          <p className="text-on-surface-variant text-sm mb-8">{a.subtitle}</p>

          {/* Email sent confirmation */}
          {emailSent && (
            <div className="flex flex-col items-center py-12 gap-4 text-center">
              <span className="material-symbols-outlined text-6xl text-primary">mark_email_read</span>
              <h2 className="font-headline text-xl font-extrabold text-on-surface">이메일을 확인해주세요</h2>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                <strong className="text-on-surface">{email}</strong>로<br />
                인증 링크를 발송했습니다.<br />
                이메일의 링크를 클릭하면 가입이 완료됩니다.
              </p>
              <Link href="/login" className="mt-4 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
                로그인 페이지로
              </Link>
            </div>
          )}

          {/* Error */}
          {!emailSent && error && (
            <div className="mb-6 px-4 py-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {error}
            </div>
          )}

          {/* Signup form — hidden after email is sent */}
          {!emailSent && (
            <>
              {/* Role selector */}
              <div className="mb-8">
                <p className="text-xs font-bold text-outline uppercase tracking-widest mb-3">
                  {a.roleLabel}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <RadioCard
                    name="role"
                    value="buyer"
                    icon="shopping_bag"
                    label={a.roleBuyer}
                    description={a.roleBuyerDesc}
                    checked={role === "buyer"}
                    onChange={() => setRole("buyer")}
                  />
                  <RadioCard
                    name="role"
                    value="photographer"
                    icon="photo_camera"
                    label={a.rolePhotographer}
                    description={a.rolePhotographerDesc}
                    checked={role === "photographer"}
                    onChange={() => setRole("photographer")}
                  />
                </div>
              </div>

              {/* Google OAuth */}
              <button
                onClick={handleGoogleSignup}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 h-12 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors text-sm font-semibold text-on-surface disabled:opacity-50 disabled:cursor-not-allowed mb-6"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                {a.googleBtn}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 h-px bg-outline-variant/40" />
                <span className="text-xs text-outline uppercase tracking-widest">{a.divider}</span>
                <div className="flex-1 h-px bg-outline-variant/40" />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailSignup} className="flex flex-col gap-4">
                <Input
                  label={a.nameLabel}
                  type="text"
                  placeholder={a.namePlaceholder}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  icon="person"
                  required
                  autoComplete="name"
                />
                <Input
                  label={a.emailLabel}
                  type="email"
                  placeholder={a.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon="mail"
                  required
                  autoComplete="email"
                />
                <Input
                  label={a.passwordLabel}
                  type="password"
                  placeholder={a.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon="lock"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />

                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
                  {a.submitBtn}
                </Button>
              </form>

              {/* Terms */}
              <p className="mt-4 text-center text-xs text-outline leading-relaxed">
                {a.terms}{" "}
                <Link href="/terms" className="text-primary hover:underline">{a.termsLink}</Link>
                {" "}{a.and}{" "}
                <Link href="/privacy" className="text-primary hover:underline">{a.privacyLink}</Link>
                .
              </p>

              <p className="mt-6 text-center text-sm text-on-surface-variant">
                {a.hasAccount}{" "}
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  {a.loginLink}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
