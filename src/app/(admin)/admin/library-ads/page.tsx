"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useState } from "react";
import type {
  LibraryAdCampaignRow,
  LibraryAdCampaignType,
} from "@/lib/ads/campaigns";

interface CampaignForm {
  name: string;
  campaign_type: LibraryAdCampaignType;
  title_ko: string;
  title_en: string;
  body_ko: string;
  body_en: string;
  cta_ko: string;
  cta_en: string;
  image_url: string;
  image_alt_ko: string;
  image_alt_en: string;
  destination_url: string;
  sponsor_name: string;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  priority: number;
}

interface AdminLibraryAdCampaign extends LibraryAdCampaignRow {
  metrics?: {
    impressions: number;
    clicks: number;
    ctr: number;
  };
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function emptyForm(): CampaignForm {
  return {
    name: "",
    campaign_type: "house",
    title_ko: "",
    title_en: "",
    body_ko: "",
    body_en: "",
    cta_ko: "자세히 보기",
    cta_en: "Learn more",
    image_url: "",
    image_alt_ko: "",
    image_alt_en: "",
    destination_url: "/contact?mode=photo",
    sponsor_name: "",
    is_active: false,
    starts_at: toDateTimeLocal(new Date().toISOString()),
    ends_at: "",
    priority: 0,
  };
}

function campaignToForm(campaign: LibraryAdCampaignRow): CampaignForm {
  return {
    name: campaign.name,
    campaign_type: campaign.campaign_type,
    title_ko: campaign.title_ko,
    title_en: campaign.title_en ?? "",
    body_ko: campaign.body_ko ?? "",
    body_en: campaign.body_en ?? "",
    cta_ko: campaign.cta_ko,
    cta_en: campaign.cta_en ?? "",
    image_url: campaign.image_url ?? "",
    image_alt_ko: campaign.image_alt_ko ?? "",
    image_alt_en: campaign.image_alt_en ?? "",
    destination_url: campaign.destination_url,
    sponsor_name: campaign.sponsor_name ?? "",
    is_active: campaign.is_active,
    starts_at: toDateTimeLocal(campaign.starts_at),
    ends_at: toDateTimeLocal(campaign.ends_at),
    priority: campaign.priority,
  };
}

function formPayload(form: CampaignForm) {
  return {
    ...form,
    placement: "right_rail",
    starts_at: new Date(form.starts_at).toISOString(),
    ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
  };
}

function campaignStatus(campaign: LibraryAdCampaignRow) {
  if (!campaign.is_active) return { label: "숨김", className: "bg-surface-container text-outline" };
  const now = Date.now();
  if (new Date(campaign.starts_at).getTime() > now) {
    return { label: "예약", className: "bg-tertiary/10 text-tertiary" };
  }
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() <= now) {
    return { label: "종료", className: "bg-surface-container text-outline" };
  }
  return { label: "노출 중", className: "bg-primary/10 text-primary" };
}

function formatWindow(campaign: LibraryAdCampaignRow) {
  const start = new Date(campaign.starts_at).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const end = campaign.ends_at
    ? new Date(campaign.ends_at).toLocaleString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    : "종료일 없음";
  return `${start} ~ ${end}`;
}

export default function AdminLibraryAdsPage() {
  const [campaigns, setCampaigns] = useState<AdminLibraryAdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignForm>(() => emptyForm());

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/library-ads", { cache: "no-store" });
      if (response.status === 403) {
        setForbidden(true);
        return;
      }
      const body = await response.json() as { campaigns?: AdminLibraryAdCampaign[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? "광고 캠페인을 불러오지 못했습니다.");
      setCampaigns(body.campaigns ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "광고 캠페인을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadCampaigns(); }, [loadCampaigns]);

  function openNew() {
    setEditingId(null);
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(campaign: LibraryAdCampaignRow) {
    setEditingId(campaign.id);
    setForm(campaignToForm(campaign));
    setFormOpen(true);
  }

  async function saveCampaign(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/admin/library-ads/${editingId}` : "/api/admin/library-ads",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formPayload(form)),
        },
      );
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "광고 캠페인을 저장하지 못했습니다.");
      setFormOpen(false);
      await loadCampaigns();
    } catch (error) {
      alert(error instanceof Error ? error.message : "광고 캠페인을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(campaign: LibraryAdCampaignRow) {
    const response = await fetch(`/api/admin/library-ads/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formPayload({
        ...campaignToForm(campaign),
        is_active: !campaign.is_active,
      })),
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      alert(body?.error ?? "노출 상태를 변경하지 못했습니다.");
      return;
    }
    await loadCampaigns();
  }

  async function deleteCampaign(campaign: LibraryAdCampaignRow) {
    if (!confirm(`캠페인 “${campaign.name}”을 삭제하시겠습니까?`)) return;
    const response = await fetch(`/api/admin/library-ads/${campaign.id}`, { method: "DELETE" });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      alert(body?.error ?? "광고 캠페인을 삭제하지 못했습니다.");
      return;
    }
    await loadCampaigns();
  }

  if (forbidden) {
    return <div className="p-10 text-center font-bold text-error">관리자 권한이 필요합니다.</div>;
  }

  return (
    <div className="p-4 md:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="font-headline text-2xl font-extrabold text-on-surface">광고·제휴 관리</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-outline">
              유효한 캠페인이 있을 때만 라이브러리 오른쪽에 카드 한 개가 노출됩니다.
              여러 캠페인이 겹치면 우선순위가 높은 캠페인을 사용하며, 캠페인이 없으면 광고 자리도 완전히 사라집니다.
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-white"
          >
            <span className="material-symbols-outlined text-base">add</span>
            캠페인 추가
          </button>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-ghost">
            <p className="text-xs font-bold text-outline">노출 위치</p>
            <p className="mt-1 font-extrabold text-on-surface">오른쪽 단일 카드</p>
          </div>
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-ghost">
            <p className="text-xs font-bold text-outline">노출 화면</p>
            <p className="mt-1 font-extrabold text-on-surface">1536px 이상 데스크톱</p>
          </div>
          <div className="rounded-xl bg-surface-container-lowest p-4 shadow-ghost">
            <p className="text-xs font-bold text-outline">성과 기록</p>
            <p className="mt-1 font-extrabold text-on-surface">50%·1초 노출 / 클릭</p>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-outline">불러오는 중...</div>
        ) : campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-lowest py-24 text-center">
            <span className="material-symbols-outlined text-5xl text-outline">hide_image</span>
            <p className="mt-3 font-bold text-on-surface">등록된 캠페인이 없습니다.</p>
            <p className="mt-1 text-sm text-outline">현재 라이브러리는 광고 없이 전체 폭으로 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => {
              const status = campaignStatus(campaign);
              return (
                <article
                  key={campaign.id}
                  className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-ghost md:grid-cols-[120px_minmax(0,1fr)_auto]"
                >
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-container">
                    {campaign.image_url ? (
                      <img
                        src={campaign.image_url}
                        alt={campaign.image_alt_ko || ""}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-3xl">ads_click</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${status.className}`}>
                        {status.label}
                      </span>
                      <span className="rounded-full bg-surface-container px-2 py-1 text-[10px] font-bold text-on-surface-variant">
                        {campaign.campaign_type === "partner" ? "외부 광고·제휴" : "자체 홍보"}
                      </span>
                      <span className="text-[10px] font-bold text-outline">우선순위 {campaign.priority}</span>
                    </div>
                    <h2 className="mt-3 truncate font-headline text-lg font-extrabold text-on-surface">
                      {campaign.name}
                    </h2>
                    <p className="mt-1 truncate text-sm font-semibold text-on-surface-variant">{campaign.title_ko}</p>
                    <p className="mt-2 text-xs text-outline">{formatWindow(campaign)}</p>
                    <p className="mt-1 truncate text-xs text-outline">{campaign.destination_url}</p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-on-surface-variant">
                      <span>최근 90일 노출 {(campaign.metrics?.impressions ?? 0).toLocaleString("ko-KR")}</span>
                      <span>클릭 {(campaign.metrics?.clicks ?? 0).toLocaleString("ko-KR")}</span>
                      <span>CTR {(campaign.metrics?.ctr ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%</span>
                    </div>
                  </div>
                  <div className="flex items-start justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleActive(campaign)}
                      className="rounded-lg p-2 text-outline hover:bg-surface-container"
                      title={campaign.is_active ? "숨기기" : "노출하기"}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {campaign.is_active ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(campaign)}
                      className="rounded-lg p-2 text-outline hover:bg-surface-container"
                      aria-label="수정"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteCampaign(campaign)}
                      className="rounded-lg p-2 text-outline hover:bg-error/10 hover:text-error"
                      aria-label="삭제"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="flex min-h-full items-start justify-center py-4 md:items-center">
            <form
              onSubmit={saveCampaign}
              className="w-full max-w-4xl overflow-hidden rounded-2xl bg-surface-container-lowest shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/30 px-6 py-5">
                <div>
                  <h2 className="text-lg font-extrabold text-on-surface">
                    {editingId ? "캠페인 수정" : "캠페인 추가"}
                  </h2>
                  <p className="mt-1 text-xs text-outline">임의 HTML이나 광고 스크립트는 사용할 수 없습니다.</p>
                </div>
                <button type="button" onClick={() => setFormOpen(false)} aria-label="닫기">
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="grid max-h-[72vh] gap-6 overflow-y-auto p-6 md:grid-cols-2">
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-outline">
                    관리용 캠페인명 *
                    <input
                      required
                      maxLength={100}
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    캠페인 구분
                    <select
                      value={form.campaign_type}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        campaign_type: event.target.value as LibraryAdCampaignType,
                      }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    >
                      <option value="house">이미지파트너스 자체 홍보</option>
                      <option value="partner">외부 광고·제휴</option>
                    </select>
                  </label>
                  {form.campaign_type === "partner" && (
                    <label className="block text-xs font-bold text-outline">
                      광고주·제휴사명
                      <input
                        maxLength={100}
                        value={form.sponsor_name}
                        onChange={(event) => setForm((current) => ({ ...current, sponsor_name: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                      />
                    </label>
                  )}
                  <label className="block text-xs font-bold text-outline">
                    한국어 제목 *
                    <input
                      required
                      maxLength={100}
                      value={form.title_ko}
                      onChange={(event) => setForm((current) => ({ ...current, title_ko: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    한국어 설명
                    <textarea
                      maxLength={240}
                      rows={3}
                      value={form.body_ko}
                      onChange={(event) => setForm((current) => ({ ...current, body_ko: event.target.value }))}
                      className="mt-2 w-full rounded-lg bg-surface-container p-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-outline">
                      한국어 버튼 문구 *
                      <input
                        required
                        maxLength={40}
                        value={form.cta_ko}
                        onChange={(event) => setForm((current) => ({ ...current, cta_ko: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                      />
                    </label>
                    <label className="block text-xs font-bold text-outline">
                      우선순위
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        step={1}
                        value={form.priority}
                        onChange={(event) => setForm((current) => ({ ...current, priority: Number(event.target.value) }))}
                        className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="block text-xs font-bold text-outline">
                    영문 제목
                    <input
                      maxLength={100}
                      value={form.title_en}
                      onChange={(event) => setForm((current) => ({ ...current, title_en: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    영문 설명
                    <textarea
                      maxLength={240}
                      rows={2}
                      value={form.body_en}
                      onChange={(event) => setForm((current) => ({ ...current, body_en: event.target.value }))}
                      className="mt-2 w-full rounded-lg bg-surface-container p-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    영문 버튼 문구
                    <input
                      maxLength={40}
                      value={form.cta_en}
                      onChange={(event) => setForm((current) => ({ ...current, cta_en: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    이미지 URL
                    <input
                      type="text"
                      maxLength={2048}
                      placeholder="/images/promotion.jpg 또는 https://..."
                      value={form.image_url}
                      onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                    <span className="mt-1 block font-normal leading-5">
                      내부 경로 또는 HTTPS만 가능하며 원본·full 이미지 URL은 차단됩니다.
                    </span>
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    한국어 이미지 설명
                    <input
                      maxLength={160}
                      value={form.image_alt_ko}
                      onChange={(event) => setForm((current) => ({ ...current, image_alt_ko: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    영문 이미지 설명
                    <input
                      maxLength={160}
                      value={form.image_alt_en}
                      onChange={(event) => setForm((current) => ({ ...current, image_alt_en: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <label className="block text-xs font-bold text-outline">
                    이동 URL *
                    <input
                      required
                      type="text"
                      maxLength={2048}
                      value={form.destination_url}
                      onChange={(event) => setForm((current) => ({ ...current, destination_url: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-bold text-outline">
                      노출 시작 *
                      <input
                        required
                        type="datetime-local"
                        value={form.starts_at}
                        onChange={(event) => setForm((current) => ({ ...current, starts_at: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                      />
                    </label>
                    <label className="block text-xs font-bold text-outline">
                      노출 종료
                      <input
                        type="datetime-local"
                        value={form.ends_at}
                        onChange={(event) => setForm((current) => ({ ...current, ends_at: event.target.value }))}
                        className="mt-2 h-11 w-full rounded-lg bg-surface-container px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                      />
                    </label>
                  </div>
                  <label className="flex items-start gap-3 rounded-xl border border-outline-variant/40 p-4 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                      className="mt-0.5 accent-primary"
                    />
                    <span>
                      <span className="block font-bold text-on-surface">캠페인 활성화</span>
                      <span className="mt-1 block text-xs leading-5 text-outline">
                        활성화하더라도 설정한 노출 기간 안에서만 표시됩니다.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-outline-variant/30 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="rounded-lg border border-outline-variant px-4 py-2.5 text-xs font-bold"
                >
                  취소
                </button>
                <button
                  disabled={saving}
                  className="rounded-lg bg-primary px-5 py-2.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
