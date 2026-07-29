"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_BUSINESS_DISCLOSURE,
  type BusinessDisclosure,
} from "@/lib/legal/disclosure";

const DECISION_GUIDE = [
  {
    situation: "입금 확인 전",
    action: "구매자의 취소 요청을 접수하고 계좌이체 주문을 취소합니다.",
    evidence: "주문번호, 요청자 이메일, 주문 상태",
  },
  {
    situation: "입금 후·원본 권한 제공 전",
    action: "입금 내역을 확인한 뒤 전액 환급을 원칙으로 처리합니다.",
    evidence: "입금 내역, 다운로드 권한 생성 여부",
  },
  {
    situation: "원본 권한 제공 후 단순 변심",
    action: "주문 당시 철회 제한 고지와 동의 기록을 먼저 확인하고 개별 판단합니다.",
    evidence: "고지·동의 버전, 권한 생성 및 다운로드 기록",
  },
  {
    situation: "파일 오류·오제공·중대한 권리 하자",
    action: "다운로드 여부와 무관하게 재제공, 교환 또는 환급을 우선 검토합니다.",
    evidence: "문제 파일, 주문 조건, 권리·검수 기록",
  },
  {
    situation: "현금영수증·세금계산서 요청",
    action: "주문과 입금 사실, 신청인 정보를 확인하고 중복 발급되지 않게 처리합니다.",
    evidence: "주문번호, 입금 내역, 발급 구분, 수신 정보",
  },
] as const;

export default function PolicyDocumentsPage() {
  const [form, setForm] = useState<BusinessDisclosure>(DEFAULT_BUSINESS_DISCLOSURE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const updatedLabel = useMemo(() => {
    if (!form.updated_at) return "저장 이력 없음";
    return new Date(form.updated_at).toLocaleString("ko-KR");
  }, [form.updated_at]);

  useEffect(() => {
    fetch("/api/admin/legal-disclosure", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 403) {
          setForbidden(true);
          return null;
        }
        const body = await response.json() as { disclosure?: BusinessDisclosure; error?: string };
        if (!response.ok) throw new Error(body.error ?? "운영정책 문서를 불러오지 못했습니다.");
        return body;
      })
      .then((body) => {
        if (body?.disclosure) {
          setForm({ ...DEFAULT_BUSINESS_DISCLOSURE, ...body.disclosure });
        }
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : "운영정책 문서를 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/legal-disclosure", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json() as { disclosure?: BusinessDisclosure; error?: string };
      if (!response.ok) throw new Error(body.error ?? "운영정책 문서를 저장하지 못했습니다.");
      if (body.disclosure) {
        setForm({ ...DEFAULT_BUSINESS_DISCLOSURE, ...body.disclosure });
      }
      setMessage("운영정책을 저장했습니다. 공시사항의 정책 초안에도 같은 내용이 반영됩니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "운영정책 문서를 저장하지 못했습니다.");
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
        <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Operations Policy</p>
            <h1 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">
              운영정책 문서함
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              관리자와 운영 에이전트가 실제 주문·환불·증빙 업무를 판단할 때 따르는 내부 기준입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={loading || saving}
            className="inline-flex h-11 w-fit items-center gap-2 rounded bg-primary px-5 text-xs font-bold text-white disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">{saving ? "hourglass_top" : "save"}</span>
            {saving ? "저장 중" : "정책 문서 저장"}
          </button>
        </header>

        <section className="mb-6 rounded border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-950">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined mt-0.5 text-sky-700">science</span>
            <div>
              <p className="font-extrabold">현재 운영 단계: 제한된 베타 운영</p>
              <p className="mt-1">
                계좌이체 흐름은 내부 검증을 위해 유지합니다. 월 정액권의 가격·제공 범위는 아직 확정되지 않았으며,
                불특정 고객을 대상으로 정식 청약을 받기 전 공시사항, 주문 고지·동의, 세무 기준을 다시 확인합니다.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="h-fit bg-surface-container-lowest p-3 shadow-ghost">
            <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-widest text-outline">문서 1개</p>
            <div className="rounded bg-primary/10 px-3 py-4 text-primary">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-xl">receipt_long</span>
                <div>
                  <p className="text-sm font-extrabold">계좌이체 주문 운영정책</p>
                  <p className="mt-1 text-[11px] leading-4">취소·환불 및 결제증빙</p>
                </div>
              </div>
            </div>
            <dl className="mt-3 space-y-2 rounded bg-surface-container px-3 py-3 text-[11px] text-on-surface-variant">
              <div className="flex justify-between gap-2"><dt>문서 상태</dt><dd className="font-bold">검토 초안</dd></div>
              <div className="flex justify-between gap-2"><dt>대상</dt><dd className="font-bold">관리자·운영 에이전트</dd></div>
              <div><dt>최근 저장</dt><dd className="mt-1 font-bold">{updatedLabel}</dd></div>
            </dl>
            <Link
              href="/admin/legal/disclosure"
              className="mt-3 flex items-center justify-between rounded px-3 py-3 text-xs font-bold text-on-surface-variant hover:bg-surface-container"
            >
              공시사항에서 확인
              <span className="material-symbols-outlined text-base">open_in_new</span>
            </Link>
          </aside>

          <main className="space-y-6">
            {loading ? (
              <div className="flex min-h-[480px] items-center justify-center bg-surface-container-lowest shadow-ghost">
                <span className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              <>
                <section className="bg-surface-container-lowest p-5 shadow-ghost md:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-headline text-xl font-extrabold text-on-surface">
                        계좌이체 주문 취소·환불 및 결제증빙 운영정책
                      </h2>
                      <p className="mt-2 text-xs leading-5 text-outline">
                        이 문서의 두 정책 본문은 공시사항과 같은 데이터를 사용합니다. 어느 화면에서 저장해도 함께 갱신됩니다.
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-bold text-amber-800">검토 초안</span>
                  </div>

                  <div className="mt-6 grid gap-6">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-extrabold text-on-surface">취소·환불 정책</span>
                      <textarea
                        value={form.refund_policy}
                        onChange={(event) => setForm((current) => ({ ...current, refund_policy: event.target.value }))}
                        rows={14}
                        className="min-h-[320px] rounded bg-surface-container px-4 py-3 text-sm leading-7 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-extrabold text-on-surface">현금영수증·세금계산서 정책</span>
                      <textarea
                        value={form.receipt_policy}
                        onChange={(event) => setForm((current) => ({ ...current, receipt_policy: event.target.value }))}
                        rows={12}
                        className="min-h-[280px] rounded bg-surface-container px-4 py-3 text-sm leading-7 outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                      />
                    </label>
                  </div>
                </section>

                <section className="bg-surface-container-lowest p-5 shadow-ghost md:p-7">
                  <h2 className="font-headline text-lg font-extrabold text-on-surface">운영 판단표</h2>
                  <p className="mt-2 text-xs text-outline">정책 본문을 적용할 때 확인할 최소 증빙과 기본 조치입니다.</p>
                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-xs">
                      <thead className="bg-surface-container text-outline">
                        <tr>
                          <th className="px-4 py-3">상황</th>
                          <th className="px-4 py-3">기본 조치</th>
                          <th className="px-4 py-3">확인 자료</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DECISION_GUIDE.map((row) => (
                          <tr key={row.situation} className="border-t border-outline-variant/30 align-top">
                            <td className="px-4 py-4 font-bold text-on-surface">{row.situation}</td>
                            <td className="px-4 py-4 leading-5 text-on-surface-variant">{row.action}</td>
                            <td className="px-4 py-4 leading-5 text-outline">{row.evidence}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
                  <h2 className="font-extrabold">정식 공개 전에 확정할 항목</h2>
                  <ul className="mt-3 list-disc space-y-2 pl-5 leading-6">
                    <li>월 정액권 가격, 포함 이미지 수, 초과 이용 및 해지·환불 기준</li>
                    <li>표시 가격의 부가가치세 포함 여부와 현금영수증·세금계산서 실제 발급 절차</li>
                    <li>대표자명·전화번호·사업자등록번호·통신판매업 신고정보 공개 시점</li>
                    <li>원본 제공 전 청약철회 제한 고지와 이용자 동의 기록 방식</li>
                  </ul>
                </section>
              </>
            )}

            {message && (
              <p className="rounded bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface-variant">
                {message}
              </p>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
