"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminButton, AdminChip, AdminListSurface } from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils/cn";

interface LicenseTypeRow {
  id: number;
  code: string;
  name_en: string;
  name_ko: string;
  price_krw: number;
  description_en: string | null;
  description_ko: string | null;
}

interface CommerceSettingsRow {
  subscription_basic_downloads: number;
  subscription_pro_downloads: number;
  subscription_enterprise_downloads: number;
  arweave_self_funded_request_fee_krw: number;
}

function formatKRW(amount: number) {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

export default function AdminPricingPage() {
  const [licenses, setLicenses] = useState<LicenseTypeRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [commerceSettings, setCommerceSettings] = useState<CommerceSettingsRow | null>(null);
  const [commerceDrafts, setCommerceDrafts] = useState<Record<keyof CommerceSettingsRow, string>>({
    subscription_basic_downloads: "5",
    subscription_pro_downloads: "30",
    subscription_enterprise_downloads: "100",
    arweave_self_funded_request_fee_krw: "10000",
  });
  const [commerceLoading, setCommerceLoading] = useState(true);
  const [commerceSaving, setCommerceSaving] = useState(false);

  const loadLicenses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/license-types");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "가격정책을 불러오지 못했습니다.");
      }

      const { licenses: rows } = await res.json() as { licenses?: LicenseTypeRow[] };
      const nextRows = rows ?? [];
      setLicenses(nextRows);
      setDrafts(Object.fromEntries(nextRows.map((row) => [row.code, String(row.price_krw)])));
    } catch (error) {
      alert(error instanceof Error ? error.message : "가격정책을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLicenses(); }, [loadLicenses]);

  const loadCommerceSettings = useCallback(async () => {
    setCommerceLoading(true);
    try {
      const res = await fetch("/api/admin/commerce-settings");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "운영 정책을 불러오지 못했습니다.");
      }
      const data = await res.json() as { row?: CommerceSettingsRow | null; settings?: {
        downloadAccessDays: number;
        subscriptionDownloadQuotas: { basic: number; pro: number; enterprise: number };
        arweaveSelfFundedRequestFeeKrw: number;
      } };
      const row = data.row ?? {
        subscription_basic_downloads: data.settings?.subscriptionDownloadQuotas.basic ?? 5,
        subscription_pro_downloads: data.settings?.subscriptionDownloadQuotas.pro ?? 30,
        subscription_enterprise_downloads: data.settings?.subscriptionDownloadQuotas.enterprise ?? 100,
        arweave_self_funded_request_fee_krw: data.settings?.arweaveSelfFundedRequestFeeKrw ?? 10000,
      };
      setCommerceSettings(row);
      setCommerceDrafts({
        subscription_basic_downloads: String(row.subscription_basic_downloads),
        subscription_pro_downloads: String(row.subscription_pro_downloads),
        subscription_enterprise_downloads: String(row.subscription_enterprise_downloads),
        arweave_self_funded_request_fee_krw: String(row.arweave_self_funded_request_fee_krw),
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "운영 정책을 불러오지 못했습니다.");
    } finally {
      setCommerceLoading(false);
    }
  }, []);

  useEffect(() => { loadCommerceSettings(); }, [loadCommerceSettings]);

  async function savePrice(license: LicenseTypeRow) {
    setSaving(license.code);
    try {
      const res = await fetch("/api/admin/license-types", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: license.code,
          price_krw: drafts[license.code],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "가격을 저장하지 못했습니다.");
      }

      const { license: updated } = await res.json() as { license: LicenseTypeRow };
      setLicenses((prev) => prev.map((row) => row.code === updated.code ? updated : row));
      setDrafts((prev) => ({ ...prev, [updated.code]: String(updated.price_krw) }));
    } catch (error) {
      alert(error instanceof Error ? error.message : "가격을 저장하지 못했습니다.");
    } finally {
      setSaving(null);
    }
  }

  async function saveCommerceSettings() {
    const body = Object.fromEntries(
      Object.entries(commerceDrafts).map(([key, value]) => [key, Number(value)]),
    );

    setCommerceSaving(true);
    try {
      const res = await fetch("/api/admin/commerce-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "운영 정책을 저장하지 못했습니다.");
      }
      await loadCommerceSettings();
    } catch (error) {
      alert(error instanceof Error ? error.message : "운영 정책을 저장하지 못했습니다.");
    } finally {
      setCommerceSaving(false);
    }
  }

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <h1 className="font-headline text-xl font-extrabold text-on-surface">접근 권한이 없습니다</h1>
        <p className="text-sm">관리자 계정이 아닙니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">상품 가격정책</h1>
        <p className="text-sm text-outline mt-1">
          이미지 라이선스 상품별 판매 가격을 관리합니다. 저장 후 일반 결제와 온체인 결제 주문 생성에 즉시 반영됩니다.
        </p>
      </div>

      <AdminListSurface className="mb-8 p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="font-headline text-lg font-extrabold text-on-surface">구매/구독 운영 정책</h2>
            <p className="mt-1 text-xs text-outline">
              구독 플랜별 무료다운 개수와 판매 전 Arweave 셀프 등록 요청 수수료를 조정합니다. 다운로드 기간은 데이터 운영주기 관리에서 설정합니다.
            </p>
          </div>
          <AdminButton
            type="button"
            onClick={saveCommerceSettings}
            disabled={commerceSaving || commerceLoading || !commerceSettings}
            variant="primary"
            size="md"
          >
            {commerceSaving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-base">save</span>
            )}
            운영 정책 저장
          </AdminButton>
        </div>

        {commerceLoading ? (
          <div className="flex justify-center py-8">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            {([
              ["subscription_basic_downloads", "Basic 무료다운", "개", 0, 10000],
              ["subscription_pro_downloads", "Pro 무료다운", "개", 0, 10000],
              ["subscription_enterprise_downloads", "Enterprise 무료다운", "개", 0, 10000],
              ["arweave_self_funded_request_fee_krw", "Arweave 셀프등록 수수료", "KRW", 0, 10000000],
            ] as const).map(([key, label, suffix, min, max]) => (
              <label key={key} className="flex flex-col gap-2 rounded-lg border border-outline-variant/30 p-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-outline">{label}</span>
                <div className="flex h-11 items-center overflow-hidden rounded-lg bg-surface-container-lowest ring-1 ring-outline-variant">
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={key === "arweave_self_funded_request_fee_krw" ? 1000 : 1}
                    value={commerceDrafts[key]}
                    onChange={(event) => setCommerceDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-on-surface outline-none"
                  />
                  <span className="px-3 text-[10px] font-bold text-outline">{suffix}</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </AdminListSurface>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {licenses.map((license) => {
            const isSaving = saving === license.code;
            const draft = drafts[license.code] ?? "";
            const changed = Number(draft) !== license.price_krw;

            return (
              <AdminListSurface key={license.code} className="flex flex-col gap-5 p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{license.code}</p>
                      <h2 className="mt-1 font-headline text-lg font-extrabold text-on-surface">{license.name_ko}</h2>
                      <p className="text-xs text-outline">{license.name_en}</p>
                    </div>
                    <AdminChip tone="neutral">
                      현재 {formatKRW(license.price_krw)}
                    </AdminChip>
                  </div>
                  {(license.description_ko || license.description_en) && (
                    <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">
                      {license.description_ko ?? license.description_en}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex flex-col gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-outline">판매가 (KRW)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={10000000}
                      step={100}
                      value={draft}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [license.code]: event.target.value }))}
                      className="h-11 min-w-0 flex-1 rounded-lg bg-surface-container-low px-4 text-sm font-semibold text-on-surface outline-none ring-1 ring-outline-variant transition-all focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => savePrice(license)}
                      disabled={isSaving || !changed}
                      className={cn(
                        "h-11 shrink-0 rounded-lg px-4 text-xs font-bold uppercase tracking-widest transition-opacity disabled:opacity-50",
                        changed ? "bg-primary text-white hover:opacity-90" : "bg-surface-container text-outline",
                      )}
                    >
                      {isSaving ? (
                        <span className="inline-block h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      ) : "저장"}
                    </button>
                  </div>
                </div>
              </AdminListSurface>
            );
          })}
        </div>
      )}
    </div>
  );
}
