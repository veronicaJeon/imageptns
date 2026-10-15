"use client";

import { cn } from "@/lib/utils/cn";
import { TextareaHTMLAttributes, forwardRef, useId } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = props.id ?? generatedId;
    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label htmlFor={textareaId} className="text-xs font-semibold text-on-surface-variant">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            "w-full px-4 py-3",
            "ui-field text-on-surface placeholder:text-outline",
            "text-sm font-body outline-none resize-none",
            error && "border-error",
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
