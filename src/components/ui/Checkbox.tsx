"use client";

import { cn } from "@/lib/utils/cn";
import { InputHTMLAttributes, forwardRef } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          ref={ref}
          type="checkbox"
          className={cn(
            "mt-0.5 w-4 h-4 rounded-xs",
            "text-primary bg-surface-container-lowest",
            "ring-1 ring-outline-variant checked:ring-primary",
            "focus:ring-2 focus:ring-primary",
            "transition-all duration-200 cursor-pointer",
            className
          )}
          {...props}
        />
        {label && (
          <span className="text-sm text-on-surface-variant leading-relaxed group-hover:text-on-surface transition-colors">
            {label}
          </span>
        )}
        {error && (
          <p className="text-xs text-error mt-1">{error}</p>
        )}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
