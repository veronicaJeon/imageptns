"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AdminButton, AdminChip, AdminListSurface } from "@/components/admin/AdminPrimitives";
import { DEFAULT_AUTH_PAGE_CONTENT, isSafeAuthBackgroundUrl, type AuthPageContent, type AuthPageKey, type AuthPageLocale } from "@/lib/auth/page-content";

const PAGES: Array<{ key: AuthPageKey; label: string }> = [{ key: "login", label: "로그인" }, { key: "signup", label: "회원가입" }];
const LOCALES: Array<{ key: AuthPageLocale; label: string }> = [{ key: "ko", label: "한국어" }, { key: "en", label: "English" }];

export default function AdminAuthPagesPage() {
  const [content, setContent] = useState<AuthPageContent>(DEFAULT_AUTH_PAGE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/auth-pages").then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "콘텐츠를 불러오지 못했습니다.");
      setContent(payload.draftContent);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "콘텐츠를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  function updatePanel(page: AuthPageKey, key: "backgroundImageUrl" | "backgroundImageAlt", value: string) {
    setContent((current) => ({ ...current, pages: { ...current.pages, [page]: { ...current.pages[page], [key]: value } } }));
  }

  function updateCopy(page: AuthPageKey, locale: AuthPageLocale, key: "headline" | "comment", value: string) {
    setContent((current) => ({ ...current, pages: { ...current.pages, [page]: { ...current.pages[page], locales: { ...current.pages[page].locales, [locale]: { ...current.pages[page].locales[locale], [key]: value } } } } }));
  }

  async function save(publish: boolean) {
    const invalid = PAGES.find(({ key }) => !isSafeAuthBackgroundUrl(content.pages[key].backgroundImageUrl));
    if (invalid) { setError(`${invalid.label} 배경 이미지 URL을 확인해 주세요.`); return; }
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch("/api/admin/auth-pages", { method: publish ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "저장하지 못했습니다.");
      setNotice(publish ? "로그인·회원가입 화면을 게시했습니다." : "초안을 저장했습니다.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-sm text-outline">불러오는 중…</div>;

  return <div className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><AdminChip tone="primary">웹페이지 관리</AdminChip><h1 className="mt-3 text-2xl font-extrabold text-on-surface">로그인·회원가입 화면</h1><p className="mt-2 text-sm text-on-surface-variant">왼쪽 배경 이미지와 한국어·영문 소개 문구를 화면별로 관리합니다.</p></div>
      <div className="flex gap-2"><AdminButton disabled={saving} onClick={() => save(false)}>초안 저장</AdminButton><AdminButton disabled={saving} variant="primary" onClick={() => save(true)}>게시</AdminButton></div>
    </div>
    {notice && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-6 xl:grid-cols-2">{PAGES.map(({ key: page, label }) => {
      const panel = content.pages[page];
      return <AdminListSurface key={page} className="space-y-5 p-5">
        <h2 className="text-lg font-extrabold text-on-surface">{label} 페이지</h2>
        <label className="block text-xs font-bold text-outline">배경 이미지 URL<input value={panel.backgroundImageUrl} onChange={(event) => updatePanel(page, "backgroundImageUrl", event.target.value)} placeholder="https://... 또는 /경로 (비우면 단색 배경)" className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm" /></label>
        <label className="block text-xs font-bold text-outline">이미지 대체 텍스트<input value={panel.backgroundImageAlt} onChange={(event) => updatePanel(page, "backgroundImageAlt", event.target.value)} placeholder="이미지 내용을 간단히 설명" className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm" /></label>
        {panel.backgroundImageUrl && isSafeAuthBackgroundUrl(panel.backgroundImageUrl) && <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-on-surface"><Image src={panel.backgroundImageUrl} alt="" fill unoptimized className="object-cover opacity-70" /></div>}
        {LOCALES.map(({ key: locale, label: localeLabel }) => <fieldset key={locale} className="space-y-3 rounded-lg border border-outline-variant/60 p-4"><legend className="px-2 text-xs font-extrabold text-primary">{localeLabel}</legend>
          <label className="block text-xs font-bold text-outline">헤드라인<input value={panel.locales[locale].headline} onChange={(event) => updateCopy(page, locale, "headline", event.target.value)} className="mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm" /></label>
          <label className="block text-xs font-bold text-outline">코멘트<textarea value={panel.locales[locale].comment} onChange={(event) => updateCopy(page, locale, "comment", event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm" /></label>
        </fieldset>)}
      </AdminListSurface>;
    })}</div>
  </div>;
}
