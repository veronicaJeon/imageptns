"use client";

import { cn } from "@/lib/utils/cn";
import { InputHTMLAttributes, forwardRef } from "react";

interface RadioCardProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  icon: string;   // Material Symbol name
  label: string;
  description?: string;
}

export const RadioCard = forwardRef<HTMLInputElement, RadioCardProps>(
  ({ icon, label, description, className, ...props }, ref) => {
    return (
      <label className="relative cursor-pointer group">
        <input
          ref={ref}
          type="radio"
          className="peer sr-only"
          {...props}
        />
        <div
          className={cn(
            "ui-interactive px-4 py-5 rounded-xl border border-outline-variant/40",
            "bg-surface-container-lowest text-on-surface-variant text-center",
            "peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary",
            "peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20",
            "hover:-translate-y-px hover:border-primary/40 hover:bg-primary/5",
            className
          )}
        >
          <span className="material-symbols-outlined text-3xl block mb-2">{icon}</span>
          <span className="text-sm font-semibold block">{label}</span>
          {description && (
            <span className="text-xs opacity-70 mt-1 block">{description}</span>
          )}
        </div>
      </label>
    );
  }
);

RadioCard.displayName = "RadioCard";
