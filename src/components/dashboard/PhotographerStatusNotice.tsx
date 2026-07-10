"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/store/auth";

type PhotographerStatus = "none" | "pending" | "approved" | "suspended";

const STATUS_COPY: Record<Exclude<PhotographerStatus, "approved">, { icon: string; title: string; body: string; action: string }> = {
  none: {
    icon: "photo_camera",
    title: "사진가 신청이 필요합니다",
    body: "사진 업로드와 판매 기능은 관리자 승인 후 사용할 수 있습니다.",
    action: "신청하러 가기",
  },
  pending: {
    icon: "pending_actions",
    title: "사진가 신청 승인 대기 중",
    body: "신청이 접수되었습니다. 관리자가 통화로 활동 정보를 확인한 뒤 승인 여부를 안내드립니다.",
    action: "신청 정보 보기",
  },
  suspended: {
    icon: "do_not_disturb_on",
    title: "사진가 권한이 중지되었습니다",
    body: "운영 확인이 필요한 상태입니다. 활동 정보를 보완해 사진가 재신청을 접수할 수 있습니다.",
    action: "재신청하기",
  },
};

export function PhotographerStatusNotice({
  status,
  compact = false,
  showAction = true,
  className,
}: {
  status: PhotographerStatus | string | null | undefined;
  compact?: boolean;
  showAction?: boolean;
  className?: string;
}) {
  const normalized: PhotographerStatus =
    status === "pending" || status === "approved" || status === "suspended" ? status : "none";

  if (normalized === "approved") return null;

  const copy = STATUS_COPY[normalized];

  return (
    <div
      className={cn(
        "rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-5 py-4 text-on-surface shadow-ghost",
        compact && "px-3 py-3 shadow-none",
        className,
      )}
    >
      <div className="flex gap-3">
        <span className="material-symbols-outlined mt-0.5 text-xl text-primary">{copy.icon}</span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-bold text-on-surface", compact ? "text-xs" : "text-sm")}>{copy.title}</p>
          <p className={cn("mt-1 leading-relaxed text-on-surface-variant", compact ? "text-[11px]" : "text-sm")}>
            {copy.body}
          </p>
          {showAction && (
            <Link
              href="/dashboard/settings"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-primary hover:underline"
            >
              {copy.action}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function PhotographerApprovalGate({ children }: { children: ReactNode }) {
  const { user, loading, init } = useAuth();

  useEffect(() => {
    init();
  }, [init]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user && user.photographer_status !== "approved") {
    return (
      <div className="p-6 md:p-10">
        <PhotographerStatusNotice status={user.photographer_status} />
      </div>
    );
  }

  return <>{children}</>;
}
