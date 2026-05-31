"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAccount, connect, readContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { getAddress, type Address, type Hex } from "viem";
import { useLang } from "@/lib/i18n/store";
import { useCart, type LicenseType, getLicensePrice } from "@/lib/store/cart";
import { useAuth } from "@/lib/store/auth";
import { ERC20_ABI, IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { isQuoteExpired, type OnchainQuoteSnapshot } from "@/lib/onchain/quote";
import { thumbnailUrlFromPreviewUrl } from "@/lib/supabase/storage";
import { loadPaymentWidget, type PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";

const wagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

type PaymentMethod = "toss" | "base_usdc";

interface OnchainPrepareResponse {
  orderDbId: string;
  contractOrderId: Hex;
  chainId: typeof base.id | typeof baseSepolia.id;
  usdcAddress: Address;
  escrowAddress: Address;
  confirmToken: string;
  cryptoAmount: string;
  quote: OnchainQuoteSnapshot;
  assetIds: Hex[];
  photographers: Address[];
  grossAmounts: string[];
}

interface BasePaymentRecovery {
  orderDbId: string;
  txHash: Hex;
  confirmToken: string;
}

const BASE_RECOVERY_STORAGE_KEY = "imagepartners.basePaymentRecovery";

interface CheckoutPrepareResponse {
  orderId: string;
  orderName: string;
  orderNumber?: string;
  free?: boolean;
}

interface SubscriptionEntitlement {
  active: boolean;
  quota: number;
  used: number;
  remaining: number;
  downloadAccessDays: number;
}

function formatKRW(n: number) {
  return "₩" + n.toLocaleString("ko-KR");
}

function checkoutErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function ensureBaseChainId(chainId: number): OnchainPrepareResponse["chainId"] {
  if (chainId === base.id || chainId === baseSepolia.id) return chainId;
  throw new Error("지원하지 않는 Base 네트워크입니다.");
}

function ensureCurrentBuyerWallet(buyerWalletAddress: Address) {
  const currentAddress = getAccount(wagmiConfig).address;
  if (!currentAddress) throw new Error("지갑 연결이 해제되었습니다. 다시 연결해주세요.");
  if (getAddress(currentAddress) !== getAddress(buyerWalletAddress)) {
    throw new Error("결제 중 지갑 계정이 변경되었습니다. 주문을 생성한 지갑으로 다시 시도해주세요.");
  }
  return getAddress(currentAddress);
}

async function readApiError(response: Response, fallback: string) {
  try {
    const body = await response.json();
    return typeof body?.error === "string" ? body.error : fallback;
  } catch {
    return fallback;
  }
}

function CheckoutContent() {
  const { t } = useLang();
  const ch = t.checkout;
  const { items } = useCart();
  const { user, loading: authLoading, init } = useAuth();
  const router = useRouter();
  const [licensePrices, setLicensePrices] = useState<Partial<Record<LicenseType, number>>>({});
  const [subscriptionEntitlement, setSubscriptionEntitlement] = useState<SubscriptionEntitlement | null>(null);

  useEffect(() => { init(); }, [init]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/checkout");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    fetch("/api/license-types")
      .then((res) => res.ok ? res.json() : null)
      .then((data: { licenses?: { code: LicenseType; price_krw: number }[] } | null) => {
        if (!data?.licenses) return;
        setLicensePrices(Object.fromEntries(data.licenses.map((license) => [license.code, license.price_krw])));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch("/api/subscription")
      .then((res) => res.ok ? res.json() : null)
      .then((data: { entitlement?: SubscriptionEntitlement } | null) => {
        setSubscriptionEntitlement(data?.entitlement ?? null);
      })
      .catch(() => setSubscriptionEntitlement(null));
  }, [user]);

  function displayPrice(license: LicenseType) {
    return licensePrices[license] ?? getLicensePrice(license);
  }

  let remainingSubscriptionDownloads = subscriptionEntitlement?.active ? subscriptionEntitlement.remaining : 0;
  const pricedCartItems = items.map((item) => {
    const originalPrice = displayPrice(item.license);
    const subscriptionCovered = originalPrice > 0 && remainingSubscriptionDownloads > 0;
    if (subscriptionCovered) remainingSubscriptionDownloads -= 1;
    return {
      ...item,
      originalPrice,
      effectivePrice: subscriptionCovered ? 0 : originalPrice,
      subscriptionCovered,
    };
  });
  const subscriptionCoveredCount = pricedCartItems.filter((item) => item.subscriptionCovered).length;
  const subtotal = pricedCartItems.reduce((s, i) => s + i.effectivePrice, 0);
  const originalSubtotal = pricedCartItems.reduce((s, i) => s + i.originalPrice, 0);
  const subscriptionDiscount = Math.max(0, originalSubtotal - subtotal);
  const vat      = Math.round(subtotal * 0.1);
  const total    = subtotal + vat;

  const [billing, setBilling]   = useState({ name: "", email: "", company: "" });
  const [loading, setLoading]   = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("toss");
  const [baseRecovery, setBaseRecovery] = useState<BasePaymentRecovery | null>(null);
  const widgetRef = useRef<PaymentWidgetInstance | null>(null);
  const displayVat = paymentMethod === "base_usdc" ? 0 : vat;
  const displayTotal = subtotal + displayVat;
  const isFreeCheckout = total === 0;

  // Pre-fill billing from user profile
  useEffect(() => {
    if (user) {
      setBilling((b) => ({
        ...b,
        name:  b.name  || user.full_name || "",
        email: b.email || user.email     || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(BASE_RECOVERY_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as BasePaymentRecovery;
      if (parsed.orderDbId && parsed.txHash && parsed.confirmToken) setBaseRecovery(parsed);
    } catch {
      window.localStorage.removeItem(BASE_RECOVERY_STORAGE_KEY);
    }
  }, []);

  function persistBaseRecovery(recovery: BasePaymentRecovery | null) {
    setBaseRecovery(recovery);
    if (typeof window === "undefined") return;
    if (recovery) window.localStorage.setItem(BASE_RECOVERY_STORAGE_KEY, JSON.stringify(recovery));
    else window.localStorage.removeItem(BASE_RECOVERY_STORAGE_KEY);
  }

  function setB(k: keyof typeof billing) {
    return (v: string) => setBilling((p) => ({ ...p, [k]: v }));
  }

  // Load Toss widget when total is ready
  useEffect(() => {
    if (!total || typeof window === "undefined") return;

    let mounted = true;
    loadPaymentWidget(
      process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!,
      billing.email || "@@ANONYMOUS"
    ).then((widget) => {
      if (!mounted) return;
      widgetRef.current = widget;
      widget.renderPaymentMethods("#toss-payment-widget", { value: total }, { variantKey: "DEFAULT" });
      widget.renderAgreement("#toss-agreement-widget", { variantKey: "AGREEMENT" });
      setWidgetReady(true);
    }).catch(console.error);

    return () => { mounted = false; };
  // Re-init if total changes
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!billing.name || !billing.email) return;

    if (isFreeCheckout) {
      await handleFreeCheckout();
      return;
    }

    if (paymentMethod === "toss") {
      if (!widgetRef.current) return;
      await handleTossPayment();
      return;
    }

    await handleBaseUsdcPayment();
  }

  async function handleTossPayment() {
    const widget = widgetRef.current;
    if (!widget) return;

    setLoading(true);

    try {
      // 1. Create order in DB
      const prepRes = await fetch("/api/checkout/prepare", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, license: i.license, price: i.price })),
          billing,
        }),
      });
      if (!prepRes.ok) throw new Error("주문 생성 실패");
      const { orderId, orderName } = await prepRes.json() as CheckoutPrepareResponse;

      // 2. Launch Toss payment (widget handles payment UI)
      await widget.requestPayment({
        orderId,
        orderName,
        customerName:  billing.name,
        customerEmail: billing.email,
        successUrl: `${window.location.origin}/api/checkout/confirm`,
        failUrl:    `${window.location.origin}/checkout/fail`,
      });
    } catch (err) {
      console.error(err);
      alert(checkoutErrorMessage(err, "결제를 시작하지 못했습니다."));
      setLoading(false);
    }
  }

  async function handleFreeCheckout() {
    setLoading(true);
    try {
      const prepRes = await fetch("/api/checkout/prepare", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, license: i.license, price: i.price })),
          billing,
        }),
      });
      if (!prepRes.ok) throw new Error(await readApiError(prepRes, "무료 주문 생성 실패"));

      const { orderNumber } = await prepRes.json() as CheckoutPrepareResponse;
      router.push(`/checkout/success?order=${encodeURIComponent(orderNumber ?? "")}`);
    } catch (err) {
      console.error(err);
      alert(checkoutErrorMessage(err, "무료 구매를 완료하지 못했습니다."));
      setLoading(false);
    }
  }

  async function handleBaseUsdcPayment() {
    setLoading(true);
    let preparedForRecovery: OnchainPrepareResponse | null = null;
    let purchaseTxHash: Hex | null = null;

    try {
      if (typeof window === "undefined" || !("ethereum" in window)) {
        throw new Error("브라우저 지갑을 찾을 수 없습니다. MetaMask 또는 Base 호환 지갑을 설치해주세요.");
      }

      const connector = wagmiConfig.connectors[0];
      if (!connector) throw new Error("사용 가능한 지갑 커넥터가 없습니다.");

      let account = getAccount(wagmiConfig);
      if (!account.address) {
        await connect(wagmiConfig, { connector });
        account = getAccount(wagmiConfig);
      }

      if (!account.address) throw new Error("지갑 연결을 완료해주세요.");
      const buyerWalletAddress = account.address;

      const prepRes = await fetch("/api/onchain/checkout/prepare", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, license: i.license })),
          billing,
          buyerWalletAddress,
        }),
      });
      if (!prepRes.ok) throw new Error(await readApiError(prepRes, "Base USDC 주문 생성 실패"));

      const prepared = await prepRes.json() as OnchainPrepareResponse;
      preparedForRecovery = prepared;
      if (isQuoteExpired(prepared.quote.expiresAt)) {
        throw new Error("USDC 견적이 만료되었습니다. 결제를 다시 시작해주세요.");
      }
      const targetChainId = ensureBaseChainId(prepared.chainId);

      account = getAccount(wagmiConfig);
      if (account.chainId !== targetChainId) {
        await switchChain(wagmiConfig, { chainId: targetChainId });
      }
      ensureCurrentBuyerWallet(buyerWalletAddress);

      const cryptoAmount = BigInt(prepared.cryptoAmount);
      const grossAmounts = prepared.grossAmounts.map((amount) => BigInt(amount));
      const currentAllowance = await readContract(wagmiConfig, {
        address: prepared.usdcAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [buyerWalletAddress, prepared.escrowAddress],
        chainId: targetChainId,
      });

      if (currentAllowance < cryptoAmount) {
        const approvalAccount = ensureCurrentBuyerWallet(buyerWalletAddress);
        const approveHash = await writeContract(wagmiConfig, {
          address: prepared.usdcAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [prepared.escrowAddress, cryptoAmount],
          account: approvalAccount,
          chainId: targetChainId,
        });
        const approvalReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: approveHash, chainId: targetChainId });
        if (approvalReceipt.status !== "success") {
          throw new Error("USDC 승인 트랜잭션이 실패했습니다. 지갑에서 상태를 확인한 뒤 다시 시도해주세요.");
        }
      }

      if (isQuoteExpired(prepared.quote.expiresAt)) {
        throw new Error("USDC 견적이 만료되었습니다. 주문 금액 보호를 위해 결제를 다시 시작해주세요.");
      }

      const purchaseAccount = ensureCurrentBuyerWallet(buyerWalletAddress);
      const purchaseHash = await writeContract(wagmiConfig, {
        address: prepared.escrowAddress,
        abi: IMAGE_PARTNERS_ESCROW_ABI,
        functionName: "purchase",
        args: [prepared.contractOrderId, prepared.assetIds, prepared.photographers, grossAmounts],
        account: purchaseAccount,
        chainId: targetChainId,
      });
      const purchaseReceipt = await waitForTransactionReceipt(wagmiConfig, { hash: purchaseHash, chainId: targetChainId });
      if (purchaseReceipt.status !== "success") {
        throw new Error("구매 트랜잭션이 실패했습니다. 지갑에서 상태를 확인한 뒤 다시 시도해주세요.");
      }
      purchaseTxHash = purchaseReceipt.transactionHash;
      persistBaseRecovery({
        orderDbId: prepared.orderDbId,
        txHash: purchaseReceipt.transactionHash,
        confirmToken: prepared.confirmToken,
      });

      const confirmRes = await fetch("/api/onchain/checkout/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderDbId: prepared.orderDbId,
          txHash: purchaseReceipt.transactionHash,
          confirmToken: prepared.confirmToken,
        }),
      });
      if (!confirmRes.ok) throw new Error(await readApiError(confirmRes, "Base USDC 결제 확인 실패"));

      const { orderNumber } = await confirmRes.json() as { orderNumber?: string };
      persistBaseRecovery(null);
      router.push(`/checkout/success?order=${encodeURIComponent(orderNumber ?? "")}`);
    } catch (err) {
      console.error(err);
      if (preparedForRecovery && purchaseTxHash) {
        persistBaseRecovery({
          orderDbId: preparedForRecovery.orderDbId,
          txHash: purchaseTxHash,
          confirmToken: preparedForRecovery.confirmToken,
        });
      }
      alert(checkoutErrorMessage(err, "Base USDC 결제를 완료하지 못했습니다."));
      setLoading(false);
    }
  }

  async function retryBaseConfirmation() {
    if (!baseRecovery) return;
    setLoading(true);
    try {
      const confirmRes = await fetch("/api/onchain/checkout/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(baseRecovery),
      });
      if (!confirmRes.ok) throw new Error(await readApiError(confirmRes, "Base USDC 결제 확인 실패"));

      const { orderNumber } = await confirmRes.json() as { orderNumber?: string };
      persistBaseRecovery(null);
      router.push(`/checkout/success?order=${encodeURIComponent(orderNumber ?? "")}`);
    } catch (err) {
      console.error(err);
      alert(checkoutErrorMessage(err, "Base USDC 결제 확인을 다시 완료하지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="pt-36 pb-24 flex items-center justify-center min-h-screen">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="pt-36 pb-24 px-6 bg-surface min-h-screen flex flex-col items-center justify-center gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl">shopping_cart</span>
        <p>Your cart is empty.</p>
        <Link href="/library" className="text-primary font-bold text-sm hover:underline">Browse Library</Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-6 md:px-8 bg-surface min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-10">{ch.title}</h1>

        <div className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { icon: "receipt_long", title: "주문 확인", body: "라이선스와 결제 금액을 확정합니다." },
            { icon: "payments", title: "결제 진행", body: "카드 또는 Base USDC로 구매를 완료합니다." },
            { icon: "download", title: "원본 다운로드", body: "결제 완료 즉시 다운로드 권한이 열립니다." },
          ].map((step, index) => (
            <div key={step.title} className="bg-surface-container-lowest px-4 py-4 shadow-ghost">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-black text-on-primary">
                  {index + 1}
                </span>
                <span className="material-symbols-outlined text-base text-primary">{step.icon}</span>
                <p className="text-sm font-bold text-on-surface">{step.title}</p>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-outline">{step.body}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Payment form */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 flex flex-col gap-8">

            {/* Billing info */}
            <div>
              <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-5">{ch.billingTitle}</h2>
              <div className="flex flex-col gap-4">
                {[
                  { key: "name",    label: ch.name,    placeholder: "Jane Smith",          type: "text" },
                  { key: "email",   label: ch.email,   placeholder: "you@example.com",     type: "email" },
                  { key: "company", label: ch.company, placeholder: "Acme Publishing Co.", type: "text" },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key} className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest">{label}</label>
                    <input
                      type={type}
                      value={billing[key as keyof typeof billing]}
                      onChange={(e) => setB(key as keyof typeof billing)(e.target.value)}
                      placeholder={placeholder}
                      required={key !== "company"}
                      className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div>
              <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-5">{ch.paymentMethod}</h2>
              {isFreeCheckout ? (
                <div className="mb-5 rounded-lg bg-green-50 p-4 text-sm text-green-800 ring-1 ring-green-200 dark:bg-green-900/20 dark:text-green-200 dark:ring-green-900/50">
                  <p className="font-bold">{subscriptionCoveredCount > 0 ? "구독 무료다운 주문" : "무료 라이선스 주문"}</p>
                  <p className="mt-1 text-xs leading-relaxed">
                    결제 수단 입력 없이 구매가 확정되고 원본 다운로드 권한이 즉시 생성됩니다.
                  </p>
                </div>
              ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("toss")}
                  className={`p-4 ring-1 rounded-lg text-left transition-all ${
                    paymentMethod === "toss"
                      ? "bg-primary/5 ring-primary"
                      : "bg-surface-container-lowest ring-outline-variant hover:ring-outline"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
                    <span className="material-symbols-outlined text-base">credit_card</span>
                    Toss Payments
                  </span>
                  <span className="block mt-2 text-[11px] leading-relaxed text-outline">
                    카드 및 국내 간편결제
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("base_usdc")}
                  className={`p-4 ring-1 rounded-lg text-left transition-all ${
                    paymentMethod === "base_usdc"
                      ? "bg-primary/5 ring-primary"
                      : "bg-surface-container-lowest ring-outline-variant hover:ring-outline"
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-on-surface">
                    <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                    USDC on Base
                  </span>
                  <span className="block mt-2 text-[11px] leading-relaxed text-outline">
                    Base 지갑으로 온체인 결제
                  </span>
                </button>
              </div>
              )}

              <div className={!isFreeCheckout && paymentMethod === "toss" ? "block" : "hidden"}>
                <div id="toss-payment-widget" className="min-h-[100px]" />
                <div id="toss-agreement-widget" className="mt-4" />
                {!widgetReady && (
                  <div className="flex items-center justify-center py-8 text-outline gap-2">
                    <span className="w-5 h-5 border-2 border-outline border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs">결제 위젯 로딩 중...</span>
                  </div>
                )}
              </div>

              {!isFreeCheckout && paymentMethod === "base_usdc" && (
                <div className="bg-surface-container-lowest ring-1 ring-outline-variant rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-xl mt-0.5">currency_exchange</span>
                    <div>
                      <p className="text-sm font-bold text-on-surface">Base USDC 결제</p>
                      <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                        지갑 연결 후 Base 네트워크에서 USDC 승인과 구매 트랜잭션을 순서대로 진행합니다.
                      </p>
                      <p className="text-[11px] text-outline mt-3">
                        최종 USDC 금액은 주문 생성 시점에 15분 유효한 견적으로 고정됩니다.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-on-surface-variant">
                    <div className="bg-surface-container-low px-3 py-2">
                      <p className="font-bold text-on-surface">1. Approve</p>
                      <p className="mt-1">USDC 사용 권한을 승인합니다.</p>
                    </div>
                    <div className="bg-surface-container-low px-3 py-2">
                      <p className="font-bold text-on-surface">2. Purchase</p>
                      <p className="mt-1">Base에서 구매 트랜잭션을 전송합니다.</p>
                    </div>
                    <div className="bg-surface-container-low px-3 py-2">
                      <p className="font-bold text-on-surface">3. Confirm</p>
                      <p className="mt-1">서버가 tx를 검증해 다운로드 권한을 엽니다.</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-outline">
                    <span className="material-symbols-outlined text-sm text-amber-500 mt-0.5">info</span>
                    <p>
                      purchase가 성공했는데 화면이 멈추면 아래 재확인 버튼이나 주문 내역의 tx 정보를 사용해 복구할 수 있습니다.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {baseRecovery && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300/40 p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-600 text-xl mt-0.5">sync</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface">Base 결제 확인 재시도가 필요합니다</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      구매 tx는 감지됐지만 서버 확인이 끝나지 않았습니다.
                    </p>
                    <p className="text-[10px] font-mono text-outline mt-2 truncate">tx {baseRecovery.txHash}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={retryBaseConfirmation}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    결제 확인 다시 시도
                  </button>
                  <Link href="/dashboard/orders" className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary">
                    주문 내역 보기
                  </Link>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || (!isFreeCheckout && paymentMethod === "toss" && !widgetReady)}
              className="w-full py-4 bg-primary text-white font-bold text-sm uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : (
                  <>
                    <span className="material-symbols-outlined text-base">
                      {isFreeCheckout ? "redeem" : paymentMethod === "base_usdc" ? "account_balance_wallet" : "lock"}
                    </span>
                    {isFreeCheckout ? "무료 구매 확정" : paymentMethod === "base_usdc" ? "Pay with USDC" : ch.submitBtn} · {formatKRW(displayTotal)}
                  </>
                )
              }
            </button>

            <p className="text-[10px] text-outline text-center">{ch.secureNote}</p>
            <p className="text-center text-[11px] leading-relaxed text-on-surface-variant">
              결제가 승인되면 구매한 이미지의 원본 파일 다운로드 권한이 자동으로 생성됩니다.
              완료 화면 또는 대시보드의 주문 내역에서 다시 다운로드할 수 있습니다.
            </p>
          </form>

          {/* Order summary */}
          <div className="lg:col-span-5">
            <div className="bg-surface-container-lowest shadow-ghost p-6 sticky top-28">
              <h2 className="font-headline font-bold text-on-surface mb-6">{ch.orderSummary}</h2>

              <div className="flex flex-col gap-4 mb-6 max-h-64 overflow-y-auto pr-1">
                {pricedCartItems.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <Image
                      src={thumbnailUrlFromPreviewUrl(item.src, 160, 120)}
                      alt={item.title}
                      width={56}
                      height={40}
                      className="object-cover rounded shrink-0"
                      unoptimized
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">{item.title}</p>
                      <p className="text-[10px] text-outline capitalize">{item.license}</p>
                      {item.subscriptionCovered && (
                        <p className="mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary w-fit">
                          구독 무료다운 적용
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-bold text-on-surface">{formatKRW(item.effectivePrice)}</p>
                      {item.subscriptionCovered && (
                        <p className="text-[10px] text-outline line-through">{formatKRW(item.originalPrice)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {subscriptionEntitlement?.active && (
                <div className="mb-4 rounded-lg bg-primary/8 px-4 py-3 text-xs text-on-surface-variant">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-on-surface">구독 활성</span>
                    <span className="text-primary font-bold">
                      잔여 {subscriptionEntitlement.remaining.toLocaleString("ko-KR")} / {subscriptionEntitlement.quota.toLocaleString("ko-KR")}개
                    </span>
                  </div>
                  <p className="mt-1 leading-relaxed">
                    이번 주문에서 {subscriptionCoveredCount.toLocaleString("ko-KR")}개가 무료다운으로 적용됩니다.
                    다운로드 권한은 구매 확정일부터 {subscriptionEntitlement.downloadAccessDays.toLocaleString("ko-KR")}일간 유지됩니다.
                  </p>
                </div>
              )}

              <div className="border-t border-outline-variant/20 pt-4 flex flex-col gap-2 text-sm">
                {subscriptionDiscount > 0 && (
                  <div className="flex justify-between text-primary">
                    <span>구독 무료다운 할인</span><span>-{formatKRW(subscriptionDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-on-surface-variant">
                  <span>{t.cart.subtotal}</span><span>{formatKRW(subtotal)}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>{t.cart.vat}</span><span>{formatKRW(displayVat)}</span>
                </div>
                {paymentMethod === "base_usdc" && (
                  <p className="text-[11px] leading-relaxed text-outline">
                    Base USDC MVP는 라이선스 금액만 온체인 escrow로 결제합니다.
                  </p>
                )}
                <div className="flex justify-between font-bold text-base pt-2 border-t border-outline-variant/20">
                  <span className="text-on-surface">{t.cart.total}</span>
                  <span className="text-primary">{formatKRW(displayTotal)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <CheckoutContent />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
