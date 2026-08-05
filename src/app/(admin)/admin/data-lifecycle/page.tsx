"use client";

import { useCallback, useEffect, useState } from "react";

interface DataLifecycleRow {
  personal_data_retention_days: number;
  download_access_days: number;
  transaction_history_retention_days: number;
  inactive_account_retention_days: number;
  audit_log_retention_days: number;
  deletion_request_retention_days: number;
  rejected_image_retention_days: number;
}

const FIELDS: Array<{
  key: keyof DataLifecycleRow;
  label: string;
  description: string;
  min: number;
  max: number;
  required: boolean;
}> = [
  {
    key: "personal_data_retention_days",
    label: "개인정보 최대 보관주기",
    description: "회원 탈퇴 후 개인정보 익명화 검토 전까지의 최대 보관 기간입니다.",
    min: 30,
    max: 3650,
    required: true,
  },
  {
    key: "download_access_days",
    label: "구매 후 다운로드 가능 기간",
    description: "결제 완료 시 생성되는 원본 다운로드 권한의 최대 유효기간입니다. 새 주문부터 적용됩니다.",
    min: 1,
    max: 3650,
    required: true,
  },
  {
    key: "transaction_history_retention_days",
    label: "개인별 거래내역 보관주기",
    description: "고객별 주문·결제 이력을 운영 보관하는 최대 기간입니다.",
    min: 30,
    max: 3650,
    required: true,
  },
  {
    key: "inactive_account_retention_days",
    label: "휴면·장기 미접속 계정 검토주기",
    description: "장기간 활동이 없는 계정을 데이터 정리 대상으로 검토하는 기준입니다.",
    min: 30,
    max: 3650,
    required: false,
  },
  {
    key: "rejected_image_retention_days",
    label: "반려된 이미지 보관주기",
    description: "반려 시점부터 사진작가의 업로드 목록에 보관할 기간입니다. 기간이 지나면 자동으로 아카이브되어 목록에서 사라집니다.",
    min: 1,
    max: 365,
    required: true,
  },
  {
    key: "audit_log_retention_days",
    label: "관리자 감사로그 보관주기",
    description: "관리자 정책 변경과 중요 운영 작업의 감사로그 최대 보관 기간입니다.",
    min: 30,
    max: 3650,
    required: false,
  },
  {
    key: "deletion_request_retention_days",
    label: "삭제요청 처리기록 보관주기",
    description: "완료된 이미지·회원 삭제요청 기록을 운영상 보관하는 최대 기간입니다.",
    min: 30,
    max: 3650,
    required: false,
  },
];

const DEFAULTS: DataLifecycleRow = {
  personal_data_retention_days: 1095,
  download_access_days: 30,
  transaction_history_retention_days: 1825,
  inactive_account_retention_days: 365,
  audit_log_retention_days: 730,
  deletion_request_retention_days: 730,
  rejected_image_retention_days: 7,
};

export default function DataLifecycleAdminPage() {
  const [drafts, setDrafts] = useState<Record<keyof DataLifecycleRow, string>>(
    Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => [key, String(value)])) as Record<keyof DataLifecycleRow, string>,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/data-lifecycle-settings");
      if (response.status === 403) {
        setForbidden(true);
        return;
      }
      const payload = await response.json().catch(() => null) as { row?: DataLifecycleRow; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "데이터 운영주기를 불러오지 못했습니다.");
      const row = payload?.row ?? DEFAULTS;
      setDrafts(Object.fromEntries(FIELDS.map(({ key }) => [key, String(row[key] ?? DEFAULTS[key])])) as Record<keyof DataLifecycleRow, string>);
    } catch (error) {
      alert(error instanceof Error ? error.message : "데이터 운영주기를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const response = await fetch("/api/admin/data-lifecycle-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(FIELDS.map(({ key }) => [key, Number(drafts[key])]))),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "데이터 운영주기를 저장하지 못했습니다.");
      setSaved(true);
      await load();
    } catch (error) {
      alert(error instanceof Error ? error.message : "데이터 운영주기를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (forbidden) {
    return <div className="p-10 text-center text-error">관리자 권한이 필요합니다.</div>;
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">데이터 운영주기 관리</h1>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-outline">
            개인정보, 거래내역, 다운로드 권한과 운영기록의 최대 보관 기간을 일 단위로 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={loading || saving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-xs font-bold text-white disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">save</span>
          {saving ? "저장 중..." : "운영주기 저장"}
        </button>
      </div>

      <div className="mb-6 rounded-xl border border-amber-300/50 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
        저장된 기간은 운영상 최대 보관 기준입니다. 법적 보존 의무, 분쟁 보존 또는 법적 보류 대상 데이터는 설정 기간보다 오래 보존될 수 있으며 자동 파기 전에 별도 검토가 필요합니다.
      </div>

      {saved && (
        <div className="mb-5 rounded-lg bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">운영주기 정책을 저장했습니다.</div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center"><span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {FIELDS.map((field) => (
            <label key={field.key} className="rounded-xl bg-surface-container-lowest p-5 shadow-ghost">
              <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
                {field.label}
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${field.required ? "bg-primary/10 text-primary" : "bg-surface-container-low text-outline"}`}>
                  {field.required ? "필수 정책" : "추가 운영 정책"}
                </span>
              </span>
              <span className="mt-2 block text-xs leading-relaxed text-outline">{field.description}</span>
              <span className="mt-4 flex h-11 items-center overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-outline-variant">
                <input
                  type="number"
                  min={field.min}
                  max={field.max}
                  value={drafts[field.key]}
                  onChange={(event) => setDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
                  className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm font-semibold text-on-surface outline-none"
                />
                <span className="px-4 text-xs font-bold text-outline">일</span>
              </span>
              <span className="mt-2 block text-[10px] text-outline">허용 범위: {field.min.toLocaleString()}–{field.max.toLocaleString()}일</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
