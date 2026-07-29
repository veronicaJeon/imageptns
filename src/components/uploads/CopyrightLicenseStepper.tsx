"use client";

import {
  copyrightLicenseFromConditions,
  getCopyrightLicense,
  getLocalizedCopyrightLicense,
  getLocalizedFreeUsagePolicy,
  type CopyrightLicenseCode,
  type FreeUsagePolicyCode,
  type LicenseDisplayLang,
} from "@/lib/licenses/creative-commons";

interface CopyrightLicenseStepperProps {
  lang: LicenseDisplayLang;
  copyrightLicense: CopyrightLicenseCode;
  freeUsagePolicy: FreeUsagePolicyCode;
  onCopyrightLicenseChange: (value: CopyrightLicenseCode) => void;
  onFreeUsagePolicyChange: (value: FreeUsagePolicyCode) => void;
}

const COPY = {
  ko: {
    guide: "세 가지 질문에 답하면 알맞은 라이선스를 자동으로 적용합니다.",
    complete: "설정 완료",
    step1: "수익 창출",
    step2: "무료 공개",
    step3: "사용 조건",
    revenueQuestion: "이 사진으로 수익을 창출(판매)하시겠습니까?",
    paidTitle: "예, 유료 라이선스로 판매할게요",
    paidBody: "판매 수익 정산을 받는 Image Partners Standard가 적용됩니다.",
    freeTitle: "아니요, 무료로 공개할게요",
    freeBody: "공개 범위와 이용 조건을 직접 정할 수 있습니다.",
    paidExample: "뉴스 기사 보도, 출판물·잡지·교재, 상업용 광고, 브랜드 굿즈 제작 등 유료 판매 수수료 정산 대상이 됩니다.",
    freeExample: "커뮤니티, 블로그, 교육 자료 등에서 무료로 활용할 수 있도록 공개합니다.",
    scopeQuestion: "어디까지 무료 사용을 허용할까요?",
    allFree: "누구나 무료 사용",
    allFreeBody: "상업·비상업 여부는 아래 사용 조건에 따라 결정됩니다.",
    educationFree: "교육 목적으로만 무료",
    educationFreeBody: "수업, 연구, 비상업 교육 자료 제작에 한해 무료로 표시합니다.",
    attributionQuestion: "이용자가 출처를 밝혀야 하나요?",
    attributionYes: "네, 출처 표시가 필요해요",
    attributionYesBody: "작가명과 Image Partners 출처가 함께 표시됩니다.",
    attributionNo: "아니요, 별도 작가 표시는 없어도 돼요",
    attributionNoBody: "CC0가 적용됩니다. 단, 플랫폼 정책상 Image Partners 출처는 표시해야 합니다.",
    attributionExample: "블로그 포스팅, 개인 SNS, 비영리 리포트 등에 작가명과 출처 링크가 함께 표시됩니다.",
    cc0Example: "다운로드한 사람이 폭넓게 사용할 수 있지만 Image Partners 출처 문구는 유지해야 합니다.",
    conditionsQuestion: "허용할 사용 조건을 선택해 주세요.",
    commercial: "상업적 이용 허용",
    commercialBody: "광고, 출판물, 유료 콘텐츠, 기업 홍보물 등에 사용할 수 있습니다.",
    derivatives: "이미지 변형·수정 허용",
    derivativesBody: "크롭, 색상 보정, 합성 등 2차 편집을 허용합니다.",
    shareAlike: "동일 조건 변경허락(SA) 필수",
    shareAlikeBody: "수정본도 지금 선택한 것과 같은 라이선스로 공개해야 합니다.",
    shareAlikeDisabled: "이미지 변형을 허용할 때만 선택할 수 있습니다.",
    selected: "자동 적용된 라이선스",
    details: "이 선택은 실제로 어떻게 적용되나요?",
    attributionRequired: "출처 표시 필요",
    attributionPlatform: "Image Partners 출처 표시 필요",
  },
  en: {
    guide: "Answer three questions and we will apply the matching license automatically.",
    complete: "Complete",
    step1: "Monetization",
    step2: "Free access",
    step3: "Usage terms",
    revenueQuestion: "Would you like to earn revenue by selling this photo?",
    paidTitle: "Yes, sell it under a paid license",
    paidBody: "Image Partners Standard applies and sales are eligible for settlement.",
    freeTitle: "No, make it available for free",
    freeBody: "Choose its free-access scope and usage terms.",
    paidExample: "Eligible uses include paid news coverage, publishing, advertising, and branded merchandise, with sales revenue settled to you.",
    freeExample: "Make the image available for use in communities, blogs, learning materials, and more.",
    scopeQuestion: "Who can use it for free?",
    allFree: "Free for everyone",
    allFreeBody: "Commercial and non-commercial uses follow the conditions in the next step.",
    educationFree: "Free for education only",
    educationFreeBody: "Marked free for classes, research, and non-commercial learning materials.",
    attributionQuestion: "Must users credit the source?",
    attributionYes: "Yes, source credit is required",
    attributionYesBody: "Your credit and Image Partners will be shown together.",
    attributionNo: "No separate creator credit required",
    attributionNoBody: "CC0 applies, but Image Partners source credit remains required by platform policy.",
    attributionExample: "Your creator name and source link can appear on blog posts, social media, and non-profit reports.",
    cc0Example: "Users may reuse it broadly, while retaining the Image Partners source line.",
    conditionsQuestion: "Select the usage conditions you want to allow.",
    commercial: "Allow commercial use",
    commercialBody: "Allows publishing, advertising, paid content, and corporate promotional materials.",
    derivatives: "Allow edits and modifications",
    derivativesBody: "Allows cropping, color correction, compositing, and other edits.",
    shareAlike: "Require ShareAlike (SA)",
    shareAlikeBody: "Adaptations must use the same license you select here.",
    shareAlikeDisabled: "Available only when modifications are allowed.",
    selected: "Automatically applied license",
    details: "How will this selection work in practice?",
    attributionRequired: "Creator credit required",
    attributionPlatform: "Image Partners source credit required",
  },
} as const;

function InfoTip({ label, text }: { label: string; text: string }) {
  return (
    <details className="group relative inline-block align-middle">
      <summary
        aria-label={label}
        className="ml-1 inline-flex h-5 w-5 cursor-pointer list-none items-center justify-center rounded-full border border-outline-variant text-[11px] font-black text-outline transition-colors hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary [&::-webkit-details-marker]:hidden"
      >
        ?
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-outline-variant/50 bg-on-surface px-3 py-2 text-left text-xs font-medium leading-relaxed text-surface shadow-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
        {text}
      </div>
    </details>
  );
}

function ChoiceCard({
  name,
  checked,
  onChange,
  title,
  description,
  tooltip,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
  tooltip?: string;
}) {
  return (
    <div className="group relative h-full">
      <label className="block h-full cursor-pointer">
        <input type="radio" name={name} checked={checked} onChange={onChange} className="peer sr-only" />
        <span className="flex h-full gap-3 rounded-xl border border-outline-variant/50 bg-surface-container-low px-4 py-4 pr-11 transition-all group-hover:border-outline peer-checked:border-primary peer-checked:bg-primary/5 peer-focus-visible:ring-2 peer-focus-visible:ring-primary">
          <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${checked ? "border-primary" : "border-outline-variant"}`}>
            {checked && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-on-surface">{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{description}</span>
          </span>
        </span>
      </label>
      {tooltip && <span className="absolute right-4 top-4 z-10"><InfoTip label={`${title}: ${tooltip}`} text={tooltip} /></span>}
    </div>
  );
}

function ConditionToggle({
  checked,
  onChange,
  title,
  description,
  disabled = false,
  disabledText,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  disabled?: boolean;
  disabledText?: string;
}) {
  return (
    <div className="relative h-full">
      <label className={`flex h-full items-start justify-between gap-4 rounded-xl border px-4 py-3 pr-16 transition-colors ${disabled ? "cursor-not-allowed border-outline-variant/30 bg-surface-container-low/60 opacity-60" : "cursor-pointer border-outline-variant/50 bg-surface-container-low hover:border-outline"}`}>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-on-surface">{title}</span>
          <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">{disabled ? disabledText : description}</span>
        </span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute right-4 top-3.5 h-6 w-11 shrink-0 rounded-full bg-outline-variant transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-disabled:opacity-50">
          <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
        </span>
      </label>
      <span className="absolute right-[4.25rem] top-3.5 z-10"><InfoTip label={`${title}: ${description}`} text={description} /></span>
    </div>
  );
}

export function CopyrightLicenseStepper({
  lang,
  copyrightLicense,
  freeUsagePolicy,
  onCopyrightLicenseChange,
  onFreeUsagePolicyChange,
}: CopyrightLicenseStepperProps) {
  const copy = COPY[lang];
  const isPaid = copyrightLicense === "standard";
  const requiresAttribution = copyrightLicense !== "cc0";
  const selectedLicense = getLocalizedCopyrightLicense(copyrightLicense, lang);
  const selectedPolicy = getLocalizedFreeUsagePolicy(freeUsagePolicy, lang);
  const conditions = getCopyrightLicense(copyrightLicense === "standard" || copyrightLicense === "cc0" ? "cc_by" : copyrightLicense);

  function choosePaid() {
    onCopyrightLicenseChange("standard");
    onFreeUsagePolicyChange("none");
  }

  function chooseFree() {
    onCopyrightLicenseChange("cc_by");
    onFreeUsagePolicyChange(freeUsagePolicy === "education" ? "education" : "all");
  }

  function updateConditions(patch: Partial<{
    allowsCommercialUse: boolean;
    allowsDerivatives: boolean;
    requiresShareAlike: boolean;
  }>) {
    const next = {
      allowsCommercialUse: patch.allowsCommercialUse ?? conditions.allowsCommercialUse,
      allowsDerivatives: patch.allowsDerivatives ?? conditions.allowsDerivatives,
      requiresShareAlike: patch.requiresShareAlike ?? conditions.requiresShareAlike,
    };
    if (!next.allowsDerivatives) next.requiresShareAlike = false;
    onCopyrightLicenseChange(copyrightLicenseFromConditions(next));
  }

  const usageExample = isPaid
    ? copy.paidExample
    : copyrightLicense === "cc0"
      ? copy.cc0Example
      : `${copy.attributionExample} ${selectedLicense.summary}`;

  return (
    <div className="flex flex-col gap-5" data-testid="copyright-license-stepper">
      <div className="grid grid-cols-3 gap-2" aria-label={copy.guide}>
        {[copy.step1, copy.step2, copy.step3].map((label, index) => {
          const active = index === 0 || !isPaid;
          const complete = index === 0 || !isPaid;
          return (
            <div key={label} className="relative flex min-w-0 flex-col items-center text-center">
              {index > 0 && <span className={`absolute right-1/2 top-4 -z-0 h-px w-full ${active ? "bg-primary/40" : "bg-outline-variant/50"}`} />}
              <span className={`relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black ${complete ? "border-primary bg-primary text-on-primary" : active ? "border-primary bg-surface text-primary" : "border-outline-variant bg-surface text-outline"}`}>
                {complete ? <span className="material-symbols-outlined text-base">check</span> : index + 1}
              </span>
              <span className={`mt-2 truncate text-[11px] font-bold sm:text-xs ${active ? "text-on-surface" : "text-outline"}`}>{label}</span>
            </div>
          );
        })}
      </div>

      <section className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-on-primary">1</span>
          <div>
            <p className="text-sm font-extrabold text-on-surface">{copy.revenueQuestion}</p>
            <p className="mt-1 text-xs text-on-surface-variant">{copy.guide}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <ChoiceCard name="license_revenue_track" checked={isPaid} onChange={choosePaid} title={copy.paidTitle} description={copy.paidBody} tooltip={copy.paidExample} />
          <ChoiceCard name="license_revenue_track" checked={!isPaid} onChange={chooseFree} title={copy.freeTitle} description={copy.freeBody} tooltip={copy.freeExample} />
        </div>
      </section>

      {!isPaid && (
        <section className="rounded-xl border border-primary/25 bg-primary/[0.025] p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-on-primary">2</span>
            <p className="pt-1 text-sm font-extrabold text-on-surface">{copy.step2}</p>
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-3 text-sm font-bold text-on-surface">{copy.scopeQuestion}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard name="free_usage_scope" checked={freeUsagePolicy === "all"} onChange={() => onFreeUsagePolicyChange("all")} title={copy.allFree} description={copy.allFreeBody} />
                <ChoiceCard name="free_usage_scope" checked={freeUsagePolicy === "education"} onChange={() => onFreeUsagePolicyChange("education")} title={copy.educationFree} description={copy.educationFreeBody} />
              </div>
            </div>

            <div className="border-t border-outline-variant/30 pt-5">
              <p className="mb-3 text-sm font-bold text-on-surface">{copy.attributionQuestion}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <ChoiceCard name="license_attribution" checked={requiresAttribution} onChange={() => onCopyrightLicenseChange(copyrightLicense === "cc0" ? "cc_by" : copyrightLicense)} title={copy.attributionYes} description={copy.attributionYesBody} tooltip={copy.attributionExample} />
                <ChoiceCard name="license_attribution" checked={!requiresAttribution} onChange={() => onCopyrightLicenseChange("cc0")} title={copy.attributionNo} description={copy.attributionNoBody} tooltip={copy.cc0Example} />
              </div>
            </div>
          </div>
        </section>
      )}

      {!isPaid && requiresAttribution && (
        <section className="rounded-xl border border-primary/25 bg-primary/[0.025] p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-on-primary">3</span>
            <p className="pt-1 text-sm font-extrabold text-on-surface">{copy.conditionsQuestion}</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <ConditionToggle checked={conditions.allowsCommercialUse} onChange={(value) => updateConditions({ allowsCommercialUse: value })} title={copy.commercial} description={copy.commercialBody} />
            <ConditionToggle checked={conditions.allowsDerivatives} onChange={(value) => updateConditions({ allowsDerivatives: value })} title={copy.derivatives} description={copy.derivativesBody} />
            <ConditionToggle checked={conditions.requiresShareAlike} onChange={(value) => updateConditions({ requiresShareAlike: value })} title={copy.shareAlike} description={copy.shareAlikeBody} disabled={!conditions.allowsDerivatives} disabledText={copy.shareAlikeDisabled} />
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-xl border border-primary/25 bg-primary/5">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="material-symbols-outlined mt-0.5 text-xl text-primary">verified</span>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-primary">{copy.selected}</p>
              <p className="mt-0.5 text-sm font-extrabold text-on-surface">{selectedLicense.label}</p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {isPaid ? copy.complete : `${selectedPolicy.label} · ${requiresAttribution ? copy.attributionRequired : copy.attributionPlatform}`}
              </p>
            </div>
          </div>
        </div>
        <details className="group border-t border-primary/15 px-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-xs font-bold text-on-surface [&::-webkit-details-marker]:hidden">
            {copy.details}
            <span className="material-symbols-outlined text-lg text-outline transition-transform group-open:rotate-180">expand_more</span>
          </summary>
          <p className="pb-4 text-xs leading-relaxed text-on-surface-variant">{usageExample}</p>
        </details>
      </div>
    </div>
  );
}
