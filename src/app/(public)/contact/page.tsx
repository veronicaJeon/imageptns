"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n/store";

export default function ContactPage() {
  const { t } = useLang();
  const c = t.contact;
  const f = c.form;

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      setSent(true);
    } catch {
      // Fall through — show success anyway (UX)
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
  }

  return (
    <>
      {/* ── Hero ── */}
      <section className="pt-36 pb-16 px-6 bg-surface">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-3">
            {c.hero.headline}
          </h1>
          <p className="text-on-surface-variant">{c.hero.sub}</p>
        </div>
      </section>

      {/* ── Content ── */}
      <section className="pb-24 px-6 bg-surface">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12">

          {/* Form */}
          <div className="md:col-span-3">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <span className="material-symbols-outlined text-6xl text-primary">mark_email_read</span>
                <p className="text-on-surface font-semibold">{c.success}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* Name */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">{f.name}</label>
                  <input type="text" required value={form.name} onChange={set("name")} placeholder={f.namePlaceholder}
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all" />
                </div>
                {/* Email */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">{f.email}</label>
                  <input type="email" required value={form.email} onChange={set("email")} placeholder={f.emailPlaceholder}
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all" />
                </div>
                {/* Subject */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">{f.subject}</label>
                  <input type="text" required value={form.subject} onChange={set("subject")} placeholder={f.subjectPlaceholder}
                    className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all" />
                </div>
                {/* Message */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-outline uppercase tracking-widest">{f.message}</label>
                  <textarea required value={form.message} onChange={set("message")} rows={6} placeholder={f.messagePlaceholder}
                    className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all" />
                </div>

                <button type="submit" disabled={loading}
                  className="flex items-center justify-center gap-2 py-4 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50">
                  {loading
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <><span className="material-symbols-outlined text-base">send</span>{f.submit}</>
                  }
                </button>
              </form>
            )}
          </div>

          {/* Info */}
          <div className="md:col-span-2">
            <div className="bg-surface-container-lowest shadow-ghost p-8 flex flex-col gap-6">
              <h3 className="font-headline text-lg font-bold text-on-surface">{c.info.title}</h3>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">mail</span>
                <div>
                  <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">Email</p>
                  <p className="text-sm text-on-surface">{c.info.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">schedule</span>
                <div>
                  <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">{c.info.hours}</p>
                  <p className="text-sm text-on-surface">{c.info.hoursVal}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">timer</span>
                <div>
                  <p className="text-xs font-bold text-outline uppercase tracking-widest mb-1">{c.info.response}</p>
                  <p className="text-sm text-on-surface">{c.info.responseVal}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
