"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AdminButton, AdminChip, AdminListSurface } from "@/components/admin/AdminPrimitives";
import { DEFAULT_AUTH_PAGE_CONTENT, isSafeAuthBackgroundUrl, type AuthPageContent, type AuthPageKey, type AuthPageLocale } from "@/lib/auth/page-content";

interface PickerImage { id: string; asset_id: string | null; title: string; storage_path_preview: string | null }
interface PickerPagination { page: number; total: number; totalPages: number }
const PAGES: Array<{ key: AuthPageKey; label: string }> = [{ key: "login", label: "로그인" }, { key: "signup", label: "회원가입" }];
const LOCALES: Array<{ key: AuthPageLocale; label: string }> = [{ key: "ko", label: "한국어" }, { key: "en", label: "English" }];
const fieldClass = "mt-2 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm";

export default function AdminAuthPagesPage() {
  const [content, setContent] = useState<AuthPageContent>(DEFAULT_AUTH_PAGE_CONTENT);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<AuthPageKey | null>(null), [pickerQuery, setPickerQuery] = useState(""), [pickerPage, setPickerPage] = useState(1);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerPagination, setPickerPagination] = useState<PickerPagination>({ page: 1, total: 0, totalPages: 1 });
  const [pickerLoading, setPickerLoading] = useState(false), [pickerError, setPickerError] = useState<string | null>(null), [generatingImageId, setGeneratingImageId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/auth-pages").then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "콘텐츠를 불러오지 못했습니다."); setContent(payload.draftContent); })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "콘텐츠를 불러오지 못했습니다.")).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!pickerSlot) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPickerLoading(true); setPickerError(null);
      try {
        const params = new URLSearchParams({ status: "approved", promotionalUse: "true", page: String(pickerPage), pageSize: "24" });
        if (pickerQuery.trim()) params.set("query", pickerQuery.trim());
        const response = await fetch(`/api/admin/images?${params}`, { signal: controller.signal }); const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "라이브러리 이미지를 불러오지 못했습니다.");
        setPickerImages(body.images ?? []); setPickerPagination(body.pagination ?? { page: pickerPage, total: 0, totalPages: 1 });
      } catch (cause) { if (!controller.signal.aborted) setPickerError(cause instanceof Error ? cause.message : "라이브러리 이미지를 불러오지 못했습니다."); }
      finally { if (!controller.signal.aborted) setPickerLoading(false); }
    }, 250);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [pickerPage, pickerQuery, pickerSlot]);

  function updatePanel(page: AuthPageKey, key: "backgroundImageUrl" | "backgroundImageAlt", value: string) {
    setContent((current) => ({ ...current, pages: { ...current.pages, [page]: { ...current.pages[page], [key]: value, ...(key === "backgroundImageUrl" ? { backgroundImageSource: { source: "external" as const, imageId: null, derivedPath: null, credit: null, licenseCode: null, licenseLabel: null, licenseUrl: null } } : {}) } } }));
  }
  function updateCopy(page: AuthPageKey, locale: AuthPageLocale, key: "headline" | "comment", value: string) {
    setContent((current) => ({ ...current, pages: { ...current.pages, [page]: { ...current.pages[page], locales: { ...current.pages[page].locales, [locale]: { ...current.pages[page].locales[locale], [key]: value } } } } }));
  }
  async function selectLibraryImage(image: PickerImage) {
    if (!pickerSlot) return;
    setGeneratingImageId(image.id); setPickerError(null);
    try {
      const response = await fetch("/api/admin/auth-pages/library-assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageId: image.id, slot: pickerSlot }) }); const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "전시용 이미지를 만들지 못했습니다.");
      const slot = pickerSlot;
      setContent((current) => ({ ...current, pages: { ...current.pages, [slot]: { ...current.pages[slot], backgroundImageUrl: body.url, backgroundImageAlt: image.title, backgroundImageSource: { source: "library", imageId: body.imageId, derivedPath: body.derivedPath, credit: body.credit, licenseCode: body.licenseCode, licenseLabel: body.licenseLabel, licenseUrl: body.licenseUrl } } } }));
      setNotice(`라이브러리 이미지 “${image.title}”을 적용했습니다. 저장 또는 게시해 주세요.`); setPickerSlot(null);
    } catch (cause) { setPickerError(cause instanceof Error ? cause.message : "전시용 이미지를 만들지 못했습니다."); } finally { setGeneratingImageId(null); }
  }
  async function save(publish: boolean) {
    const invalid = PAGES.find(({ key }) => !isSafeAuthBackgroundUrl(content.pages[key].backgroundImageUrl));
    if (invalid) { setError(`${invalid.label} 배경 이미지 URL을 확인해 주세요.`); return; }
    setSaving(true); setError(null); setNotice(null);
    try { const response = await fetch("/api/admin/auth-pages", { method: publish ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "저장하지 못했습니다."); setNotice(publish ? "로그인·회원가입 화면을 게시했습니다." : "초안을 저장했습니다."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "저장하지 못했습니다."); } finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-sm text-outline">불러오는 중…</div>;
  return <div className="space-y-6 p-6 lg:p-8">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><AdminChip tone="primary">웹페이지 관리</AdminChip><h1 className="mt-3 text-2xl font-extrabold text-on-surface">로그인·회원가입 화면</h1><p className="mt-2 text-sm text-on-surface-variant">라이브러리에서 배경 이미지를 고르고 한국어·영문 소개 문구를 화면별로 관리합니다.</p></div><div className="flex gap-2"><AdminButton disabled={saving} onClick={() => save(false)}>초안 저장</AdminButton><AdminButton disabled={saving} variant="primary" onClick={() => save(true)}>게시</AdminButton></div></div>
    {notice && <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}{error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-6 xl:grid-cols-2">{PAGES.map(({ key: page, label }) => { const panel = content.pages[page]; return <AdminListSurface key={page} className="space-y-5 p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-extrabold text-on-surface">{label} 페이지</h2><AdminChip tone={panel.backgroundImageSource.source === "library" ? "success" : "neutral"}>{panel.backgroundImageSource.source === "library" ? "라이브러리 파생본" : "외부 URL"}</AdminChip></div>
      <div><AdminButton onClick={() => { setPickerSlot(page); setPickerPage(1); setPickerQuery(""); }}>라이브러리에서 선택</AdminButton><p className="mt-2 text-xs leading-5 text-outline">홍보 활용에 동의한 승인·공개 이미지만 표시하며, 선택 시 웹 전시용 파생본을 만듭니다.</p></div>
      <label className="block text-xs font-bold text-outline">배경 이미지 URL <span className="font-normal">(보조 방식)</span><input value={panel.backgroundImageUrl} onChange={(event) => updatePanel(page, "backgroundImageUrl", event.target.value)} placeholder="https://... 또는 /경로 (비우면 단색 배경)" className={fieldClass} /></label>
      <label className="block text-xs font-bold text-outline">이미지 대체 텍스트<input value={panel.backgroundImageAlt} onChange={(event) => updatePanel(page, "backgroundImageAlt", event.target.value)} placeholder="이미지 내용을 간단히 설명" className={fieldClass} /></label>
      {panel.backgroundImageUrl && isSafeAuthBackgroundUrl(panel.backgroundImageUrl) && <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-on-surface"><Image src={panel.backgroundImageUrl} alt={panel.backgroundImageAlt} fill unoptimized className="object-cover opacity-70" /></div>}
      {LOCALES.map(({ key: locale, label: localeLabel }) => <fieldset key={locale} className="space-y-3 rounded-lg border border-outline-variant/60 p-4"><legend className="px-2 text-xs font-extrabold text-primary">{localeLabel}</legend><label className="block text-xs font-bold text-outline">헤드라인<input value={panel.locales[locale].headline} onChange={(event) => updateCopy(page, locale, "headline", event.target.value)} className={fieldClass} /></label><label className="block text-xs font-bold text-outline">코멘트<textarea value={panel.locales[locale].comment} onChange={(event) => updateCopy(page, locale, "comment", event.target.value)} rows={3} className={`${fieldClass} resize-none`} /></label></fieldset>)}
    </AdminListSurface>; })}</div>
    {pickerSlot && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label="인증 화면 라이브러리 이미지 선택" onMouseDown={(event) => { if (event.currentTarget === event.target && !generatingImageId) setPickerSlot(null); }}><div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 p-5"><div><h2 className="text-base font-extrabold text-on-surface">라이브러리에서 이미지 선택</h2><p className="mt-1 text-xs leading-5 text-outline">홍보 활용에 동의한 승인·공개 이미지만 표시됩니다. 원본 대신 메타데이터를 제거한 웹 전시용 파생본을 생성합니다.</p></div><button type="button" disabled={Boolean(generatingImageId)} onClick={() => setPickerSlot(null)} aria-label="닫기" className="rounded-lg p-2 text-outline hover:bg-surface-container-low"><span className="material-symbols-outlined">close</span></button></div>
      <div className="border-b border-outline-variant/30 p-4"><input autoFocus value={pickerQuery} onChange={(event) => { setPickerQuery(event.target.value); setPickerPage(1); }} placeholder="제목, 에셋 ID, 태그 검색" className={fieldClass} /></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{pickerError && <div className="mb-4 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">{pickerError}</div>}{pickerLoading ? <div className="flex min-h-64 items-center justify-center text-sm text-outline">이미지를 불러오는 중...</div> : pickerImages.length === 0 ? <div className="flex min-h-64 items-center justify-center text-sm text-outline">선택 가능한 이미지가 없습니다.</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{pickerImages.map((image) => <button key={image.id} type="button" disabled={Boolean(generatingImageId) || !image.storage_path_preview} onClick={() => selectLibraryImage(image)} className="group overflow-hidden rounded-lg border border-outline-variant/40 bg-surface text-left hover:border-primary disabled:opacity-50"><div className="relative aspect-[4/3] overflow-hidden bg-surface-container-low">{image.storage_path_preview && <Image src={image.storage_path_preview} alt="" fill unoptimized className="object-cover transition-transform group-hover:scale-105" />}{generatingImageId === image.id && <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-bold text-white">생성 중...</div>}</div><div className="p-3"><p className="truncate text-xs font-bold text-on-surface">{image.title}</p><p className="mt-1 truncate text-[11px] text-outline">{image.asset_id ?? image.id}</p></div></button>)}</div>}</div>
      <div className="flex items-center justify-between border-t border-outline-variant/30 px-4 py-3 text-xs text-outline"><span>총 {pickerPagination.total.toLocaleString()}개</span><div className="flex items-center gap-2"><AdminButton disabled={pickerPagination.page <= 1 || pickerLoading} onClick={() => setPickerPage((page) => Math.max(1, page - 1))}>이전</AdminButton><span>{pickerPagination.page} / {Math.max(1, pickerPagination.totalPages)}</span><AdminButton disabled={pickerPagination.page >= pickerPagination.totalPages || pickerLoading} onClick={() => setPickerPage((page) => page + 1)}>다음</AdminButton></div></div>
    </div></div>}
  </div>;
}
