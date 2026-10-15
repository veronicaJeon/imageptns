"use client";

import { cn } from "@/lib/utils/cn";
import { InputHTMLAttributes, forwardRef, useId, useState } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: string; // Material Symbol name
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, suffix, className, type, value, onChange, ...props }, ref) => {
    const generatedId = useId();
    const inputId = props.id ?? generatedId;
    const [showPassword, setShowPassword] = useState(false);
    const [internalValue, setInternalValue] = useState("");
    const isPassword = type === "password";
    const inputType = isPassword ? (showPassword ? "text" : "password") : type;
    // Show eye toggle only when the field has content
    const hasValue = isPassword && (String(value ?? internalValue).length > 0);

    return (
      <div className="flex flex-col gap-2 w-full">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold text-on-surface-variant">
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {icon && (
            <span className="material-symbols-outlined absolute left-4 text-outline text-xl pointer-events-none">
              {icon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            type={inputType}
            value={value}
            onChange={(e) => {
              setInternalValue(e.target.value);
              onChange?.(e);
            }}
            className={cn(
              "ui-field w-full h-12 px-4",
              "text-on-surface placeholder:text-outline",
              "text-sm font-body outline-none",
              "outline-none",
              // Hide browser-native password reveal button
              "[&::-ms-reveal]:hidden [&::-ms-clear]:hidden",
              icon && "pl-12",
              (suffix || hasValue) && "pr-12",
              error && "ring-error focus:ring-error",
              className
            )}
            {...props}
          />

          {hasValue && (
            <button
              type="button"
              className="absolute right-4 text-outline hover:text-on-surface transition-colors"
              onClick={() => setShowPassword((v) => !v)}
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? "visibility_off" : "visibility"}
              </span>
            </button>
          )}

          {suffix && !isPassword && (
            <div className="absolute right-4">{suffix}</div>
          )}
        </div>

        {hint && !error && (
          <p className="text-xs text-outline">{hint}</p>
        )}
        {error && (
          <p className="text-xs text-error flex items-center gap-1">
            <span className="material-symbols-outlined text-base">error</span>
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
