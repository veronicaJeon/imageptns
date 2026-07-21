import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type AdminChipTone = "neutral" | "primary" | "success" | "warning" | "danger";
type AdminButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type AdminButtonSize = "sm" | "md";

const chipToneClasses: Record<AdminChipTone, string> = {
  neutral: "border-outline-variant/60 bg-surface-container-low text-on-surface-variant",
  primary: "border-primary/20 bg-primary/10 text-primary",
  success: "border-primary/20 bg-primary/10 text-primary",
  warning: "border-amber-200/70 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-200",
  danger: "border-error/20 bg-error/10 text-error",
};

const buttonVariantClasses: Record<AdminButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary/90",
  secondary: "border border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:border-primary/50 hover:text-primary",
  danger: "border border-error/30 bg-error/10 text-error hover:bg-error hover:text-on-error disabled:hover:bg-error/10 disabled:hover:text-error",
  ghost: "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
};

const buttonSizeClasses: Record<AdminButtonSize, string> = {
  sm: "h-8 px-3 text-[11px]",
  md: "h-10 px-4 text-xs",
};

export function adminStatusTone(status: string | null | undefined): AdminChipTone {
  if (!status) return "neutral";
  if (["approved", "active", "published", "completed", "paid", "success"].includes(status)) return "success";
  if (["pending", "requested", "reviewing", "draft"].includes(status)) return "warning";
  if (["rejected", "canceled", "cancelled", "failed", "deletion_requested", "suspended"].includes(status)) return "danger";
  return "neutral";
}

export function AdminChip({
  tone = "neutral",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: AdminChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-full border px-2.5 text-[10px] font-bold leading-none",
        chipToneClasses[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function AdminChipButton({
  tone = "neutral",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: AdminChipTone }) {
  return (
    <button
      className={cn(
        "inline-flex h-6 max-w-full items-center rounded-full border px-2.5 text-[10px] font-bold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        chipToneClasses[tone],
        tone === "primary" || tone === "success" ? "hover:border-primary/40" : null,
        tone === "danger" ? "hover:border-error/40" : null,
        tone === "neutral" ? "hover:border-outline" : null,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminButton({
  variant = "secondary",
  size = "sm",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: AdminButtonVariant; size?: AdminButtonSize }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariantClasses[variant],
        buttonSizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminInlineMetrics({
  items,
  className,
}: {
  items: Array<{ label: ReactNode; value: ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-on-surface-variant", className)}>
      {items.map((item, index) => (
        <span key={index} className="contents">
          {index > 0 && <span className="text-outline">·</span>}
          <span>
            {item.label} <strong className="font-semibold text-on-surface">{item.value}</strong>
          </span>
        </span>
      ))}
    </div>
  );
}

export function AdminListSurface({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-ghost", className)}>
      {children}
    </div>
  );
}
