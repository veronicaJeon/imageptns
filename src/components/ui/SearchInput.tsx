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
          "ui-field flex items-center",
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
            className="ui-interactive shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-highlight hover:-translate-y-px"
          >
            Search
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";
