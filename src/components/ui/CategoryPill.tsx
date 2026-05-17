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
        "px-6 py-2 rounded-full",
        "text-xs font-bold uppercase tracking-widest",
        "transition-colors duration-200",
        active
          ? "bg-primary-container text-on-primary-container"
          : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high",
        className
      )}
    >
      {label}
    </button>
  );
}
