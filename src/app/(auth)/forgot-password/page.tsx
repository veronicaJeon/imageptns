"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n/store";
import { buildSiteUrl } from "@/lib/routing/canonical";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const { t } = useLang();
  const fp = t.forgotPassword;

  const [email, setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: buildSiteUrl("/update-password"),
    });
    // Always show success (don't reveal whether email exists)
    setLoading(false);
    setSent(true);
  }

  return (
    <>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-16 bg-on-surface">
        <div className="absolute inset-0 z-0">
          <Image src="https://picsum.photos/seed/authbg3/1200/900" alt="" fill className="object-cover opacity-30" unoptimized />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-primary/20" />
        <Link href="/" className="relative z-10 text-lg font-headline font-black uppercase tracking-tighter text-white">
          IMAGE PARTNERS
        </Link>
        <div className="relative z-10">
          <p className="font-headline text-3xl font-extrabold text-white leading-snug mb-4">{t.auth.brand.tagline}</p>
          <p className="text-white/60 text-sm italic">{t.auth.brand.quote}</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 xl:px-24 py-16 bg-surface">
        <Link href="/" className="lg:hidden mb-12 text-base font-headline font-black uppercase tracking-tighter text-on-surface">
          IMAGE PARTNERS
        </Link>

        <div className="max-w-md w-full mx-auto">
          {sent ? (
            <div className="text-center">
              <span className="material-symbols-outlined text-6xl text-primary mb-4 block">mark_email_read</span>
              <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-2">{fp.sent}</h1>
              <p className="text-on-surface-variant text-sm mb-8">{fp.sentSub}</p>
              <Link href="/login" className="text-xs font-bold text-primary hover:underline flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                {fp.backToLogin}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-2 tracking-tight">{fp.title}</h1>
              <p className="text-on-surface-variant text-sm mb-8">{fp.sub}</p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <Input
                  label={fp.emailLabel}
                  type="email"
                  placeholder={fp.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  icon="mail"
                  required
                  autoComplete="email"
                />
                <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full">
                  {fp.submitBtn}
                </Button>
              </form>

              <p className="mt-6 text-center">
                <Link href="/login" className="text-xs font-bold text-primary hover:underline flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-base">arrow_back</span>
                  {fp.backToLogin}
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
