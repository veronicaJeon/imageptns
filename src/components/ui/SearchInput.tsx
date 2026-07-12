"use client";

import { cn } from "@/lib/utils/cn";
import { InputHTMLAttributes, forwardRef } from "react";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  size?: "sm" | "lg";
  onSearch?: (value: string) => void;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ size = "lg", onSearch, className, ...props }, ref) => {
    const isLarge = size === "lg";

    return (
      <div
        className={cn(
          "flex items-center bg-surface-container-lowest",
          "ring-1 ring-outline-variant focus-within:ring-2 focus-within:ring-primary",
          "rounded-lg transition-all duration-200",
          isLarge ? "px-6 py-4 gap-4" : "px-4 py-2 gap-3"
        )}
      >
        <span
          className={cn(
            "material-symbols-outlined text-outline shrink-0",
            isLarge ? "text-2xl" : "text-xl"
          )}
        >
          search
        </span>
        <input
          ref={ref}
          type="text"
          className={cn(
            "flex-1 bg-transparent outline-none border-none",
            "text-on-surface placeholder:text-outline font-body",
            isLarge ? "text-xl" : "text-sm",
            className
          )}
          {...props}
        />
        {onSearch && (
          <button
            type="button"
            onClick={() => onSearch((props.value as string) ?? "")}
            className="shrink-0 rounded bg-primary px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Search
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
