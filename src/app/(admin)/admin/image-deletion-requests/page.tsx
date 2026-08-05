"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  AdminButton,
  AdminChip,
  AdminInlineMetrics,
  AdminListSurface,
  adminStatusTone,
} from "@/components/admin/AdminPrimitives";

interface DeletionRequest {
  id: string;
  reason_category: string;
  reason: string;
  status: string;
  estimated_fee_krw: number;
  charged_fee_krw: number;
  fee_status: string;
  created_at: string;
  image: {
    id: string;
    asset_id: string | null;
    title: string;
    storage_path_preview: string | null;
    sales_count: number | null;
    proof_status: string | null;
  } | null;
  requester: { full_name: string | null; avatar_url: string | null } | null;
}

function formatKRW(value: number) {
  return "₩" + value.toLocaleString("ko-KR");
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminImageDeletionRequestsPage() {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/image-deletion-requests?status=${status}`);
      const data = await res.json() as { requests?: DeletionRequest[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "삭제 요청을 불러오지 못했습니다.");
      setRequests(data.requests ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "삭제 요청을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function decide(id: string, decision: "approved" | "rejected", waiveFee = false) {
    const adminNote = prompt(decision === "approved" ? "승인 메모를 입력하세요." : "반려 사유를 입력하세요.", "");
    if (adminNote === null) return;
    if (!confirm(decision === "approved" ? "이 삭제 요청을 승인할까요?" : "이 삭제 요청을 반려할까요?")) return;

    setProcessingId(id);
    try {
      const res = await fetch("/api/admin/image-deletion-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision, adminNote, waiveFee }),
      });
      const data = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(data?.error ?? "요청 처리에 실패했습니다.");
      await loadRequests();
    } catch (error) {
      alert(error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Deletion Review</p>
          <h1 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">이미지 삭제 요청</h1>
          <p className="mt-2 text-sm text-outline">사진작가 삭제 요청을 검토하고 수수료 청구 또는 면제 상태로 처리합니다.</p>
        </div>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
        >
          <option value="pending">대기 중</option>
          <option value="completed">완료</option>
          <option value="rejected">반려</option>
          <option value="all">전체</option>
        </select>
      </div>

      <AdminListSurface className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20">
              {["이미지", "요청자", "사유", "영향도", "수수료", "상태", ""].map((head) => (
                <th key={head} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-20 text-center text-outline">삭제 요청을 불러오는 중...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-20 text-center text-outline">삭제 요청이 없습니다.</td></tr>
            ) : requests.map((request) => (
              <tr key={request.id} className="align-top hover:bg-surface-container-low">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-20 overflow-hidden rounded bg-surface-container-low">
                      {request.image?.storage_path_preview ? (
                        <Image src={request.image.storage_path_preview} alt="" fill sizes="80px" className="object-cover" />
                      ) : (
                        <span className="material-symbols-outlined absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-outline">image</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-64 truncate font-semibold text-on-surface">{request.image?.title ?? "이미지 없음"}</p>
                      <p className="mt-1 text-xs font-mono text-outline">{request.image?.asset_id ?? request.image?.id ?? "-"}</p>
                      <p className="mt-1 text-[10px] text-outline">{formatDate(request.created_at)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-on-surface-variant">{request.requester?.full_name ?? "사진작가"}</td>
                <td className="px-5 py-4">
                  <p className="text-xs font-bold text-primary">{request.reason_category}</p>
                  <p className="mt-1 max-w-xs text-sm leading-relaxed text-on-surface-variant">{request.reason}</p>
                </td>
                <td className="px-5 py-4 text-xs text-on-surface-variant">
                  <AdminInlineMetrics
                    className="max-w-40"
                    items={[
                      { label: "판매", value: `${request.image?.sales_count ?? 0}건` },
                      { label: "증명", value: request.image?.proof_status ?? "-" },
                    ]}
                  />
                </td>
                <td className="px-5 py-4 text-xs text-on-surface-variant">
                  <p className="font-semibold text-on-surface">{formatKRW(request.estimated_fee_krw)}</p>
                  <p className="mt-1">{request.fee_status}</p>
                </td>
                <td className="px-5 py-4">
                  <AdminChip tone={adminStatusTone(request.status)}>{request.status}</AdminChip>
                </td>
                <td className="px-5 py-4">
                  {request.status === "pending" && (
                    <div className="flex flex-col gap-2">
                      <AdminButton
                        onClick={() => decide(request.id, "approved")}
                        disabled={processingId === request.id}
                        variant="primary"
                      >
                        승인/청구
                      </AdminButton>
                      <AdminButton
                        onClick={() => decide(request.id, "approved", true)}
                        disabled={processingId === request.id}
                        variant="secondary"
                      >
                        수수료 면제 승인
                      </AdminButton>
                      <AdminButton
                        onClick={() => decide(request.id, "rejected")}
                        disabled={processingId === request.id}
                        variant="danger"
                      >
                        반려
                      </AdminButton>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminListSurface>
    </div>
  );
}
