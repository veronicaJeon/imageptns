import { cn } from "@/lib/utils/cn";

type BadgeVariant = "primary" | "surface" | "accent" | "error";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  primary: "bg-primary text-white",
  surface: "bg-surface-container-high text-on-surface-variant",
  accent:  "bg-primary-container text-on-primary-container",
  error:   "bg-error-container text-error",
};

export function Badge({ children, variant = "surface", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block px-3 py-1",
        "text-xs font-semibold whitespace-nowrap",
        "rounded-full",
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
