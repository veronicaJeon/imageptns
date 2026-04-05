"use client";

import { cn } from "@/lib/utils/cn";
import { TextareaHTMLAttributes, forwardRef } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label className="text-xs font-bold text-outline uppercase tracking-widest">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full px-4 py-3",
            "bg-surface-container-lowest",
            "ring-1 ring-outline-variant focus:ring-2 focus:ring-primary",
            "rounded-lg text-on-surface placeholder:text-outline",
            "text-sm font-body outline-none resize-none",
            "transition-all duration-200",
            error && "ring-error focus:ring-error",
            className
          )}
          {...props}
        />
        {hint && !error && <p className="text-xs text-outline">{hint}</p>}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
