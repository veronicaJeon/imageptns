"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AboutPageView } from "@/components/about/AboutPageView";
import { AdminButton, AdminChip, AdminListSurface } from "@/components/admin/AdminPrimitives";
import {
  DEFAULT_ABOUT_PAGE_CONTENT,
  isSafeImageUrl,
  type AboutImageSlot,
  type AboutPageContent,
  type AboutPageLocale,
  type AboutPageLocaleContent,
  type AboutPageRecord,
} from "@/lib/about/content";
import { cn } from "@/lib/utils/cn";

interface AboutPageState {
  draftContent?: AboutPageContent;
  publishedContent?: AboutPageContent;
  updatedAt?: string | null;
  publishedAt?: string | null;
}

interface PickerImage {
  id: string;
  asset_id: string | null;
  title: string;
  storage_path_preview: string | null;
  width: number | null;
  height: number | null;
}

interface PickerPagination {
  page: number;
  total: number;
  totalPages: number;
}

const fieldClass = "w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary";
const textareaClass = `${fieldClass} min-h-24 resize-y leading-6`;

const IMAGE_FIELDS: Array<{ key: keyof AboutPageContent["images"]; label: string; description: string }> = [
  { key: "hero", label: "상단 히어로 이미지", description: "첫 화면 배경으로 노출됩니다." },
  { key: "editorial", label: "본문 이미지", description: "소개 문구 옆의 가로형 이미지입니다." },
  { key: "desk", label: "큐레이션 데스크 이미지", description: "검증 프로세스 패널에 노출됩니다." },
];

function formatDateTime(value?: string | null) {
  if (!value) return "아직 없음";
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sectionLabel(locale: AboutPageLocale) {
  return locale === "ko" ? "한국어" : "English";
}

function cloneWithLocale(
  content: AboutPageContent,
  locale: AboutPageLocale,
  updater: (current: AboutPageLocaleContent) => AboutPageLocaleContent,
): AboutPageContent {
  return {
    ...content,
    locales: {
      ...content.locales,
      [locale]: updater(content.locales[locale]),
    },
  };
}

export default function AdminAboutPage() {
  const [content, setContent] = useState<AboutPageContent>(DEFAULT_ABOUT_PAGE_CONTENT);
  const [publishedContent, setPublishedContent] = useState<AboutPageContent>(DEFAULT_ABOUT_PAGE_CONTENT);
  const [activeLocale, setActiveLocale] = useState<AboutPageLocale>("ko");
  const [previewLocale, setPreviewLocale] = useState<AboutPageLocale>("ko");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerSlot, setPickerSlot] = useState<AboutImageSlot | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerImages, setPickerImages] = useState<PickerImage[]>([]);
  const [pickerPagination, setPickerPagination] = useState<PickerPagination>({ page: 1, total: 0, totalPages: 1 });
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [generatingImageId, setGeneratingImageId] = useState<string | null>(null);

  const activeCopy = content.locales[activeLocale];
  const previewLabel = useMemo(() => sectionLabel(previewLocale), [previewLocale]);
  const hasUnpublishedChanges = useMemo(
    () => JSON.stringify(content) !== JSON.stringify(publishedContent),
    [content, publishedContent],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/about-page");
      if (response.status === 403) {
        setForbidden(true);
        return;
      }
      const body = await response.json() as AboutPageState & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "회사소개 콘텐츠를 불러오지 못했습니다.");
      setContent(body.draftContent ?? DEFAULT_ABOUT_PAGE_CONTENT);
      setPublishedContent(body.publishedContent ?? DEFAULT_ABOUT_PAGE_CONTENT);
      setUpdatedAt(body.updatedAt ?? null);
      setPublishedAt(body.publishedAt ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "회사소개 콘텐츠를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!pickerSlot) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPickerLoading(true);
      setPickerError(null);
      try {
        const params = new URLSearchParams({
          status: "approved",
          promotionalUse: "true",
          page: String(pickerPage),
          pageSize: "24",
        });
        if (pickerQuery.trim()) params.set("query", pickerQuery.trim());
        const response = await fetch(`/api/admin/images?${params}`, { signal: controller.signal });
        const body = await response.json() as {
          images?: PickerImage[];
          pagination?: PickerPagination;
          error?: string;
        };
        if (!response.ok) throw new Error(body.error ?? "라이브러리 이미지를 불러오지 못했습니다.");
        setPickerImages(body.images ?? []);
        setPickerPagination(body.pagination ?? { page: pickerPage, total: 0, totalPages: 1 });
      } catch (error) {
        if (!controller.signal.aborted) {
          setPickerError(error instanceof Error ? error.message : "라이브러리 이미지를 불러오지 못했습니다.");
        }
      } finally {
        if (!controller.signal.aborted) setPickerLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [pickerPage, pickerQuery, pickerSlot]);

  function updateImage(key: AboutImageSlot, value: string) {
    setContent((current) => ({
      ...current,
      images: { ...current.images, [key]: value },
      imageSources: {
        ...current.imageSources,
        [key]: {
          source: "external",
          imageId: null,
          derivedPath: null,
          credit: null,
          licenseCode: null,
          licenseLabel: null,
          licenseUrl: null,
        },
      },
    }));
  }

  function openPicker(slot: AboutImageSlot) {
    setPickerSlot(slot);
    setPickerQuery("");
    setPickerPage(1);
    setPickerError(null);
  }

  async function selectLibraryImage(image: PickerImage) {
    if (!pickerSlot) return;
    setGeneratingImageId(image.id);
    setPickerError(null);
    try {
      const response = await fetch("/api/admin/about-page/library-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageId: image.id, slot: pickerSlot }),
      });
      const body = await response.json() as {
        imageId?: string;
        derivedPath?: string;
        url?: string;
        credit?: string | null;
        licenseCode?: string | null;
        licenseLabel?: string | null;
        licenseUrl?: string | null;
        error?: string;
      };
      if (!response.ok || !body.imageId || !body.derivedPath || !body.url) {
        throw new Error(body.error ?? "전시용 이미지를 만들지 못했습니다.");
      }
      const slot = pickerSlot;
      setContent((current) => ({
        ...current,
        images: { ...current.images, [slot]: body.url! },
        imageSources: {
          ...current.imageSources,
          [slot]: {
            source: "library",
            imageId: body.imageId!,
            derivedPath: body.derivedPath!,
            credit: body.credit ?? null,
            licenseCode: body.licenseCode ?? null,
            licenseLabel: body.licenseLabel ?? null,
            licenseUrl: body.licenseUrl ?? null,
          },
        },
      }));
      setPickerSlot(null);
      setMessage(`라이브러리 이미지 “${image.title}”의 전시용 파생본을 적용했습니다. 초안 저장 후 게시해 주세요.`);
    } catch (error) {
      setPickerError(error instanceof Error ? error.message : "전시용 이미지를 만들지 못했습니다.");
    } finally {
      setGeneratingImageId(null);
    }
  }

  function updateHero(field: keyof AboutPageLocaleContent["hero"], value: string) {
    setContent((current) => cloneWithLocale(current, activeLocale, (locale) => ({
      ...locale,
      hero: { ...locale.hero, [field]: value },
    })));
  }

  function updateAbout(field: keyof AboutPageLocaleContent["about"], value: string) {
    setContent((current) => cloneWithLocale(current, activeLocale, (locale) => ({
      ...locale,
      about: { ...locale.about, [field]: value },
    })));
  }

  function updateCuration(field: Exclude<keyof AboutPageLocaleContent["curation"], "records">, value: string) {
    setContent((current) => cloneWithLocale(current, activeLocale, (locale) => ({
      ...locale,
      curation: { ...locale.curation, [field]: value },
    })));
  }

  function updateCurationRecord(index: number, field: keyof AboutPageRecord, value: string) {
    setContent((current) => cloneWithLocale(current, activeLocale, (locale) => ({
      ...locale,
      curation: {
        ...locale.curation,
        records: locale.curation.records.map((record, recordIndex) => (
          recordIndex === index ? { ...record, [field]: value } : record
        )),
      },
    })));
  }

  function addRecord() {
    setContent((current) => cloneWithLocale(current, activeLocale, (locale) => ({
      ...locale,
      curation: {
        ...locale.curation,
        records: [
          ...locale.curation.records,
          { label: "항목", value: "값", detail: "설명을 입력하세요." },
        ].slice(0, 6),
      },
    })));
  }

  function removeRecord(index: number) {
    setContent((current) => cloneWithLocale(current, activeLocale, (locale) => ({
      ...locale,
      curation: {
        ...locale.curation,
        records: locale.curation.records.filter((_, recordIndex) => recordIndex !== index),
      },
    })));
  }

  function updateCta(field: keyof AboutPageLocaleContent["cta"], value: string) {
    setContent((current) => cloneWithLocale(current, activeLocale, (locale) => ({
      ...locale,
      cta: { ...locale.cta, [field]: value },
    })));
  }

  async function saveDraft() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/about-page", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await response.json().catch(() => null) as { error?: string; updatedAt?: string; draftContent?: AboutPageContent } | null;
      if (!response.ok) throw new Error(body?.error ?? "초안을 저장하지 못했습니다.");
      if (body?.draftContent) setContent(body.draftContent);
      setUpdatedAt(body?.updatedAt ?? new Date().toISOString());
      setMessage("초안을 저장했습니다. 공개 화면은 아직 변경되지 않았습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초안을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!confirm("현재 미리보기 콘텐츠를 회사소개 페이지에 게시할까요?")) return;
    setPublishing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/about-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", content }),
      });
      const body = await response.json().catch(() => null) as {
        error?: string;
        publishedAt?: string;
        updatedAt?: string;
        publishedContent?: AboutPageContent;
      } | null;
      if (!response.ok) throw new Error(body?.error ?? "게시하지 못했습니다.");
      setPublishedContent(body?.publishedContent ?? content);
      setPublishedAt(body?.publishedAt ?? new Date().toISOString());
      setUpdatedAt(body?.updatedAt ?? new Date().toISOString());
      setMessage("회사소개 페이지에 게시했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "게시하지 못했습니다.");
    } finally {
      setPublishing(false);
    }
  }

  async function translateEnglish() {
    setTranslating(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/about-page/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const body = await response.json().catch(() => null) as { content?: AboutPageContent; error?: string } | null;
      if (!response.ok || !body?.content) throw new Error(body?.error ?? "영문 자동번역에 실패했습니다.");
      setContent(body.content);
      setActiveLocale("en");
      setPreviewLocale("en");
      setMessage("영문 자동번역 초안을 생성했습니다. 게시 전 문맥을 확인해 주세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "영문 자동번역에 실패했습니다.");
    } finally {
      setTranslating(false);
    }
  }

  if (forbidden) {
    return (
      <div className="p-10 text-center font-bold text-error">
        관리자 권한이 필요합니다.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-outline">
        불러오는 중...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1680px] p-4 md:p-8 lg:p-10">
      <div className="mb-8 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <AdminChip tone="primary">웹페이지 관리</AdminChip>
            <AdminChip tone={publishedAt ? "success" : "warning"}>
              게시 {formatDateTime(publishedAt)}
            </AdminChip>
            <AdminChip tone="neutral">초안 저장 {formatDateTime(updatedAt)}</AdminChip>
          </div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">
            회사소개 관리
          </h1>
          <p className="mt-1 text-sm leading-6 text-outline">
            한국어 콘텐츠를 편집하고, 영문 자동번역과 실제 화면 미리보기를 확인한 뒤 게시합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/about"
            target="_blank"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-xs font-bold text-on-surface-variant hover:border-primary/50 hover:text-primary"
          >
            <span className="material-symbols-outlined text-base">open_in_new</span>
            공개 페이지
          </Link>
          <AdminButton type="button" size="md" onClick={translateEnglish} disabled={translating}>
            <span className="material-symbols-outlined text-base">translate</span>
            {translating ? "번역 중..." : "영문 자동번역"}
          </AdminButton>
          <AdminButton type="button" size="md" onClick={saveDraft} disabled={saving}>
            <span className="material-symbols-outlined text-base">save</span>
            {saving ? "저장 중..." : "초안 저장"}
          </AdminButton>
          <AdminButton type="button" variant="primary" size="md" onClick={publish} disabled={publishing}>
            <span className="material-symbols-outlined text-base">publish</span>
            {publishing ? "게시 중..." : "게시"}
          </AdminButton>
        </div>
      </div>

      {message && (
        <div className="mb-6 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,640px)_minmax(0,1fr)]">
        <div className="space-y-5">
          <AdminListSurface className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-extrabold text-on-surface">편집 언어</h2>
                <p className="mt-1 text-xs text-outline">한국어 편집 후 영문 자동번역을 생성할 수 있습니다.</p>
              </div>
              <div className="flex rounded-lg bg-surface-container-low p-1">
                {(["ko", "en"] as const).map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => {
                      setActiveLocale(locale);
                      setPreviewLocale(locale);
                    }}
                    className={cn(
                      "h-8 rounded-md px-3 text-xs font-bold transition-colors",
                      activeLocale === locale ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    {sectionLabel(locale)}
                  </button>
                ))}
              </div>
            </div>
          </AdminListSurface>

          <AdminListSurface className="p-5">
            <h2 className="mb-4 text-sm font-extrabold text-on-surface">이미지</h2>
            <div className="space-y-5">
              {IMAGE_FIELDS.map((field) => {
                const value = content.images[field.key];
                const canPreview = isSafeImageUrl(value);
                const source = content.imageSources[field.key];
                return (
                  <div key={field.key} className="block">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-outline">{field.label}</span>
                        <span className="mt-1 block text-xs text-outline">{field.description}</span>
                      </div>
                      <AdminChip tone={source.source === "library" ? "success" : "neutral"}>
                        {source.source === "library" ? "라이브러리 파생본" : "외부 URL"}
                      </AdminChip>
                    </div>
                    <AdminButton type="button" className="mt-3" onClick={() => openPicker(field.key)}>
                      <span className="material-symbols-outlined text-base">photo_library</span>
                      라이브러리에서 선택
                    </AdminButton>
                    <label className="mt-3 block text-[11px] font-bold text-outline">
                      직접 URL 입력 (보조 방식)
                    <input
                      value={value}
                      onChange={(event) => updateImage(field.key, event.target.value)}
                      placeholder="https://..."
                      className="mt-2 w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2.5 text-sm text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary"
                    />
                    </label>
                    {canPreview && (
                      <div className="mt-3 aspect-[16/7] overflow-hidden border border-outline-variant/30 bg-surface-container-low">
                        <Image
                          src={value}
                          alt=""
                          width={800}
                          height={350}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </AdminListSurface>

          <AdminListSurface className="p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-on-surface">문구 편집</h2>
              <AdminChip tone="neutral">{sectionLabel(activeLocale)}</AdminChip>
            </div>

            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Hero</h3>
                <label className="block text-xs font-bold text-outline">
                  배지
                  <input value={activeCopy.hero.badge} onChange={(event) => updateHero("badge", event.target.value)} className={`mt-2 ${fieldClass}`} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-outline">
                    헤드라인 1
                    <input value={activeCopy.hero.headline1} onChange={(event) => updateHero("headline1", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    헤드라인 2
                    <input value={activeCopy.hero.headline2} onChange={(event) => updateHero("headline2", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                </div>
                <label className="block text-xs font-bold text-outline">
                  설명
                  <textarea value={activeCopy.hero.description} onChange={(event) => updateHero("description", event.target.value)} rows={3} className={`mt-2 ${textareaClass}`} />
                </label>
              </section>

              <section className="space-y-3 border-t border-outline-variant/30 pt-5">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Intro</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-outline">
                    제목 1
                    <input value={activeCopy.about.headline1} onChange={(event) => updateAbout("headline1", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    제목 2
                    <input value={activeCopy.about.headline2} onChange={(event) => updateAbout("headline2", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                </div>
                <label className="block text-xs font-bold text-outline">
                  본문
                  <textarea value={activeCopy.about.body} onChange={(event) => updateAbout("body", event.target.value)} rows={5} className={`mt-2 ${textareaClass}`} />
                </label>
              </section>

              <section className="space-y-3 border-t border-outline-variant/30 pt-5">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Curation Desk</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-outline">
                    키커
                    <input value={activeCopy.curation.kicker} onChange={(event) => updateCuration("kicker", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    패널 ID
                    <input value={activeCopy.curation.panelMeta} onChange={(event) => updateCuration("panelMeta", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                </div>
                <label className="block text-xs font-bold text-outline">
                  제목
                  <input value={activeCopy.curation.title} onChange={(event) => updateCuration("title", event.target.value)} className={`mt-2 ${fieldClass}`} />
                </label>
                <label className="block text-xs font-bold text-outline">
                  본문
                  <textarea value={activeCopy.curation.body} onChange={(event) => updateCuration("body", event.target.value)} rows={5} className={`mt-2 ${textareaClass}`} />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-outline">
                    패널 제목
                    <input value={activeCopy.curation.panelTitle} onChange={(event) => updateCuration("panelTitle", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    이미지 라벨
                    <input value={activeCopy.curation.previewLabel} onChange={(event) => updateCuration("previewLabel", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    상태 배지
                    <input value={activeCopy.curation.reviewed} onChange={(event) => updateCuration("reviewed", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    노트 라벨
                    <input value={activeCopy.curation.noteLabel} onChange={(event) => updateCuration("noteLabel", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                </div>
                <label className="block text-xs font-bold text-outline">
                  에디터 노트
                  <textarea value={activeCopy.curation.note} onChange={(event) => updateCuration("note", event.target.value)} rows={3} className={`mt-2 ${textareaClass}`} />
                </label>
                <label className="block text-xs font-bold text-outline">
                  패널 하단 문구
                  <textarea value={activeCopy.curation.panelFooter} onChange={(event) => updateCuration("panelFooter", event.target.value)} rows={3} className={`mt-2 ${textareaClass}`} />
                </label>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-outline">검증 항목</p>
                    <AdminButton type="button" onClick={addRecord} disabled={activeCopy.curation.records.length >= 6}>
                      <span className="material-symbols-outlined text-base">add</span>
                      항목 추가
                    </AdminButton>
                  </div>
                  {activeCopy.curation.records.map((record, index) => (
                    <div key={index} className="grid gap-3 border-t border-outline-variant/20 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-on-surface">항목 {index + 1}</span>
                        {activeCopy.curation.records.length > 1 && (
                          <button type="button" onClick={() => removeRecord(index)} className="text-xs font-bold text-error">
                            삭제
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input value={record.label} onChange={(event) => updateCurationRecord(index, "label", event.target.value)} placeholder="라벨" className={fieldClass} />
                        <input value={record.value} onChange={(event) => updateCurationRecord(index, "value", event.target.value)} placeholder="값" className={fieldClass} />
                      </div>
                      <textarea value={record.detail} onChange={(event) => updateCurationRecord(index, "detail", event.target.value)} rows={2} placeholder="설명" className={textareaClass} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3 border-t border-outline-variant/30 pt-5">
                <h3 className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">CTA</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-outline">
                    제목 1
                    <input value={activeCopy.cta.headline1} onChange={(event) => updateCta("headline1", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    제목 2
                    <input value={activeCopy.cta.headline2} onChange={(event) => updateCta("headline2", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    라이브러리 버튼
                    <input value={activeCopy.cta.browse} onChange={(event) => updateCta("browse", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    문의 버튼
                    <input value={activeCopy.cta.contact} onChange={(event) => updateCta("contact", event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                </div>
              </section>
            </div>
          </AdminListSurface>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <AdminListSurface className="overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-outline-variant/30 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-on-surface">미리보기</h2>
                <p className="mt-1 text-xs text-outline">게시 전 실제 회사소개 화면과 같은 렌더러로 확인합니다.</p>
              </div>
              <div className="flex rounded-lg bg-surface-container-low p-1">
                {(["ko", "en"] as const).map((locale) => (
                  <button
                    key={locale}
                    type="button"
                    onClick={() => setPreviewLocale(locale)}
                    className={cn(
                      "h-8 rounded-md px-3 text-xs font-bold transition-colors",
                      previewLocale === locale ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface",
                    )}
                  >
                    {sectionLabel(locale)}
                  </button>
                ))}
              </div>
            </div>
            <div className="max-h-[calc(100vh-220px)] overflow-auto bg-surface">
              <div className="min-w-[760px]">
                <AboutPageView content={content} langOverride={previewLocale} showNoticePopup={false} />
              </div>
            </div>
            <div className="border-t border-outline-variant/30 px-4 py-3 text-xs text-outline">
              현재 미리보기: {previewLabel} · 게시본 마지막 반영 {formatDateTime(publishedAt)}
            </div>
          </AdminListSurface>

          <AdminListSurface className="mt-5 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-extrabold text-on-surface">게시본 기준</h2>
                <p className="mt-1 text-xs leading-5 text-outline">
                  초안 저장은 공개 페이지에 반영되지 않습니다. 게시 버튼을 눌렀을 때만 `/about`에 반영됩니다.
                </p>
              </div>
              <AdminChip tone={hasUnpublishedChanges ? "warning" : "success"}>
                {hasUnpublishedChanges ? "게시 전 변경 있음" : "게시본과 동일"}
              </AdminChip>
            </div>
          </AdminListSurface>
        </div>
      </div>

      {pickerSlot && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="회사소개 라이브러리 이미지 선택"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !generatingImageId) setPickerSlot(null);
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/30 p-5">
              <div>
                <h2 className="text-base font-extrabold text-on-surface">라이브러리에서 이미지 선택</h2>
                <p className="mt-1 text-xs leading-5 text-outline">
                  사진가가 홍보 활용에 동의한 승인·공개 이미지만 표시됩니다. 선택하면 원본은 공개하지 않고,
                  메타데이터를 제거한 저해상도 무워터마크 전시본을 생성합니다.
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(generatingImageId)}
                onClick={() => setPickerSlot(null)}
                aria-label="닫기"
                className="rounded-lg p-2 text-outline hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="border-b border-outline-variant/30 p-4">
              <div className="relative">
                <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-outline">search</span>
                <input
                  autoFocus
                  value={pickerQuery}
                  onChange={(event) => {
                    setPickerQuery(event.target.value);
                    setPickerPage(1);
                  }}
                  placeholder="제목, 에셋 ID, 태그 검색"
                  className={`${fieldClass} pl-10`}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {pickerError && (
                <div className="mb-4 rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">{pickerError}</div>
              )}
              {pickerLoading ? (
                <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-outline">
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  이미지를 불러오는 중...
                </div>
              ) : pickerImages.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center text-center">
                  <span className="material-symbols-outlined text-4xl text-outline">photo_library</span>
                  <p className="mt-3 text-sm font-bold text-on-surface">선택 가능한 이미지가 없습니다.</p>
                  <p className="mt-1 max-w-md text-xs leading-5 text-outline">
                    승인·공개 상태이면서 사진가가 ‘회사 및 서비스 홍보 활용’에 동의한 이미지만 이 목록에 나타납니다.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {pickerImages.map((image) => (
                    <button
                      key={image.id}
                      type="button"
                      disabled={Boolean(generatingImageId) || !image.storage_path_preview}
                      onClick={() => selectLibraryImage(image)}
                      className="group overflow-hidden rounded-lg border border-outline-variant/40 bg-surface text-left transition hover:border-primary hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-surface-container-low">
                        {image.storage_path_preview ? (
                          <Image
                            src={image.storage_path_preview}
                            alt=""
                            width={480}
                            height={360}
                            unoptimized
                            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
                          />
                        ) : null}
                      </div>
                      <div className="p-3">
                        <p className="truncate text-xs font-extrabold text-on-surface">{image.title}</p>
                        <p className="mt-1 truncate text-[11px] text-outline">
                          {image.asset_id ?? "에셋 ID 없음"}
                          {image.width && image.height ? ` · ${image.width}×${image.height}` : ""}
                        </p>
                        {generatingImageId === image.id && (
                          <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary">
                            <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                            전시본 생성 중
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-outline-variant/30 px-4 py-3">
              <span className="text-xs text-outline">총 {pickerPagination.total.toLocaleString()}개</span>
              <div className="flex items-center gap-2">
                <AdminButton
                  type="button"
                  disabled={pickerPage <= 1 || pickerLoading}
                  onClick={() => setPickerPage((page) => Math.max(1, page - 1))}
                >
                  이전
                </AdminButton>
                <span className="min-w-16 text-center text-xs font-bold text-on-surface">
                  {pickerPagination.page} / {pickerPagination.totalPages}
                </span>
                <AdminButton
                  type="button"
                  disabled={pickerPage >= pickerPagination.totalPages || pickerLoading}
                  onClick={() => setPickerPage((page) => page + 1)}
                >
                  다음
                </AdminButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
