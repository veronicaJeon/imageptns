"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PhotographerApprovalGate } from "@/components/dashboard/PhotographerStatusNotice";

type RegistrationState =
  | "not_approved"
  | "waiting_first_sale"
  | "self_funded_available"
  | "self_funded_payment_pending"
  | "not_registered"
  | "available"
  | "requested"
  | "pending"
  | "registered"
  | "failed";

interface BlockchainImage {
  id: string;
  asset_id: string | null;
  title: string;
  category: string | null;
  sales_count: number | null;
  proof_status: string | null;
  proof_requested_at: string | null;
  proof_registered_at: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
  proof_failure_reason: string | null;
  proof_request_fee_payer: string | null;
  proof_request_kind: string | null;
  proof_request_fee_krw: number | null;
  proof_request_payment_status: string | null;
  proof_request_fee_order_id: string | null;
  storage_path_preview: string | null;
  file_size_mb: number | null;
  created_at: string;
  registration_state: RegistrationState;
}

interface ImageTransaction {
  orderNumber: string;
  completedAt: string | null;
  buyer: { name: string | null; email: string | null; walletAddress: string | null };
  licenseCode: string;
  priceKrw: number;
  netKrw: number;
  subscriptionCovered: boolean;
  paymentProvider: string | null;
  paymentTxHash: string | null;
  contractOrderId: string | null;
}

interface ImageTransactionResponse {
  image: {
    ledgerKey: string | null;
    arweave: { originalTxId: string | null; metadataTxId: string | null; manifestTxId: string | null };
  };
  transactions: ImageTransaction[];
}

const STATE_LABELS: Record<RegistrationState, string> = {
  not_approved: "승인 전",
  waiting_first_sale: "첫 판매 대기",
  self_funded_available: "셀프 등록가능",
  self_funded_payment_pending: "수수료 결제대기",
  not_registered: "증명 전",
  available: "등록가능",
  requested: "요청됨",
  pending: "Arweave 등록 중",
  registered: "등록완료",
  failed: "실패",
};

const STATE_STYLES: Record<RegistrationState, string> = {
  not_approved: "bg-surface-container-high text-outline",
  waiting_first_sale: "bg-surface-container-high text-outline",
  self_funded_available: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
  self_funded_payment_pending: "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-200",
  not_registered: "bg-surface-container-high text-outline",
  available: "bg-primary/10 text-primary",
  requested: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-200",
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-200",
  registered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200",
  failed: "bg-error/10 text-error",
};

function isPostSaleSelectable(image: BlockchainImage) {
  return image.registration_state === "available" || image.registration_state === "failed";
}

function isSelfFundedSelectable(image: BlockchainImage) {
  return image.registration_state === "self_funded_available";
}

function canSelect(image: BlockchainImage) {
  return isPostSaleSelectable(image) || isSelfFundedSelectable(image);
}

function arweaveUrl(txId: string) {
  return `https://arweave.net/${txId}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function PhotographerBlockchainContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const feeResult = searchParams.get("fee");
  const [images, setImages] = useState<BlockchainImage[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTransactions, setExpandedTransactions] = useState<string | null>(null);
  const [transactionLoading, setTransactionLoading] = useState<string | null>(null);
  const [transactionsByImage, setTransactionsByImage] = useState<Record<string, ImageTransactionResponse>>({});

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/onchain/registration-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록을 불러오지 못했습니다.");
      setImages(data.images ?? []);
      setSelected((prev) =>
        prev.filter((id) => (data.images ?? []).some((img: BlockchainImage) => img.id === id && canSelect(img))),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const selectableIds = useMemo(() => images.filter(canSelect).map((image) => image.id), [images]);
  const selectedImages = images.filter((image) => selected.includes(image.id));
  const selectedTotalMb = selectedImages.reduce((sum, image) => sum + (Number(image.file_size_mb) || 0), 0);
  const allSelectableChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  const selectedPostSale = selectedImages.filter(isPostSaleSelectable);
  const selectedSelfFunded = selectedImages.filter(isSelfFundedSelectable);
  const selfFundedFeeTotal = selectedSelfFunded.reduce((sum, image) => sum + (image.proof_request_fee_krw ?? 0), 0);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected(allSelectableChecked ? [] : selectableIds);
  }

  async function submitFreeRequest() {
    if (selectedPostSale.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onchain/registration-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: selectedPostSale.map((image) => image.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록 요청에 실패했습니다.");
      await fetchImages();
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function startSelfFundedPayment() {
    if (selectedSelfFunded.length === 0) return;
    setPayingFee(true);
    setError(null);
    try {
      const res = await fetch("/api/onchain/registration-fee/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: selectedSelfFunded.map((image) => image.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "수수료 결제 준비에 실패했습니다.");
      router.push(`/dashboard/blockchain/fee-payment?order=${encodeURIComponent(data.feeOrderId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPayingFee(false);
    }
  }

  async function toggleTransactions(imageId: string) {
    if (expandedTransactions === imageId) {
      setExpandedTransactions(null);
      return;
    }
    setExpandedTransactions(imageId);
    if (transactionsByImage[imageId]) return;

    setTransactionLoading(imageId);
    try {
      const res = await fetch(`/api/images/${imageId}/transactions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "거래내역을 불러오지 못했습니다.");
      setTransactionsByImage((prev) => ({ ...prev, [imageId]: data as ImageTransactionResponse }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTransactionLoading(null);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">블록체인 사진</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            판매 완료 사진은 플랫폼 부담으로, 아직 판매되지 않은 사진은 사진가 부담 셀프 등록으로 Arweave 원본 보관 및 자격증명 등록을 요청합니다.
          </p>
        </div>
        <Link
          href="/dashboard/uploads"
          className="inline-flex w-fit items-center gap-2 rounded border border-outline-variant px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-base">cloud_upload</span>
          업로드 관리
        </Link>
      </div>

      <div className="mb-5 flex flex-col gap-3 bg-surface-container-lowest p-4 shadow-ghost md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant">
          <span>선택 {selected.length}개</span>
          <span>예상 원본 용량 {selectedTotalMb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} MB</span>
          <span>판매완료 {selectedPostSale.length}개</span>
          <span>판매전 셀프 {selectedSelfFunded.length}개</span>
          <span>셀프등록 수수료 ₩{selfFundedFeeTotal.toLocaleString("ko-KR")}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={submitFreeRequest}
            disabled={selectedPostSale.length === 0 || submitting}
            className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface transition-opacity hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {submitting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-base">verified</span>
            )}
            무료 등록 요청
          </button>
          <button
            onClick={startSelfFundedPayment}
            disabled={selectedSelfFunded.length === 0 || payingFee}
            className="inline-flex items-center justify-center gap-2 rounded bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {payingFee ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span className="material-symbols-outlined text-base">payments</span>
            )}
            수수료 결제 후 등록 (₩{selfFundedFeeTotal.toLocaleString("ko-KR")})
          </button>
        </div>
      </div>

      {feeResult === "success" && (
        <div className="mb-5 flex items-start gap-2 border border-emerald-500/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
          <span className="material-symbols-outlined text-base">check_circle</span>
          셀프등록 수수료 결제가 완료되었습니다. 관리자 검토 후 Arweave에 등록됩니다.
        </div>
      )}
      {feeResult === "fail" && (
        <div className="mb-5 flex items-start gap-2 border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined text-base">error</span>
          수수료 결제가 완료되지 않았습니다. 다시 시도해주세요.
        </div>
      )}

      {error && (
        <div className="mb-5 flex items-start gap-2 border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-28 text-outline">
          <span className="material-symbols-outlined text-5xl">verified</span>
          <p className="text-sm">아직 블록체인 등록 대상 사진이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-surface-container-lowest shadow-ghost">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="px-5 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={allSelectableChecked}
                    onChange={toggleAll}
                    disabled={selectableIds.length === 0}
                    aria-label="전체 선택"
                  />
                </th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">사진</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">상태</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">판매</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">용량</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">TxID</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">거래</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">일시</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {images.map((image) => {
                const selectable = canSelect(image);
                const transactionData = transactionsByImage[image.id];
                return (
                  <Fragment key={image.id}>
                  <tr className="hover:bg-surface-container-low">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selected.includes(image.id)}
                        onChange={() => toggle(image.id)}
                        disabled={!selectable}
                        aria-label={`${image.title} 선택`}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-low">
                          {image.storage_path_preview ? (
                            <Image src={image.storage_path_preview} alt={image.title} width={64} height={48} className="h-full w-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-outline">image</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate font-semibold text-on-surface">{image.title}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-outline">{image.asset_id ?? "-"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${STATE_STYLES[image.registration_state]}`}>
                        {STATE_LABELS[image.registration_state]}
                      </span>
                      {image.proof_failure_reason && (
                        <p className="mt-1 max-w-[220px] text-[10px] text-error line-clamp-2">{image.proof_failure_reason}</p>
                      )}
                      {image.registration_state === "self_funded_available" && (
                        <p className="mt-1 max-w-[220px] text-[10px] text-outline">
                          사진가 부담 예상 수수료 ₩{(image.proof_request_fee_krw ?? 0).toLocaleString("ko-KR")}
                        </p>
                      )}
                      {image.registration_state === "self_funded_payment_pending" && (
                        <p className="mt-1 max-w-[220px] text-[10px] text-orange-600">
                          수수료 ₩{(image.proof_request_fee_krw ?? 0).toLocaleString("ko-KR")} 결제 대기 중
                          {image.proof_request_fee_order_id && (
                            <Link
                              href={`/dashboard/blockchain/fee-payment?order=${image.proof_request_fee_order_id}`}
                              className="ml-1 font-bold underline"
                            >
                              결제 이어서
                            </Link>
                          )}
                        </p>
                      )}
                      {image.proof_request_kind === "self_funded" && image.proof_status === "requested" && (
                        <p className="mt-1 max-w-[220px] text-[10px] text-outline">
                          셀프 등록 요청 · ₩{(image.proof_request_fee_krw ?? 0).toLocaleString("ko-KR")}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">{image.sales_count ?? 0}</td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      {(image.file_size_mb ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} MB
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {image.proof_arweave_original_tx_id && (
                          <a href={arweaveUrl(image.proof_arweave_original_tx_id)} target="_blank" rel="noreferrer" className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:opacity-70">
                            원본
                          </a>
                        )}
                        {image.proof_arweave_metadata_tx_id && (
                          <a href={arweaveUrl(image.proof_arweave_metadata_tx_id)} target="_blank" rel="noreferrer" className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:opacity-70">
                            메타데이터
                          </a>
                        )}
                        {!image.proof_arweave_original_tx_id && !image.proof_arweave_metadata_tx_id && (
                          <span className="text-xs text-outline">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => toggleTransactions(image.id)}
                        disabled={transactionLoading === image.id}
                        className="inline-flex items-center gap-1 rounded border border-outline-variant px-3 py-1.5 text-[10px] font-bold text-on-surface-variant hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        {transactionLoading === image.id ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">query_stats</span>
                        )}
                        조회
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs text-on-surface-variant">
                      {image.proof_arweave_confirmed_at
                        ? formatDate(image.proof_arweave_confirmed_at)
                        : image.proof_requested_at
                          ? formatDate(image.proof_requested_at)
                          : formatDate(image.created_at)}
                    </td>
                  </tr>
                  {expandedTransactions === image.id && (
                    <tr>
                      <td colSpan={8} className="bg-surface-container-low px-5 py-4">
                        {!transactionData ? (
                          <p className="text-xs text-outline">거래내역을 불러오는 중입니다.</p>
                        ) : (
                          <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
                            <div className="rounded-lg bg-surface-container-lowest p-3 text-[11px] text-on-surface-variant">
                              <p className="font-bold text-on-surface">이미지 장부 키</p>
                              <p className="mt-1 break-all font-mono text-outline">{transactionData.image.ledgerKey ?? "-"}</p>
                              <p className="mt-3 font-bold text-on-surface">Arweave Tx</p>
                              <p className="mt-1 break-all font-mono text-outline">원본 {transactionData.image.arweave.originalTxId ?? "-"}</p>
                              <p className="mt-1 break-all font-mono text-outline">메타 {transactionData.image.arweave.metadataTxId ?? "-"}</p>
                            </div>
                            <div className="overflow-x-auto rounded-lg bg-surface-container-lowest">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-outline-variant/20 text-outline">
                                    <th className="px-3 py-2 text-left">일시</th>
                                    <th className="px-3 py-2 text-left">구매자</th>
                                    <th className="px-3 py-2 text-left">라이선스</th>
                                    <th className="px-3 py-2 text-right">결제금액</th>
                                    <th className="px-3 py-2 text-right">작가수익</th>
                                    <th className="px-3 py-2 text-left">Base 장부</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-outline-variant/20">
                                  {transactionData.transactions.length === 0 ? (
                                    <tr><td colSpan={6} className="px-3 py-6 text-center text-outline">완료된 거래가 없습니다.</td></tr>
                                  ) : transactionData.transactions.map((tx) => (
                                    <tr key={tx.orderNumber}>
                                      <td className="px-3 py-2 text-on-surface-variant">{formatDate(tx.completedAt)}</td>
                                      <td className="px-3 py-2 text-on-surface-variant">
                                        <p>{tx.buyer.name ?? "-"}</p>
                                        <p className="text-[10px] text-outline">{tx.buyer.email ?? tx.buyer.walletAddress ?? "-"}</p>
                                      </td>
                                      <td className="px-3 py-2 text-on-surface-variant">
                                        {tx.licenseCode}
                                        {tx.subscriptionCovered && <span className="ml-1 text-primary">구독</span>}
                                      </td>
                                      <td className="px-3 py-2 text-right font-semibold text-on-surface">₩{tx.priceKrw.toLocaleString("ko-KR")}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-on-surface">₩{tx.netKrw.toLocaleString("ko-KR")}</td>
                                      <td className="px-3 py-2 font-mono text-[10px] text-outline">
                                        <p>{tx.contractOrderId ?? "-"}</p>
                                        <p className="truncate max-w-[220px]">{tx.paymentTxHash ?? tx.paymentProvider ?? "-"}</p>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function PhotographerBlockchainPage() {
  return (
    <PhotographerApprovalGate>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center">
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <PhotographerBlockchainContent />
      </Suspense>
    </PhotographerApprovalGate>
  );
}
