"use client";

import { cn } from "@/lib/utils/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "tertiary" | "danger" | "ghost" | "icon";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: [
    "bg-primary text-white shadow-[0_8px_20px_rgba(0,109,49,0.16)]",
    "font-semibold text-sm",
    "rounded-lg hover:bg-primary-highlight hover:-translate-y-px hover:shadow-[0_12px_24px_rgba(0,109,49,0.2)]",
  ].join(" "),
  secondary: [
    "border border-outline-variant/60 bg-surface-container-lowest text-on-surface",
    "font-semibold text-sm",
    "rounded-lg hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:-translate-y-px",
  ].join(" "),
  tertiary: [
    "bg-surface-container-low text-on-surface",
    "font-semibold text-sm",
    "rounded-lg hover:bg-surface-container-high hover:-translate-y-px",
  ].join(" "),
  danger: [
    "bg-error text-on-error",
    "font-semibold text-sm",
    "rounded-lg hover:brightness-110 hover:-translate-y-px",
  ].join(" "),
  ghost: [
    "text-on-surface-variant font-medium text-sm",
    "hover:text-on-surface hover:bg-surface-container-low",
    "rounded-lg",
  ].join(" "),
  icon: [
    "text-on-surface-variant",
    "rounded-full hover:bg-surface-container-high hover:text-on-surface",
    "flex items-center justify-center",
  ].join(" "),
};

const sizeStyles: Record<Size, string> = {
  sm:  "min-h-9 px-4 py-2 text-xs",
  md:  "min-h-11 px-5 py-2.5",
  lg:  "min-h-14 px-7 py-3.5 text-sm",
};

const iconSizeStyles: Record<Size, string> = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading, className, children, disabled, ...props },
    ref
  ) => {
    const isIcon = variant === "icon";
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex min-w-0 max-w-full items-center justify-center gap-2 select-none",
          !isIcon && "text-center leading-snug",
          "ui-interactive",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant],
          isIcon ? iconSizeStyles[size] : sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
