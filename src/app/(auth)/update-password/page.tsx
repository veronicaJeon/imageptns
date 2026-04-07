"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export default function UpdatePasswordPage() {
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(err.message);
    } else {
      setDone(true);
    }
    setLoading(false);
  }

  return (
    <div className="w-full flex flex-col justify-center items-center min-h-screen px-8 bg-surface">
      <div className="max-w-md w-full">
        <Link href="/" className="block mb-12 text-base font-headline font-black uppercase tracking-tighter text-on-surface hover:text-primary transition-colors">
          IMAGE PARTNERS
        </Link>

        {done ? (
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-primary mb-4 block">check_circle</span>
            <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-3">비밀번호가 변경되었습니다</h1>
            <p className="text-on-surface-variant text-sm mb-8">새 비밀번호로 로그인해 주세요.</p>
            <Link href="/login" className="inline-block px-8 py-4 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
              로그인
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-2 tracking-tight">
              새 비밀번호 설정
            </h1>
            <p className="text-on-surface-variant text-sm mb-8">8자 이상의 새 비밀번호를 입력해 주세요.</p>

            {error && (
              <div className="mb-6 px-4 py-3 rounded-lg bg-error/10 border border-error/20 text-error text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-base">error</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="새 비밀번호"
                type="password"
                placeholder="8자 이상"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon="lock"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <Input
                label="비밀번호 확인"
                type="password"
                placeholder="동일하게 입력"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                icon="lock_reset"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <Button type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-2">
                비밀번호 변경
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
