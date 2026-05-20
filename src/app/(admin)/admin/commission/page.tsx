"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { cn } from "@/lib/utils/cn";

type CommissionScope = "default" | "license" | "photographer" | "image";

interface CommissionPolicy {
  id: string;
  scope: CommissionScope;
  label: string;
  rate: number;
  active: boolean;
  license_code: string | null;
  photographer_id: string | null;
  image_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
}

interface PolicyForm {
  scope: CommissionScope;
  label: string;
  rate: string;
  active: boolean;
  license_code: string;
  photographer_id: string;
  image_id: string;
  starts_at: string;
  ends_at: string;
}

interface DeletionFeeSetting {
  code: "image_delete_complex" | "image_delete_simple";
  label: string;
  amount_krw: number;
  active: boolean;
  updated_at: string | null;
}

const SCOPE_LABELS: Record<CommissionScope, string> = {
  default: "기본",
  license: "라이선스",
  photographer: "작가",
  image: "이미지",
};

const SCOPE_ICONS: Record<CommissionScope, string> = {
  default: "public",
  license: "badge",
  photographer: "person",
  image: "image",
};

const TARGET_LABELS: Record<Exclude<CommissionScope, "default">, string> = {
  license: "라이선스 코드",
  photographer: "작가 ID",
  image: "이미지 ID",
};

const EMPTY_FORM: PolicyForm = {
  scope: "default",
  label: "",
  rate: "20",
  active: true,
  license_code: "",
  photographer_id: "",
  image_id: "",
  starts_at: "",
  ends_at: "",
};

const DELETION_FEE_HELP: Record<DeletionFeeSetting["code"], string> = {
  image_delete_simple: "판매/온체인 이력이 없는 사진가 삭제 요청에 적용합니다.",
  image_delete_complex: "구매자 고지, 구매이력 보존, 온체인/Arweave 기록 확인이 필요한 요청에 적용합니다.",
};

function formatRate(rate: number) {
  return `${(rate * 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "제한 없음";
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toIsoOrNull(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function targetValue(policy: CommissionPolicy) {
  if (policy.scope === "default") return "전체 판매";
  if (policy.scope === "license") return policy.license_code || "미지정";
  if (policy.scope === "photographer") return policy.photographer_id || "미지정";
  return policy.image_id || "미지정";
}

function policyTargetField(scope: CommissionScope) {
  if (scope === "default") return null;
  if (scope === "license") return "license_code";
  if (scope === "photographer") return "photographer_id";
  return "image_id";
}

export default function AdminCommissionPage() {
  const [policies, setPolicies] = useState<CommissionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [deletionFees, setDeletionFees] = useState<DeletionFeeSetting[]>([]);
  const [deletionFeeDrafts, setDeletionFeeDrafts] = useState<Record<string, string>>({});
  const [feesLoading, setFeesLoading] = useState(true);
  const [feesSaving, setFeesSaving] = useState(false);
  const [form, setForm] = useState<PolicyForm>(EMPTY_FORM);

  const targetField = useMemo(() => policyTargetField(form.scope), [form.scope]);

  const loadPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/commission-policies?status=all");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "수수료 정책을 불러오지 못했습니다.");
        return;
      }
      const { policies: rows } = await res.json();
      const nextPolicies = (rows ?? []) as CommissionPolicy[];
      setPolicies(nextPolicies);
      setRateDrafts(
        nextPolicies.reduce<Record<string, string>>((acc, policy) => {
          acc[policy.id] = String(Number((policy.rate * 100).toFixed(2)));
          return acc;
        }, {}),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeletionFees = useCallback(async () => {
    setFeesLoading(true);
    try {
      const res = await fetch("/api/admin/deletion-fees");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "삭제 요청 수수료를 불러오지 못했습니다.");
        return;
      }
      const { settings } = await res.json();
      const nextFees = (settings ?? []) as DeletionFeeSetting[];
      setDeletionFees(nextFees);
      setDeletionFeeDrafts(
        nextFees.reduce<Record<string, string>>((acc, fee) => {
          acc[fee.code] = String(fee.amount_krw);
          return acc;
        }, {}),
      );
    } finally {
      setFeesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
    loadDeletionFees();
  }, [loadPolicies, loadDeletionFees]);

  function updateForm<K extends keyof PolicyForm>(key: K, value: PolicyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function createPolicy(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const rate = Number(form.rate) / 100;
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      alert("수수료율은 0에서 100 사이의 숫자로 입력해주세요.");
      return;
    }
    if (targetField && !form[targetField].trim()) {
      alert(`${TARGET_LABELS[form.scope as Exclude<CommissionScope, "default">]}를 입력해주세요.`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/commission-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: form.scope,
          label: form.label.trim(),
          rate,
          active: form.active,
          license_code: form.license_code.trim(),
          photographer_id: form.photographer_id.trim(),
          image_id: form.image_id.trim(),
          starts_at: toIsoOrNull(form.starts_at),
          ends_at: toIsoOrNull(form.ends_at),
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "수수료 정책을 생성하지 못했습니다.");
        return;
      }
      setForm(EMPTY_FORM);
      await loadPolicies();
    } finally {
      setSaving(false);
    }
  }

  async function patchPolicy(id: string, patch: Partial<Pick<CommissionPolicy, "label" | "rate" | "active" | "starts_at" | "ends_at">>) {
    setActioning(id);
    try {
      const res = await fetch(`/api/admin/commission-policies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "수수료 정책을 수정하지 못했습니다.");
        return;
      }
      const { policy } = await res.json();
      setPolicies((prev) => prev.map((row) => (row.id === id ? policy : row)));
      const patchedRate = patch.rate;
      if (patchedRate !== undefined) {
        setRateDrafts((prev) => ({ ...prev, [id]: String(Number((patchedRate * 100).toFixed(2))) }));
      }
    } finally {
      setActioning(null);
    }
  }

  async function saveRate(policy: CommissionPolicy) {
    const percent = Number(rateDrafts[policy.id]);
    const rate = percent / 100;
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      alert("수수료율은 0에서 100 사이의 숫자로 입력해주세요.");
      return;
    }
    await patchPolicy(policy.id, { rate });
  }

  async function saveDeletionFees() {
    const settings = deletionFees.map((fee) => {
      const amount = Number(deletionFeeDrafts[fee.code]);
      if (!Number.isInteger(amount) || amount < 0) {
        throw new Error("삭제 요청 수수료는 0 이상의 원화 정수로 입력해주세요.");
      }
      return { code: fee.code, amount_krw: amount, active: fee.active };
    });

    setFeesSaving(true);
    try {
      const res = await fetch("/api/admin/deletion-fees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "삭제 요청 수수료를 저장하지 못했습니다.");
        return;
      }
      await loadDeletionFees();
    } finally {
      setFeesSaving(false);
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
    <div className="p-6 md:p-10">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">수수료 정책 관리</h1>
            <p className="text-sm text-outline mt-1">
              기본, 라이선스, 작가, 이미지별 수수료 정책을 관리합니다.
            </p>
          </div>
          {!loading && (
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container-lowest shadow-ghost px-3 py-2 rounded-full w-fit">
              총 {policies.length.toLocaleString("ko-KR")}개 정책
            </span>
          )}
        </div>

        <section className="bg-surface-container-lowest shadow-ghost rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div>
              <h2 className="font-headline text-lg font-extrabold text-on-surface">사진 삭제 요청 수수료</h2>
              <p className="text-xs text-outline mt-0.5">
                사진가가 삭제를 요청할 때 안내되는 수수료를 운영 상황에 맞게 조정합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                saveDeletionFees().catch((error) => alert(error instanceof Error ? error.message : "저장하지 못했습니다."));
              }}
              disabled={feesSaving || feesLoading || deletionFees.length === 0}
              className="h-10 flex items-center justify-center gap-2 px-4 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {feesSaving ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">save</span>
              )}
              수수료 저장
            </button>
          </div>

          {feesLoading ? (
            <div className="py-8 flex justify-center">
              <span className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {deletionFees.map((fee) => (
                <div key={fee.code} className="rounded-lg bg-surface-container-low p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-on-surface">{fee.label}</p>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{DELETION_FEE_HELP[fee.code]}</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-bold text-outline">
                      <input
                        type="checkbox"
                        checked={fee.active}
                        onChange={(e) => setDeletionFees((prev) => prev.map((row) => (
                          row.code === fee.code ? { ...row, active: e.target.checked } : row
                        )))}
                        className="w-4 h-4 accent-primary"
                      />
                      활성
                    </label>
                  </div>
                  <div className="flex items-center h-11 bg-surface-container-lowest ring-1 ring-outline-variant rounded-lg overflow-hidden">
                    <span className="px-3 text-xs font-bold text-outline">₩</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={deletionFeeDrafts[fee.code] ?? ""}
                      onChange={(e) => setDeletionFeeDrafts((prev) => ({ ...prev, [fee.code]: e.target.value }))}
                      className="flex-1 h-full bg-transparent px-2 text-sm font-semibold text-on-surface outline-none"
                      aria-label={`${fee.label} 금액`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <form
          onSubmit={createPolicy}
          className="bg-surface-container-lowest shadow-ghost rounded-xl p-5 flex flex-col gap-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-headline text-lg font-extrabold text-on-surface">새 정책 생성</h2>
              <p className="text-xs text-outline mt-0.5">요율은 퍼센트 기준으로 입력합니다.</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => updateForm("active", e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm font-semibold text-on-surface">활성화</span>
            </label>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">범위</label>
              <select
                value={form.scope}
                onChange={(e) => updateForm("scope", e.target.value as CommissionScope)}
                className="h-11 bg-surface-container ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-3 text-sm text-on-surface outline-none"
              >
                {Object.entries(SCOPE_LABELS).map(([scope, label]) => (
                  <option key={scope} value={scope}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">정책명</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => updateForm("label", e.target.value)}
                placeholder="예: 기본 수수료"
                className="h-11 bg-surface-container ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">수수료율 (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={form.rate}
                onChange={(e) => updateForm("rate", e.target.value)}
                className="h-11 bg-surface-container ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none"
              />
            </div>

            {targetField ? (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">
                  {TARGET_LABELS[form.scope as Exclude<CommissionScope, "default">]}
                </label>
                <input
                  type="text"
                  required
                  value={form[targetField]}
                  onChange={(e) => updateForm(targetField, e.target.value)}
                  placeholder={TARGET_LABELS[form.scope as Exclude<CommissionScope, "default">]}
                  className="h-11 bg-surface-container ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none"
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">대상</label>
                <div className="h-11 bg-surface-container ring-1 ring-outline-variant rounded-lg px-4 flex items-center text-sm text-on-surface-variant">
                  전체 판매
                </div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3 md:items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">시작일</label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => updateForm("starts_at", e.target.value)}
                className="h-11 bg-surface-container ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-outline uppercase tracking-widest">종료일</label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => updateForm("ends_at", e.target.value)}
                className="h-11 bg-surface-container ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="h-11 flex items-center justify-center gap-2 px-5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {saving ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-base">add</span>
              )}
              정책 생성
            </button>
          </div>
        </form>

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : policies.length === 0 ? (
          <div className="flex flex-col items-center py-32 gap-4 text-outline">
            <span className="material-symbols-outlined text-6xl">percent</span>
            <p className="text-base">등록된 수수료 정책이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {policies.map((policy) => (
              <div
                key={policy.id}
                className="bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden"
              >
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="material-symbols-outlined text-base text-on-surface-variant">
                          {SCOPE_ICONS[policy.scope]}
                        </span>
                        <h2 className="font-headline font-bold text-base text-on-surface truncate">
                          {policy.label || "수수료 정책"}
                        </h2>
                        <span className="text-xs text-outline">
                          {SCOPE_LABELS[policy.scope]} · {targetValue(policy)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => patchPolicy(policy.id, { active: !policy.active })}
                      disabled={actioning === policy.id}
                      className={cn(
                        "text-[10px] font-bold px-3 py-1 rounded-full shrink-0 transition-colors disabled:opacity-50",
                        policy.active
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-container text-outline hover:text-on-surface",
                      )}
                    >
                      {policy.active ? "활성" : "비활성"}
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.1fr]">
                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">category</span>
                        {SCOPE_LABELS[policy.scope]}
                      </span>
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">ads_click</span>
                        {targetValue(policy)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-outline">
                      <span className="material-symbols-outlined text-sm">event_available</span>
                      <span>{formatDateTime(policy.starts_at)}</span>
                      <span>~</span>
                      <span>{formatDateTime(policy.ends_at)}</span>
                    </div>

                    <div className="flex items-center md:justify-end gap-2">
                      <span className="text-xs text-outline">현재 {formatRate(policy.rate)}</span>
                      <div className="flex items-center h-9 bg-surface-container ring-1 ring-outline-variant rounded-lg overflow-hidden">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={rateDrafts[policy.id] ?? ""}
                          onChange={(e) => setRateDrafts((prev) => ({ ...prev, [policy.id]: e.target.value }))}
                          className="w-20 h-full bg-transparent px-3 text-sm font-semibold text-on-surface outline-none"
                          aria-label={`${policy.label} 수수료율`}
                        />
                        <span className="px-2 text-xs font-bold text-outline">%</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => saveRate(policy)}
                        disabled={actioning === policy.id}
                        className="h-9 flex items-center gap-1.5 px-3 bg-primary text-white text-xs font-bold rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {actioning === policy.id ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">save</span>
                        )}
                        저장
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
