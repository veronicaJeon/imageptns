"use client";

import { cn } from "@/lib/utils/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "icon";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary: [
    "bg-primary text-white",
    "font-semibold text-sm",
    "rounded hover:bg-primary/90 active:scale-95",
    "transition-all duration-200",
  ].join(" "),
  secondary: [
    "bg-surface-container-high text-on-surface",
    "font-semibold text-sm",
    "rounded hover:bg-surface-container-highest",
    "transition-colors duration-200",
  ].join(" "),
  ghost: [
    "text-on-surface-variant font-medium text-sm",
    "hover:text-on-surface hover:bg-surface-container-low",
    "rounded transition-colors duration-200",
  ].join(" "),
  icon: [
    "text-on-surface-variant",
    "rounded-full hover:bg-surface-container-high",
    "transition-colors duration-200 flex items-center justify-center",
  ].join(" "),
};

const sizeStyles: Record<Size, string> = {
  sm:  "px-4 py-2 text-xs",
  md:  "px-6 py-3",
  lg:  "px-8 py-4 text-sm",
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
