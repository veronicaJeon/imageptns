"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_LEGAL_DOCUMENTS,
  LEGAL_DOCUMENT_SLUGS,
  type LegalDocumentSlug,
} from "@/lib/legal/content";

interface LegalDocumentForm {
  slug: LegalDocumentSlug;
  title: string;
  body: string;
  updatedAt: string | null;
  publishedAt: string | null;
}

const DOCUMENT_LABELS: Record<LegalDocumentSlug, string> = {
  privacy: "개인정보처리방침",
  terms: "이용약관",
  license_guide: "라이선스 안내",
  cookie: "쿠키 정책",
};

function fallbackDocuments(): LegalDocumentForm[] {
  return LEGAL_DOCUMENT_SLUGS.map((slug) => ({
    ...DEFAULT_LEGAL_DOCUMENTS[slug],
    updatedAt: null,
    publishedAt: null,
  }));
}

function formatDate(value: string | null) {
  if (!value) return "저장 이력 없음";
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminLegalPage() {
  const [documents, setDocuments] = useState<LegalDocumentForm[]>(fallbackDocuments);
  const [activeSlug, setActiveSlug] = useState<LegalDocumentSlug>("privacy");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const activeDocument = useMemo(
    () => documents.find((document) => document.slug === activeSlug) ?? documents[0],
    [activeSlug, documents],
  );

  async function loadDocuments() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/legal-documents");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) throw new Error("문서를 불러오지 못했습니다.");
      const data = await res.json() as { documents?: LegalDocumentForm[] };
      setDocuments(data.documents?.length ? data.documents : fallbackDocuments());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "문서를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDocuments(); }, []);

  function updateActiveDocument(patch: Partial<Pick<LegalDocumentForm, "title" | "body">>) {
    setDocuments((current) => current.map((document) => (
      document.slug === activeSlug ? { ...document, ...patch } : document
    )));
  }

  async function handleSave() {
    if (!activeDocument) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/legal-documents", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: activeDocument.slug,
          title: activeDocument.title,
          body: activeDocument.body,
        }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error ?? "저장하지 못했습니다.");
      }

      const data = await res.json() as {
        document?: {
          slug: LegalDocumentSlug;
          title: string;
          body: string;
          updated_at: string | null;
          published_at: string | null;
        };
      };
      if (data.document) {
        setDocuments((current) => current.map((document) => (
          document.slug === data.document?.slug
            ? {
              slug: data.document.slug,
              title: data.document.title,
              body: data.document.body,
              updatedAt: data.document.updated_at,
              publishedAt: data.document.published_at,
            }
            : document
        )));
      }
      setMessage("저장되었습니다. 공개 고지 페이지에 즉시 반영됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-5xl">lock</span>
        <p className="font-bold">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Legal Center</p>
            <h1 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">법률정보 관리</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              개인정보처리방침, 이용약관, 라이선스 안내, 쿠키 정책을 운영자가 직접 편집합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex w-fit items-center gap-2 rounded bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">{saving ? "hourglass_top" : "save"}</span>
            {saving ? "저장 중" : "저장"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="bg-surface-container-lowest p-3 shadow-ghost">
            <div className="flex flex-col gap-1">
              {LEGAL_DOCUMENT_SLUGS.map((slug) => {
                const isActive = slug === activeSlug;
                return (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => setActiveSlug(slug)}
                    className={[
                      "flex items-center justify-between rounded px-3 py-3 text-left text-sm font-semibold transition-colors",
                      isActive ? "bg-primary/10 text-primary" : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
                    ].join(" ")}
                  >
                    <span>{DOCUMENT_LABELS[slug]}</span>
                    {isActive && <span className="material-symbols-outlined text-base">chevron_right</span>}
                  </button>
                );
              })}
              <Link
                href="/admin/legal/disclosure"
                className="mt-2 flex items-center justify-between rounded border-t border-outline-variant/30 px-3 py-3 text-left text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              >
                <span>공시사항</span>
                <span className="material-symbols-outlined text-base">open_in_new</span>
              </Link>
            </div>
          </aside>

          <section className="bg-surface-container-lowest p-5 shadow-ghost md:p-7">
            {loading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : activeDocument ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">문서 제목</label>
                  <input
                    value={activeDocument.title}
                    onChange={(event) => updateActiveDocument({ title: event.target.value })}
                    className="h-12 rounded bg-surface-container px-4 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-widest text-outline">본문</label>
                  <textarea
                    value={activeDocument.body}
                    onChange={(event) => updateActiveDocument({ body: event.target.value })}
                    rows={22}
                    className="min-h-[520px] rounded bg-surface-container px-4 py-3 text-sm leading-relaxed text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-4 text-xs text-outline sm:flex-row sm:items-center sm:justify-between">
                  <span>최근 저장: {formatDate(activeDocument.updatedAt)}</span>
                  <span>공개 반영: {formatDate(activeDocument.publishedAt)}</span>
                </div>
                {message && (
                  <p className="rounded bg-surface-container px-4 py-3 text-sm text-on-surface-variant">{message}</p>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
