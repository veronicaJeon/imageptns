"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";
import { draftPhotoRequestFromSearchParams } from "@/lib/contact/photo-request-draft";
import { validatePhotoRequestBuyerFields } from "@/lib/contact/request-fields";
import { cn } from "@/lib/utils/cn";

type ContactMode = "general" | "photo";
type SourcingPurpose = "rights_check" | "similar_search" | "supply_check";

const CATEGORY_OPTIONS = [
  { value: "editorial", label: "에디토리얼" },
  { value: "people", label: "인물" },
  { value: "urban", label: "도시/공간" },
  { value: "architecture", label: "건축" },
  { value: "nature", label: "자연" },
  { value: "abstract", label: "추상/그래픽" },
];

const LICENSE_OPTIONS = [
  { value: "editorial", label: "에디토리얼" },
  { value: "commercial", label: "커머셜" },
  { value: "extended", label: "익스텐디드" },
  { value: "not_sure", label: "상담 필요" },
];

const SOURCING_PURPOSE_OPTIONS: Array<{ value: SourcingPurpose; label: string }> = [
  { value: "rights_check", label: "권리 확인" },
  { value: "similar_search", label: "유사 이미지 탐색" },
  { value: "supply_check", label: "신규 촬영/보유 이미지 확인" },
];

function splitList(value: string) {
  return value
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function numericOrNull(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : null;
}

function dateInputValue(daysFromToday: number) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ContactPageContent() {
  const { t } = useLang();
  const c = t.contact;
  const f = c.form;
  const searchParams = useSearchParams();

  const { user, init } = useAuth();
  const [mode, setMode] = useState<ContactMode>("general");
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [photoForm, setPhotoForm] = useState({
    title: "",
    brief: "",
    location_label: "",
    target_regions: "",
    category: "editorial",
    tags: "",
    usage_intent: "",
    license_intent: "not_sure",
    budget_min_krw: "",
    budget_max_krw: "",
    deadline_at: "",
    reference_url: "",
    reference_note: "",
    sourcing_purposes: ["similar_search"] as SourcingPurpose[],
    non_copying_attested: false,
  });
  const [draftLocationGuidance, setDraftLocationGuidance] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { init(); }, [init]);

  // Auto-fill name and email when user is loaded
  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        name:  prev.name  || user.full_name || "",
        email: prev.email || user.email     || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    setSent(false);
    setError("");
  }, [mode]);

  useEffect(() => {
    if (mode !== "photo" || photoForm.deadline_at) return;
    setPhotoForm((prev) => ({ ...prev, deadline_at: prev.deadline_at || dateInputValue(14) }));
  }, [mode, photoForm.deadline_at]);

  useEffect(() => {
    const draft = draftPhotoRequestFromSearchParams(searchParams);
    if (draft.mode !== "photo") return;

    setMode("photo");
    setDraftLocationGuidance(draft.location_guidance);
    setPhotoForm((prev) => ({
      ...prev,
      title: prev.title || draft.title,
      brief: prev.brief || draft.brief,
      category: draft.category,
      tags: prev.tags || draft.tags,
      usage_intent: prev.usage_intent || draft.usage_intent,
      sourcing_purposes: draft.sourcing_purposes.length > 0 ? draft.sourcing_purposes : prev.sourcing_purposes,
    }));
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "문의 접수에 실패했습니다.");
      }
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "문의 접수에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePhotoSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!user) {
      window.location.href = "/login?next=/contact";
      return;
    }

    const budgetMin = numericOrNull(photoForm.budget_min_krw);
    const budgetMax = numericOrNull(photoForm.budget_max_krw);

    if (!photoForm.title.trim()) {
      setError("요청 제목을 입력해주세요. 예: 성수동 카페 외관 및 실내 컷");
      setLoading(false);
      return;
    }
    if (!photoForm.brief.trim()) {
      setError("상세 브리프를 입력해주세요. 필요한 장면, 분위기, 납품 형태를 간단히 적어도 괜찮습니다.");
      setLoading(false);
      return;
    }
    if (!photoForm.location_label.trim()) {
      setError("촬영 위치를 입력해주세요. 정확한 주소가 아니어도 지역명이나 랜드마크면 됩니다.");
      setLoading(false);
      return;
    }
    if (splitList(photoForm.target_regions).length === 0) {
      setError("대상 지역을 입력해주세요. 작가를 찾을 시/군/구나 권역을 쉼표로 구분해 적어주세요.");
      setLoading(false);
      return;
    }

    const buyerValidationError = validatePhotoRequestBuyerFields({
      usage_intent: photoForm.usage_intent,
      budget_min_krw: budgetMin,
      budget_max_krw: budgetMax,
      deadline_at: photoForm.deadline_at ? `${photoForm.deadline_at}T23:59:59.000Z` : "",
      reference_url: photoForm.reference_url,
      non_copying_attested: photoForm.non_copying_attested,
    });
    if (buyerValidationError) {
      setError(buyerValidationError);
      setLoading(false);
      return;
    }

    try {
      const buyerName = user.full_name || form.name || "Image Partners Buyer";
      const buyerEmail = user.email || form.email;
      if (!buyerEmail) {
        throw new Error("로그인 이메일을 확인할 수 없습니다. 다시 로그인 후 접수해주세요.");
      }
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: buyerName,
          email: buyerEmail,
          subject: photoForm.title,
          message: photoForm.brief,
          inquiry_type: "photo_request",
          location_label: photoForm.location_label,
          target_regions: splitList(photoForm.target_regions),
          category: photoForm.category,
          tags: splitList(photoForm.tags),
          usage_intent: photoForm.usage_intent,
          license_intent: photoForm.license_intent,
          budget_min_krw: budgetMin,
          budget_max_krw: budgetMax,
          deadline_at: photoForm.deadline_at ? `${photoForm.deadline_at}T23:59:59.000Z` : null,
          reference_url: photoForm.reference_url.trim() || null,
          reference_note: photoForm.reference_note.trim() || null,
          sourcing_purposes: photoForm.sourcing_purposes,
          non_copying_attested: photoForm.non_copying_attested,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "이미지 소싱 요청 접수에 실패했습니다.");
      }
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "이미지 소싱 요청 접수에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  function setPhoto(key: keyof typeof photoForm) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target instanceof HTMLInputElement && e.target.type === "checkbox"
        ? e.target.checked
        : e.target.value;
      setPhotoForm((prev) => ({ ...prev, [key]: value }));
    };
  }

  function toggleSourcingPurpose(value: SourcingPurpose, checked: boolean) {
    setPhotoForm((prev) => {
      const next = checked
        ? Array.from(new Set([...prev.sourcing_purposes, value]))
        : prev.sourcing_purposes.filter((purpose) => purpose !== value);
      return { ...prev, sourcing_purposes: next.length > 0 ? next : ["similar_search"] };
    });
  }

  const isLoggedIn = !!user;

  return (
    <>
      {/* ── Hero ── */}
      <section className="pt-36 pb-16 px-6 bg-surface">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-3">
            {c.hero.headline}
          </h1>
          <p className="text-on-surface-variant">{c.hero.sub}</p>
        </div>
      </section>

      {/* ── Content ── */}
      <section className="pb-24 px-6 bg-surface">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12">

          {/* Form */}
          <div className="md:col-span-3">
            <div className="mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-container-lowest p-1 shadow-ghost">
              {([
                { key: "general", label: "일반 문의", icon: "support_agent" },
                { key: "photo", label: "이미지 소싱 요청", icon: "travel_explore" },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setMode(item.key)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 whitespace-nowrap",
                    mode === item.key
                      ? "bg-primary text-white shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  <span className="material-symbols-outlined text-base">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>

            {sent ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <span className="material-symbols-outlined text-6xl text-primary">
                  {mode === "photo" ? "assignment_turned_in" : "mark_email_read"}
                </span>
                <p className="text-on-surface font-semibold">
                  {mode === "photo" ? "이미지 소싱 요청이 접수되었습니다." : c.success}
                </p>
                <button
                  type="button"
                  onClick={() => setSent(false)}
                  className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-70"
                >
                  새로 작성
                </button>
              </div>
            ) : mode === "general" ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {error && (
                  <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
                    {error}
                  </div>
                )}
                {/* Name */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">{f.name}</label>
                  <input
                    type="text" required value={form.name} onChange={set("name")}
                    placeholder={f.namePlaceholder}
                    readOnly={isLoggedIn}
                    className={`h-12 ring-1 ring-outline-variant rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all ${
                      isLoggedIn
                        ? "bg-surface-container-low cursor-default"
                        : "bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                    }`}
                  />
                </div>
                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">{f.email}</label>
                  <input
                    type="email" required value={form.email} onChange={set("email")}
                    placeholder={f.emailPlaceholder}
                    readOnly={isLoggedIn}
                    className={`h-12 ring-1 ring-outline-variant rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all ${
                      isLoggedIn
                        ? "bg-surface-container-low cursor-default"
                        : "bg-surface-container-lowest focus:ring-2 focus:ring-primary"
                    }`}
                  />
                </div>
                {/* Subject */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">{f.subject}</label>
                  <input type="text" required value={form.subject} onChange={set("subject")} placeholder={f.subjectPlaceholder}
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all" />
                </div>
                {/* Message */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">{f.message}</label>
                  <textarea required value={form.message} onChange={set("message")} rows={6} placeholder={f.messagePlaceholder}
                    className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all" />
                </div>

                <button type="submit" disabled={loading}
                  className="flex items-center justify-center gap-2 py-4 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50">
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><span className="material-symbols-outlined text-base">send</span>{f.submit}</>
                  }
                </button>
              </form>
            ) : (
              <form onSubmit={handlePhotoSubmit} noValidate className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {error && (
                  <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error md:col-span-2">
                    {error}
                  </div>
                )}

                <div className="md:col-span-2 rounded-lg bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
                  <p className="text-sm font-semibold text-on-surface">필요한 이미지를 자연어로 요청할 수 있습니다.</p>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    권리 확인, 유사 이미지 탐색, 내부 보유 이미지 확인이 함께 필요할 수 있습니다. 답변과 후보 이미지는 담당자가 검토 후 발송합니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">요청 제목</label>
                  <input
                    type="text"
                    value={photoForm.title}
                    onChange={setPhoto("title")}
                    placeholder="예: 성수동 카페 외관 및 실내 컷"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">필요한 이미지 설명</label>
                  <textarea
                    value={photoForm.brief}
                    onChange={setPhoto("brief")}
                    rows={5}
                    placeholder="필요한 장면, 분위기, 촬영 대상, 납품 형태를 적어주세요."
                    className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-y min-h-32 transition-all"
                  />
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    문장으로 길게 쓰지 않아도 됩니다. 필요한 컷, 분위기, 피해야 할 요소만 적어도 충분합니다.
                  </p>
                </div>

                {draftLocationGuidance && (
                  <div className="md:col-span-2 rounded-lg bg-primary/5 px-4 py-3 text-xs leading-relaxed text-primary ring-1 ring-primary/15">
                    {draftLocationGuidance}
                  </div>
                )}

                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">요청 유형</label>
                  <div className="flex flex-wrap gap-2">
                    {SOURCING_PURPOSE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 rounded-full border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant"
                      >
                        <input
                          type="checkbox"
                          checked={photoForm.sourcing_purposes.includes(option.value)}
                          onChange={(event) => toggleSourcingPurpose(option.value, event.target.checked)}
                          className="h-4 w-4 accent-primary"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">촬영 위치</label>
                  <input
                    type="text"
                    value={photoForm.location_label}
                    onChange={setPhoto("location_label")}
                    placeholder="서울 성동구 성수동"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    정확한 주소가 없어도 됩니다. 지역명, 랜드마크, 촬영 장소 성격을 적어주세요.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">대상 지역</label>
                  <input
                    type="text"
                    value={photoForm.target_regions}
                    onChange={setPhoto("target_regions")}
                    placeholder="서울, 성수, 수도권"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    작가를 찾을 지역입니다. 여러 곳이면 쉼표로 구분해주세요.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">카테고리</label>
                  <select
                    value={photoForm.category}
                    onChange={setPhoto("category")}
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none transition-all"
                  >
                    {CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">태그</label>
                  <input
                    type="text"
                    value={photoForm.tags}
                    onChange={setPhoto("tags")}
                    placeholder="카페, 라이프스타일, 인테리어"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">사용 목적</label>
                  <input
                    type="text"
                    value={photoForm.usage_intent}
                    onChange={setPhoto("usage_intent")}
                    placeholder="기사, 캠페인, 웹사이트, 인쇄물 등"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">라이선스 의도</label>
                  <select
                    value={photoForm.license_intent}
                    onChange={setPhoto("license_intent")}
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none transition-all"
                  >
                    {LICENSE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">희망 마감일</label>
                  <input
                    type="date"
                    value={photoForm.deadline_at}
                    onChange={setPhoto("deadline_at")}
                    min={dateInputValue(1)}
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none transition-all"
                  />
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    기본값은 2주 뒤입니다. 더 급한 일정이면 담당자가 가능 여부를 확인합니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">최소 예산</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={photoForm.budget_min_krw}
                    onChange={setPhoto("budget_min_krw")}
                    placeholder="500000"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">최대 예산</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={photoForm.budget_max_krw}
                    onChange={setPhoto("budget_max_krw")}
                    placeholder="1200000"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    정확한 견적이 아니어도 됩니다. 최종 가격은 작가 조건과 사용 범위를 보고 검토합니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">참고 URL</label>
                  <input
                    type="url"
                    value={photoForm.reference_url}
                    onChange={setPhoto("reference_url")}
                    placeholder="https://example.com/reference"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">참고 메모</label>
                  <textarea
                    value={photoForm.reference_note}
                    onChange={setPhoto("reference_note")}
                    rows={3}
                    placeholder="참고자료에서 필요한 방향과 피해야 할 점을 적어주세요."
                    className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-y min-h-24 transition-all"
                  />
                </div>

                <label className="md:col-span-2 flex items-start gap-3 rounded-lg bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
                  <input
                    type="checkbox"
                    checked={photoForm.non_copying_attested}
                    onChange={setPhoto("non_copying_attested")}
                    className="mt-1 h-4 w-4 accent-primary"
                  />
                  <span className="text-sm leading-relaxed text-on-surface-variant">
                    참고 이미지는 방향성 공유용이며, 타인의 저작물을 그대로 복제하거나 혼동될 정도로 유사한 결과물을 요구하지 않습니다.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="md:col-span-2 flex items-center justify-center gap-2 py-4 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><span className="material-symbols-outlined text-base">send</span>이미지 소싱 요청 접수</>
                  }
                </button>
              </form>
            )}
          </div>

          {/* Info */}
          <div className="md:col-span-2">
            <div className="bg-surface-container-lowest shadow-ghost p-8 flex flex-col gap-6">
              <h3 className="font-headline text-lg font-bold text-on-surface">{c.info.title}</h3>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">mail</span>
                <div>
                  <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">Email</p>
                  <a href={`mailto:${c.info.email}`} className="text-sm text-on-surface hover:text-primary transition-colors">{c.info.email}</a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">schedule</span>
                <div>
                  <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">{c.info.hours}</p>
                  <p className="text-sm text-on-surface">{c.info.hoursVal}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">timer</span>
                <div>
                  <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">{c.info.response}</p>
                  <p className="text-sm text-on-surface">{c.info.responseVal}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactPageContent />
    </Suspense>
  );
}
