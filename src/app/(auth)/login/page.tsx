"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n/store";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function LoginForm() {
  const { t } = useLang();
  const a = t.auth.login;
  const searchParams = useSearchParams();

  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("error") === "oauth") setError(a.errorOAuth);
  }, [searchParams, a.errorOAuth]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) { setError(a.errorOAuth); setLoading(false); }
  }

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(a.errorCredentials);
      setLoading(false);
    } else {
      const next = searchParams.get("next") ?? "/library";
      window.location.href = next;
    }
  }

  return (
    <div className="max-w-md w-full mx-auto">
      <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-2 tracking-tight">
        {a.title}
      </h1>
      <p className="text-on-surface-variant text-sm mb-10">{a.subtitle}</p>

      {/* Error */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {/* Google OAuth */}
      <button
        onClick={handleGoogleLogin}
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
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
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
          autoComplete="current-password"
        />

        <div className="flex justify-end -mt-1">
          <Link href="/forgot-password" className="text-xs text-primary hover:underline">
            {a.forgotPassword}
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
          {a.submitBtn}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-on-surface-variant">
        {a.noAccount}{" "}
        <Link href="/signup" className="text-primary font-semibold hover:underline">
          {a.signupLink}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  const { t } = useLang();

  return (
    <>
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-16 bg-on-surface">
        <div className="absolute inset-0 z-0">
          <Image
            src="https://picsum.photos/seed/authbg/1200/900"
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
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 xl:px-24 py-16 bg-surface">
        <Link href="/" className="lg:hidden mb-12 text-base font-headline font-black uppercase tracking-tighter text-on-surface">
          IMAGE PARTNERS
        </Link>

        <Suspense fallback={<div className="flex items-center justify-center h-64"><span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
          <LoginForm />
        </Suspense>
      </div>
    </>
  );
}
