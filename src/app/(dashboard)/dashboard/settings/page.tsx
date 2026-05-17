"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  current_period_start: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export default function SettingsPage() {
  const { t } = useLang();
  const s = t.dashboard.settings;
  const { user, init } = useAuth();

  const [name, setName]   = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio]     = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState({ sales: true, reviews: true, newsletter: false });
  const [notifSaving, setNotifSaving] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);

  // Load subscription
  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then(({ subscription: sub }: { subscription: Subscription | null }) => {
        setSubscription(sub ?? null);
      })
      .catch(() => setSubscription(null));
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
        setEmail(profile.email ?? "");
        setBio(profile.bio ?? "");
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
          setEmail(user.email);
        }
      });
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: name, bio }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        // Silently refresh auth store in background (don't await — avoids hang)
        init().catch(() => {});
      }
    } finally {
      setLoading(false);
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
          <Input label={s.emailLabel} type="email" value={email} disabled icon="mail" />

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

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" size="md" loading={loading}>{s.saveBtn}</Button>
            {saved && (
              <span className="text-sm text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-base">check_circle</span>
                Saved!
              </span>
            )}
          </div>
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
        <div className="flex items-center justify-between gap-4 p-5 bg-error/5 rounded-lg border border-error/20">
          <p className="text-sm text-on-surface-variant">{s.deleteAccount}</p>
          <button className="shrink-0 px-4 py-2 text-xs font-bold uppercase tracking-widest text-error border border-error/30 rounded hover:bg-error hover:text-white transition-all">
            {s.deleteBtn}
          </button>
        </div>
      </section>
    </div>
  );
}
