"use client";

import { cn } from "@/lib/utils/cn";

interface CategoryPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}

export function CategoryPill({ label, active, onClick, className }: CategoryPillProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "ui-interactive min-h-10 shrink-0 px-4 py-2 rounded-full border",
        "text-sm font-semibold",
        active
          ? "border-primary bg-primary text-white shadow-sm"
          : "border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
        className
      )}
    >
      {label}
    </button>
  );
}
