"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAddress } from "viem";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PhotographerStatusNotice } from "@/components/dashboard/PhotographerStatusNotice";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

interface SubscriptionEntitlement {
  active: boolean;
  quota: number;
  used: number;
  remaining: number;
  downloadAccessDays: number;
}

interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
}

type PhotographerStatus = "none" | "pending" | "approved" | "suspended";

interface PhotographerApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
}

const BASE_SEPOLIA_CHAIN_ID_HEX = "0x14a34";
const ONCHAIN_ENABLED = process.env.NEXT_PUBLIC_ONCHAIN_ENABLED === "true";

export default function SettingsPage() {
  const { t } = useLang();
  const s = t.dashboard.settings;
  const { user, init } = useAuth();

  const [name, setName]   = useState("");
  const [organization, setOrganization] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio]     = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [activityRegions, setActivityRegions] = useState("");
  const [photographerStatus, setPhotographerStatus] = useState<PhotographerStatus>("none");
  const [photographerApplication, setPhotographerApplication] = useState<PhotographerApplication | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState({ sales: true, reviews: true, newsletter: false });
  const [notifSaving, setNotifSaving] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);
  const [subscriptionEntitlement, setSubscriptionEntitlement] = useState<SubscriptionEntitlement | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeDone, setUpgradeDone] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [walletConnecting, setWalletConnecting] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [withdrawalLoading, setWithdrawalLoading] = useState(false);
  const [withdrawalRequested, setWithdrawalRequested] = useState(false);

  // Load subscription
  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then(({ subscription: sub, entitlement }: { subscription: Subscription | null; entitlement?: SubscriptionEntitlement }) => {
        setSubscription(sub ?? null);
        setSubscriptionEntitlement(entitlement ?? null);
      })
      .catch(() => {
        setSubscription(null);
        setSubscriptionEntitlement(null);
      });
  }, []);

  async function handleCancelSubscription() {
    if (!confirm("구독을 취소하시겠습니까? 현재 결제 기간이 종료될 때까지는 계속 이용하실 수 있습니다.")) return;
    setCancelLoading(true);
    try {
      const res = await fetch("/api/subscription", { method: "DELETE" });
      if (res.ok) {
        setCancelDone(true);
        setSubscription((s) =>
          s ? { ...s, cancel_at_period_end: true } : s
        );
      }
    } finally {
      setCancelLoading(false);
    }
  }

  // Load real profile data
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ profile }) => {
        if (!profile) return;
        setName(profile.full_name ?? "");
        setOrganization(profile.organization ?? "");
        setEmail(profile.email ?? "");
        setBio(profile.bio ?? "");
        setWalletAddress(profile.wallet_address ?? "");
        setPhoneNumber(profile.phone_number ?? "");
        setActivityRegions((profile.primary_activity_regions ?? []).join("\n"));
        setPhotographerStatus(
          profile.photographer_status === "pending" ||
          profile.photographer_status === "approved" ||
          profile.photographer_status === "suspended"
            ? profile.photographer_status
            : "none",
        );
        setPhotographerApplication(profile.photographer_application ?? null);
        setNotifications({
          sales:      profile.notif_sales      ?? true,
          reviews:    profile.notif_reviews    ?? true,
          newsletter: profile.notif_newsletter ?? false,
        });
      })
      .catch(() => {
        // Unauthenticated — use auth store fallback
        if (user) {
          setName(user.full_name);
          setOrganization(user.organization ?? "");
          setEmail(user.email);
          setPhotographerStatus(user.photographer_status);
        }
      });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaveError("");
    try {
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          organization,
          phone_number: phoneNumber,
          bio,
          ...(ONCHAIN_ENABLED ? { wallet_address: walletAddress } : {}),
          ...(photographerStatus !== "none"
            ? { primary_activity_regions: activityRegions }
            : {}),
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        // Silently refresh auth store in background (don't await — avoids hang)
        init().catch(() => {});
      } else {
        const { error } = await res.json().catch(() => ({ error: "" }));
        setSaveError(error || "프로필 저장 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgradeToPhotographer() {
    if (!confirm("사진작가 신청을 접수하시겠습니까?\n관리자 확인 후 이미지 업로드 및 사용권 판매 기능이 활성화됩니다.")) return;
    setUpgradeLoading(true);
    setUpgradeError("");
    try {
      const res = await fetch("/api/profile/upgrade-to-photographer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          organization,
          phone_number: phoneNumber,
          primary_activity_regions: activityRegions,
          bio,
        }),
      });
      const body = await res.json().catch(() => null) as {
        error?: string;
        photographer_status?: PhotographerStatus;
        application?: PhotographerApplication | null;
      } | null;
      if (res.ok) {
        setPhotographerStatus(body?.photographer_status ?? "pending");
        if (body?.application) {
          setPhotographerApplication((current) => ({
            id: body.application?.id ?? current?.id ?? "",
            status: "pending",
            rejection_reason: null,
            created_at: body.application?.created_at ?? current?.created_at ?? new Date().toISOString(),
            reviewed_at: null,
          }));
        }
        setUpgradeDone(true);
        await init();
      } else {
        setUpgradeError(body?.error ?? "사진작가 신청을 접수하지 못했습니다.");
      }
    } finally {
      setUpgradeLoading(false);
    }
  }

  async function handleRequestWithdrawal() {
    if (!confirm("계정 삭제 요청을 접수하시겠습니까?\n주문, 사용권 판매, 정산, 온체인 증명 이력이 있는 경우 관리자가 정합성을 확인한 뒤 처리합니다.")) return;
    setWithdrawalLoading(true);
    try {
      const res = await fetch("/api/profile/withdrawal-request", { method: "POST" });
      const body = await res.json().catch(() => null) as { error?: string; alreadyExists?: boolean } | null;
      if (!res.ok) {
        alert(body?.error ?? "계정 삭제 요청을 접수하지 못했습니다.");
        return;
      }
      setWithdrawalRequested(true);
      alert(body?.alreadyExists ? "이미 접수된 계정 삭제 검토 요청이 있습니다." : "계정 삭제 검토 요청이 접수되었습니다.");
    } finally {
      setWithdrawalLoading(false);
    }
  }

  function browserEthereum(): EthereumProvider | null {
    if (typeof window === "undefined") return null;
    const maybeWindow = window as Window & { ethereum?: EthereumProvider };
    return maybeWindow.ethereum ?? null;
  }

  async function ensureBaseSepolia(ethereum: EthereumProvider) {
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? (error as { code?: number }).code : null;
      if (code !== 4902) throw error;

      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
          chainName: "Base Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://sepolia.base.org"],
          blockExplorerUrls: ["https://sepolia.basescan.org"],
        }],
      });
    }
  }

  async function handleConnectWallet() {
    setWalletError("");
    const ethereum = browserEthereum();
    if (!ethereum) {
      setWalletError("MetaMask 또는 Base 호환 브라우저 지갑을 설치해주세요.");
      return;
    }

    setWalletConnecting(true);
    try {
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const account = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      if (!account) throw new Error("지갑 연결을 완료해주세요.");

      await ensureBaseSepolia(ethereum);
      setWalletAddress(getAddress(account));
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "지갑 연결에 실패했습니다.");
    } finally {
      setWalletConnecting(false);
    }
  }

  async function toggleNotif(key: "sales" | "reviews" | "newsletter") {
    const next = { ...notifications, [key]: !notifications[key] };
    setNotifications(next);
    setNotifSaving(true);
    try {
      await fetch("/api/profile/notifications", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notif_sales:      next.sales,
          notif_reviews:    next.reviews,
          notif_newsletter: next.newsletter,
        }),
      });
    } finally {
      setNotifSaving(false);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-10 tracking-tight">{s.title}</h1>

      {/* Profile */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-6 pb-3 border-b border-outline-variant/20">
          {s.sections.profile}
        </h2>
        <form onSubmit={handleSave} className="flex flex-col gap-5">
          {/* Avatar */}
          <div className="flex items-center gap-5 mb-2">
            <div className="w-16 h-16 rounded-full bg-primary-container flex items-center justify-center shrink-0 overflow-hidden">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-3xl text-on-primary-container">person</span>
              )}
            </div>
          </div>

          <Input label={s.nameLabel}  type="text"  value={name}  onChange={(e) => setName(e.target.value)}  icon="person" />
          <Input
            label="소속(기관/업체/개인 활동명)"
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            icon="business"
            placeholder="예: ○○출판사, 국립○○박물관, 프리랜서"
          />
          <Input label={s.emailLabel} type="email" value={email} disabled icon="mail" />
          <Input
            label="연락처"
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            icon="phone"
            placeholder="010-1234-5678"
          />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-outline uppercase tracking-widest">{s.bioLabel}</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
              placeholder="Tell us about yourself…"
            />
          </div>

          {photographerStatus === "approved" && (
            <div className="flex flex-col gap-5">
              {ONCHAIN_ENABLED && <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">{s.regionsLabel}</label>
                <textarea
                  value={activityRegions}
                  onChange={(e) => setActivityRegions(e.target.value)}
                  rows={3}
                  className="w-full bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
                  placeholder={s.regionsPlaceholder}
                />
                <p className="text-xs text-outline">{s.regionsHint}</p>
              </div>}

              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <Input
                    label="Base 지갑 주소"
                    type="text"
                    value={walletAddress}
                    onChange={(e) => {
                      setWalletAddress(e.target.value);
                      setWalletError("");
                    }}
                    icon="account_balance_wallet"
                    placeholder="0x..."
                    hint="이미지 승인 증명과 USDC 정산에 사용할 Base 지갑입니다."
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    loading={walletConnecting}
                    onClick={handleConnectWallet}
                    className="h-12 shrink-0 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-base">account_balance_wallet</span>
                    MetaMask 연결
                  </Button>
                </div>
                {walletError && (
                  <p className="text-xs text-error flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">error</span>
                    {walletError}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" size="md" loading={loading}>{s.saveBtn}</Button>
            {saved && (
              <span className="text-sm text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Saved!
              </span>
            )}
          </div>
          {saveError && (
            <p className="text-xs text-error flex items-center gap-1">
              <span className="material-symbols-outlined text-base">error</span>
              {saveError}
            </p>
          )}
        </form>
      </section>

      {/* Notifications */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-6 pb-3 border-b border-outline-variant/20">
          {s.sections.notifications}
        </h2>
        <div className="flex flex-col gap-4">
          {(["sales", "reviews", "newsletter"] as const).map((key) => {
            const labels: Record<string, string> = {
              sales:      "Sales & downloads",
              reviews:    "Upload review updates",
              newsletter: "Newsletter & promotions",
            };
            return (
              <div key={key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-on-surface min-w-0 truncate">{labels[key]}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={notifications[key]}
                  disabled={notifSaving}
                  onClick={() => toggleNotif(key)}
                  className={[
                    "relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 shrink-0 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    notifications[key] ? "bg-primary" : "bg-outline-variant",
                  ].join(" ")}
                >
                  <span className={[
                    "absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    notifications[key] ? "translate-x-5" : "translate-x-0",
                  ].join(" ")} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Role Management */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-6 pb-3 border-b border-outline-variant/20">
          계정 역할
        </h2>

        {photographerStatus === "approved" ? (
          <div className="flex items-center gap-3 px-5 py-4 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="material-symbols-outlined text-xl text-primary">photo_camera</span>
            <div>
              <p className="text-sm font-bold text-on-surface">사진작가 계정</p>
              <p className="text-xs text-on-surface-variant mt-0.5">관리자 승인이 완료되어 이미지 업로드 및 사용권 판매 기능을 사용할 수 있습니다.</p>
            </div>
          </div>
        ) : photographerStatus === "pending" || upgradeDone ? (
          <div className="flex flex-col gap-4">
            <PhotographerStatusNotice status="pending" showAction={false} />
            {photographerApplication?.created_at && (
              <p className="text-xs text-outline">
                신청 접수일: {new Date(photographerApplication.created_at).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </div>
        ) : (
          <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-xl text-outline mt-0.5">
                {photographerStatus === "suspended" ? "do_not_disturb_on" : "shopping_bag"}
              </span>
              <div>
                <p className="text-sm font-bold text-on-surface">
                  {photographerStatus === "suspended" ? "사진작가 권한 중지" : "현재 역할: 구매자"}
                </p>
                <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">
                  사진작가 신청을 접수하면 관리자가 통화로 활동 정보를 확인한 뒤 승인합니다.<br />
                  승인 전에도 기존 구매자 기능은 그대로 이용할 수 있습니다.
                </p>
                {photographerApplication?.rejection_reason && (
                  <p className="mt-2 text-xs text-error">최근 검토 메모: {photographerApplication.rejection_reason}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 text-xs text-on-surface-variant pl-8">
              {["관리자 확인 후 이미지 업로드 가능", "승인된 이미지 라이브러리 노출", "판매 수익 정산 (판매가의 80%)"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-primary">check</span>
                  {item}
                </div>
              ))}
            </div>
            <div className="grid gap-4">
              <Input
                label="연락처"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                icon="phone"
                placeholder="+82 10 1234 5678"
              />
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-outline uppercase tracking-widest">주요 활동 지역</label>
                <textarea
                  value={activityRegions}
                  onChange={(e) => setActivityRegions(e.target.value)}
                  rows={3}
                  className="w-full bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
                  placeholder={s.regionsPlaceholder}
                />
                <p className="text-xs text-outline">{s.regionsHint}</p>
              </div>
            </div>
            {upgradeError && (
              <p className="text-xs text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-base">error</span>
                {upgradeError}
              </p>
            )}
            <button
              type="button"
              onClick={handleUpgradeToPhotographer}
              disabled={upgradeLoading}
              className="self-start flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-all disabled:opacity-50"
            >
              {upgradeLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-sm">photo_camera</span>
              )}
              {upgradeLoading ? "신청 중…" : photographerStatus === "suspended" ? "사진작가 재신청" : "사진작가 신청"}
            </button>
          </div>
        )}
      </section>

      {/* Subscription */}
      <section className="mb-10">
        <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-6 pb-3 border-b border-outline-variant/20">
          구독 관리
        </h2>

        {subscription === undefined && (
          <div className="flex items-center gap-2 text-outline text-sm">
            <span className="w-4 h-4 border-2 border-outline border-t-transparent rounded-full animate-spin" />
            불러오는 중…
          </div>
        )}

        {subscription === null && (
          <div className="flex flex-col gap-4 p-5 bg-surface-container-low rounded-lg">
            <p className="text-sm text-on-surface-variant">현재 활성 구독이 없습니다.</p>
            <Link
              href="/pricing"
              className="self-start px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
            >
              요금제 보기
            </Link>
          </div>
        )}

        {subscription && (
          <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-outline uppercase tracking-widest mb-1">현재 플랜</p>
                <p className="text-on-surface font-bold capitalize text-lg">{subscription.plan}</p>
              </div>
              {subscription.current_period_end && (
                <div className="text-right">
                  <p className="text-xs text-outline uppercase tracking-widest mb-1">
                    {subscription.cancel_at_period_end ? "구독 종료일" : "다음 결제일"}
                  </p>
                  <p className="text-on-surface font-semibold text-sm">
                    {new Date(subscription.current_period_end).toLocaleDateString("ko-KR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              )}
            </div>

            {subscriptionEntitlement?.active && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-surface-container-lowest px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline">무료다운 잔여</p>
                  <p className="mt-1 text-lg font-black text-primary">
                    {subscriptionEntitlement.remaining.toLocaleString("ko-KR")}
                    <span className="text-xs font-bold text-outline"> / {subscriptionEntitlement.quota.toLocaleString("ko-KR")}개</span>
                  </p>
                </div>
                <div className="rounded-lg bg-surface-container-lowest px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline">이번 기간 사용</p>
                  <p className="mt-1 text-lg font-black text-on-surface">{subscriptionEntitlement.used.toLocaleString("ko-KR")}개</p>
                </div>
                <div className="rounded-lg bg-surface-container-lowest px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline">다운로드 보존</p>
                  <p className="mt-1 text-lg font-black text-on-surface">{subscriptionEntitlement.downloadAccessDays.toLocaleString("ko-KR")}일</p>
                </div>
              </div>
            )}

            {subscription.cancel_at_period_end ? (
              <div className="flex items-center gap-2 text-sm text-on-surface-variant bg-surface-container-lowest rounded px-4 py-3">
                <span className="material-symbols-outlined text-base text-outline">info</span>
                기간 종료 후 자동으로 해지됩니다. 재구독을 원하시면 요금제 페이지를 방문하세요.
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelLoading || cancelDone}
                className="self-start px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-error border border-error/30 rounded hover:bg-error hover:text-white transition-all disabled:opacity-50"
              >
                {cancelLoading
                  ? "처리 중…"
                  : cancelDone
                  ? "취소 완료"
                  : "구독 취소"}
              </button>
            )}
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-xs font-bold text-error uppercase tracking-widest mb-6 pb-3 border-b border-error/20">
          {s.sections.danger}
        </h2>
        <div className="flex flex-col gap-4 rounded-lg border border-error/20 bg-error/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-on-surface-variant">{s.deleteAccount}</p>
            {withdrawalRequested && (
              <p className="mt-1 text-xs font-semibold text-error">계정 삭제 검토 요청이 접수되었습니다.</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleRequestWithdrawal}
            disabled={withdrawalLoading || withdrawalRequested}
            className="shrink-0 rounded border border-error/30 px-4 py-2 text-xs font-bold uppercase tracking-widest text-error transition-all hover:bg-error hover:text-white disabled:opacity-50"
          >
            {withdrawalLoading ? "요청 중…" : withdrawalRequested ? "요청 접수됨" : s.deleteBtn}
          </button>
        </div>
      </section>
    </div>
  );
}
