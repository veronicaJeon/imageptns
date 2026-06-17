"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";
import { draftPhotoRequestFromSearchParams } from "@/lib/contact/photo-request-draft";
import { validatePhotoRequestBuyerFields } from "@/lib/contact/request-fields";
import { cn } from "@/lib/utils/cn";

type ContactMode = "general" | "photo";
type SourcingPurpose = "rights_check" | "similar_search" | "supply_check" | "context_reference" | "shooting_request";

const SOURCING_PURPOSE_OPTIONS: Array<{ value: SourcingPurpose; label: string }> = [
  { value: "rights_check", label: "이 이미지와 완전히 같은 사진의 권리 확인이 필요합니다" },
  { value: "similar_search", label: "이 이미지와 유사한 사진이 필요합니다" },
  { value: "context_reference", label: "이 자료는 설명을 위한 참고일 뿐입니다" },
  { value: "shooting_request", label: "필요한 경우 신규 촬영 의뢰도 검토하고 싶습니다" },
];

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
    requester_organization: "",
    usage_project: "",
    usage_context: "",
    deadline_at: "",
    reference_url: "",
    reference_note: "",
    sourcing_purposes: ["similar_search"] as SourcingPurpose[],
  });
  const [showAdvancedUsage, setShowAdvancedUsage] = useState(false);
  const [advancedUsage, setAdvancedUsage] = useState({
    publication_type: "",
    territory: "",
    digital_use: "",
    reuse_intent: "",
  });
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
      setPhotoForm((prev) => ({
        ...prev,
        requester_organization: prev.requester_organization || user.organization || "",
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
    setPhotoForm((prev) => ({
      ...prev,
      title: prev.title || draft.title,
      brief: prev.brief || draft.brief,
      usage_context: prev.usage_context || draft.usage_context,
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
      setError("이미지 소싱 요청은 로그인 후 접수할 수 있습니다.");
      setLoading(false);
      return;
    }

    if (!photoForm.title.trim()) {
      setError("요청 제목을 입력해주세요. 예: 백제 금동대향로 사진 후보 요청");
      setLoading(false);
      return;
    }
    if (!photoForm.brief.trim()) {
      setError("찾고 있는 이미지 설명을 입력해주세요. 필요한 장면, 대상, 피해야 할 요소를 편하게 적어도 괜찮습니다.");
      setLoading(false);
      return;
    }

    const buyerValidationError = validatePhotoRequestBuyerFields({
      requester_organization: photoForm.requester_organization,
      usage_project: photoForm.usage_project,
      usage_context: photoForm.usage_context,
      deadline_at: photoForm.deadline_at ? `${photoForm.deadline_at}T23:59:59.000Z` : "",
      reference_url: photoForm.reference_url,
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
          requester_organization: photoForm.requester_organization,
          usage_project: photoForm.usage_project,
          usage_context: photoForm.usage_context,
          deadline_at: photoForm.deadline_at ? `${photoForm.deadline_at}T23:59:59.000Z` : null,
          reference_url: photoForm.reference_url.trim() || null,
          reference_note: [
            photoForm.reference_note.trim(),
            advancedUsage.publication_type ? `발행 형태: ${advancedUsage.publication_type}` : "",
            advancedUsage.territory ? `사용 범위: ${advancedUsage.territory}` : "",
            advancedUsage.digital_use ? `전자책/온라인 포함: ${advancedUsage.digital_use}` : "",
            advancedUsage.reuse_intent ? `반복 사용: ${advancedUsage.reuse_intent}` : "",
          ].filter(Boolean).join("\n") || null,
          sourcing_purposes: photoForm.sourcing_purposes,
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
                {!isLoggedIn && (
                  <div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-on-surface">
                    <p className="font-semibold text-primary">이미지 소싱 요청은 로그인 후 접수할 수 있습니다.</p>
                    <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                      출판 프로젝트 정보와 요청 이력을 안전하게 관리하기 위해 회원 로그인 후 요청을 받을게요.
                    </p>
                    <a href="/login?next=/contact?mode=photo" className="mt-3 inline-flex text-xs font-bold text-primary hover:underline">
                      로그인하러 가기
                    </a>
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 text-sm text-error md:col-span-2">
                    {error}
                  </div>
                )}

                <div className="md:col-span-2 rounded-lg bg-surface-container-lowest p-4 ring-1 ring-outline-variant">
                  <p className="text-sm font-semibold text-on-surface">필요한 이미지를 편하게 설명해주세요.</p>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    담당자가 후보 이미지, 권리 확인 가능성, 필요한 경우 촬영 의뢰 가능성을 검토해 답변합니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">요청 제목 <span className="text-error">*</span></label>
                  <input
                    type="text"
                    value={photoForm.title}
                    onChange={setPhoto("title")}
                    placeholder="예: 백제 금동대향로 사진 후보 요청"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">찾고 있는 이미지 설명 <span className="text-error">*</span></label>
                  <textarea
                    value={photoForm.brief}
                    onChange={setPhoto("brief")}
                    rows={5}
                    placeholder="예: 한국사 교재 백제 파트에 넣을 금동대향로 사진이 필요합니다. 유물 전체가 잘 보이고 배경이 너무 복잡하지 않았으면 합니다."
                    className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-y min-h-32 transition-all"
                  />
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    문장으로 길게 써도 좋고, 필요한 컷·분위기·피해야 할 요소를 짧게 적어도 충분합니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">요청자 소속 <span className="text-error">*</span></label>
                  <input
                    type="text"
                    value={photoForm.requester_organization}
                    onChange={setPhoto("requester_organization")}
                    placeholder="예: ○○출판사, 국립○○박물관, 프리랜서"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">사용 프로젝트 <span className="text-error">*</span></label>
                  <input
                    type="text"
                    value={photoForm.usage_project}
                    onChange={setPhoto("usage_project")}
                    placeholder="예: 중학교 한국사 보조교재"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">사용 맥락 <span className="text-error">*</span></label>
                  <textarea
                    value={photoForm.usage_context}
                    onChange={setPhoto("usage_context")}
                    rows={4}
                    placeholder="예: 백제 문화의 공예 수준을 설명하는 본문 옆 삽입 이미지로 사용합니다."
                    className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-y min-h-28 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">희망 회신일 <span className="text-error">*</span></label>
                  <input
                    type="date"
                    value={photoForm.deadline_at}
                    onChange={setPhoto("deadline_at")}
                    min={dateInputValue(1)}
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none transition-all"
                  />
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    기본값은 2주 뒤입니다. 합리적인 검토 일정을 기준으로 먼저 제안합니다.
                  </p>
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">참고 URL / 샘플 이미지 URL</label>
                  <input
                    type="url"
                    value={photoForm.reference_url}
                    onChange={setPhoto("reference_url")}
                    placeholder="https://example.com/reference"
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2 md:col-span-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">참고 설명</label>
                  <textarea
                    value={photoForm.reference_note}
                    onChange={setPhoto("reference_note")}
                    rows={3}
                    placeholder="예: 이 링크의 구도만 참고해주세요. / 이 이미지는 너무 어둡고 색감만 참고해주세요."
                    className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-y min-h-24 transition-all"
                  />
                  <p className="text-xs leading-relaxed text-on-surface-variant">
                    참고자료에서 따라가야 할 점과 피해야 할 점을 적어주세요.
                  </p>
                </div>

                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">참고자료를 어떻게 활용하면 될까요?</label>
                  <div className="grid grid-cols-1 gap-2">
                    {SOURCING_PURPOSE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex items-start gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-3 text-sm text-on-surface-variant"
                      >
                        <input
                          type="checkbox"
                          checked={photoForm.sourcing_purposes.includes(option.value)}
                          onChange={(event) => toggleSourcingPurpose(option.value, event.target.checked)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2 rounded-lg bg-surface-container-lowest ring-1 ring-outline-variant">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedUsage((value) => !value)}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-on-surface"
                  >
                    알고 있다면 추가 입력
                    <span className="material-symbols-outlined text-lg">{showAdvancedUsage ? "expand_less" : "expand_more"}</span>
                  </button>
                  {showAdvancedUsage && (
                    <div className="grid grid-cols-1 gap-4 border-t border-outline-variant p-4 md:grid-cols-2">
                      {([
                        ["publication_type", "발행 형태", "예: 단행본, 교재, 잡지, 전시, 웹"],
                        ["territory", "사용 범위", "예: 국내, 해외 포함, 미정"],
                        ["digital_use", "전자책/온라인 포함 여부", "예: 포함, 미포함, 미정"],
                        ["reuse_intent", "반복 사용 희망 여부", "예: 이번 프로젝트만, 향후 재사용 가능성 있음"],
                      ] as const).map(([key, label, placeholder]) => (
                        <div key={key} className="flex flex-col gap-2">
                          <label className="text-xs font-bold text-outline uppercase tracking-widest">{label}</label>
                          <input
                            type="text"
                            value={advancedUsage[key]}
                            onChange={(event) => setAdvancedUsage((prev) => ({ ...prev, [key]: event.target.value }))}
                            placeholder={placeholder}
                            className="h-11 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-3 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !isLoggedIn}
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
