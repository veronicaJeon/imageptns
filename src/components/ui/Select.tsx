"use client";

import { cn } from "@/lib/utils/cn";
import { SelectHTMLAttributes, forwardRef } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label className="text-xs font-bold text-outline uppercase tracking-widest">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              "w-full h-12 px-4 pr-10 appearance-none",
              "bg-surface-container-lowest",
              "ring-1 ring-outline-variant focus:ring-2 focus:ring-primary",
              "rounded-lg text-on-surface text-sm font-body outline-none",
              "transition-all duration-200 cursor-pointer",
              error && "ring-error",
              className
            )}
            {...props}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">
            expand_more
          </span>
        </div>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }
);

Select.displayName = "Select";
