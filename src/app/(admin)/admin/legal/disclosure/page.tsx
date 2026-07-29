"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_BUSINESS_DISCLOSURE,
  disclosureIsCompleteForPaidCommerce,
  type BusinessDisclosure,
} from "@/lib/legal/disclosure";

const FIELD_ROWS = [
  { key: "business_name", visible: "show_business_name", label: "상호", required: true },
  { key: "representative_name", visible: "show_representative_name", label: "대표자명", required: true },
  { key: "business_registration_number", visible: "show_business_registration_number", label: "사업자등록번호", required: true },
  { key: "address", visible: "show_address", label: "사업장 주소", required: true },
  { key: "public_phone", visible: "show_public_phone", label: "공개 전화번호", required: true },
  { key: "public_email", visible: "show_public_email", label: "공개 이메일", required: true },
] as const;

export default function AdminLegalDisclosurePage() {
  const [form, setForm] = useState<BusinessDisclosure>(DEFAULT_BUSINESS_DISCLOSURE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const commerceReady = useMemo(() => disclosureIsCompleteForPaidCommerce(form), [form]);

  useEffect(() => {
    fetch("/api/admin/legal-disclosure")
      .then(async (res) => {
        if (res.status === 403) {
          setForbidden(true);
          return null;
        }
        if (!res.ok) throw new Error("공시사항을 불러오지 못했습니다.");
        return res.json() as Promise<{ disclosure?: BusinessDisclosure }>;
      })
      .then((data) => {
        if (data?.disclosure) setForm({ ...DEFAULT_BUSINESS_DISCLOSURE, ...data.disclosure });
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "공시사항을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  function patch(patchValue: Partial<BusinessDisclosure>) {
    setForm((current) => ({ ...current, ...patchValue }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/legal-disclosure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({})) as {
        disclosure?: BusinessDisclosure;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "공시사항을 저장하지 못했습니다.");
      if (data.disclosure) setForm({ ...DEFAULT_BUSINESS_DISCLOSURE, ...data.disclosure });
      setMessage(form.is_published
        ? "공시사항을 저장하고 공개했습니다."
        : "공시사항을 미공개 초안으로 저장했습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "공시사항을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return <div className="p-10 text-center font-bold text-outline">관리자 권한이 필요합니다.</div>;
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/admin/legal" className="text-xs font-bold text-primary hover:underline">
              법률정보 관리
            </Link>
            <h1 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">공시사항</h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              사업자 신원정보와 환불·증빙 정책을 초안으로 저장하거나 공개합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving || loading}
            className="flex w-fit items-center gap-2 rounded bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">{saving ? "hourglass_top" : "save"}</span>
            {saving ? "저장 중" : "공시사항 저장"}
          </button>
        </div>

        <div className="mb-6 rounded border border-amber-300 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-900">
          <strong>유료 거래 공개 전 확인:</strong> 상호, 대표자명, 주소, 전화번호, 이메일,
          사업자등록번호와 통신판매업 신고 확인정보를 모두 입력·공개해야 합니다.
          개별 공개 스위치를 끈 상태는 초안 관리용이며 유료 청약 화면과 함께 운영하기에 적합하지 않습니다.
        </div>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <section className="bg-surface-container-lowest p-5 shadow-ghost md:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-headline text-lg font-extrabold text-on-surface">사업자 정보</h2>
                  <p className="mt-1 text-xs text-outline">각 항목의 공개 여부를 개별 관리할 수 있습니다.</p>
                </div>
                <label className="flex items-center gap-3 rounded bg-surface-container px-4 py-3 text-sm font-bold text-on-surface">
                  <input
                    type="checkbox"
                    checked={form.is_published}
                    onChange={(event) => patch({ is_published: event.target.checked })}
                    className="h-4 w-4 accent-primary"
                  />
                  전체 공시 페이지 공개
                </label>
              </div>

              <div className="grid gap-4">
                {FIELD_ROWS.map((row) => (
                  <div key={row.key} className="grid gap-2 rounded border border-outline-variant/30 p-4 md:grid-cols-[160px_1fr_auto] md:items-center">
                    <label className="text-sm font-bold text-on-surface">
                      {row.label}{row.required && <span className="ml-1 text-error">*</span>}
                    </label>
                    <input
                      value={form[row.key] ?? ""}
                      onChange={(event) => patch({ [row.key]: event.target.value })}
                      className="h-11 rounded bg-surface-container px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                    <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant">
                      <input
                        type="checkbox"
                        checked={form[row.visible]}
                        onChange={(event) => patch({ [row.visible]: event.target.checked })}
                        className="h-4 w-4 accent-primary"
                      />
                      공개
                    </label>
                  </div>
                ))}

                <div className="grid gap-3 rounded border border-outline-variant/30 p-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm font-bold text-on-surface">
                    통신판매업 신고번호 <span className="text-error">*</span>
                    <input
                      value={form.ecommerce_registration_number ?? ""}
                      onChange={(event) => patch({ ecommerce_registration_number: event.target.value })}
                      className="h-11 rounded bg-surface-container px-3 text-sm font-normal outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm font-bold text-on-surface">
                    신고기관 <span className="text-error">*</span>
                    <input
                      value={form.ecommerce_registration_authority ?? ""}
                      onChange={(event) => patch({ ecommerce_registration_authority: event.target.value })}
                      placeholder="예: 서울특별시 서대문구청"
                      className="h-11 rounded bg-surface-container px-3 text-sm font-normal outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-on-surface-variant md:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.show_ecommerce_registration}
                      onChange={(event) => patch({ show_ecommerce_registration: event.target.checked })}
                      className="h-4 w-4 accent-primary"
                    />
                    통신판매업 신고정보 공개
                  </label>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="bg-surface-container-lowest p-5 shadow-ghost md:p-7">
                <h2 className="font-headline text-lg font-extrabold text-on-surface">취소·환불 정책 초안</h2>
                <textarea
                  value={form.refund_policy}
                  onChange={(event) => patch({ refund_policy: event.target.value })}
                  rows={16}
                  className="mt-4 min-h-[360px] w-full rounded bg-surface-container px-4 py-3 text-sm leading-6 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="bg-surface-container-lowest p-5 shadow-ghost md:p-7">
                <h2 className="font-headline text-lg font-extrabold text-on-surface">증빙 발급 정책 초안</h2>
                <textarea
                  value={form.receipt_policy}
                  onChange={(event) => patch({ receipt_policy: event.target.value })}
                  rows={16}
                  className="mt-4 min-h-[360px] w-full rounded bg-surface-container px-4 py-3 text-sm leading-6 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                />
              </div>
            </section>

            <div className={[
              "rounded px-5 py-4 text-sm font-bold",
              commerceReady ? "bg-green-50 text-green-800" : "bg-surface-container text-on-surface-variant",
            ].join(" ")}>
              {commerceReady
                ? "유료 거래에 필요한 공시 필드가 모두 입력·공개 상태입니다."
                : "현재는 미공개 초안 상태이거나 유료 거래 필수 공시 항목이 부족합니다."}
            </div>
            {message && <p className="rounded bg-surface-container px-4 py-3 text-sm text-on-surface-variant">{message}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
