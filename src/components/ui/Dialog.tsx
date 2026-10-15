"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./Button";

type DialogSize = "compact" | "sm" | "md" | "lg" | "xl";
type DialogPlacement = "responsive" | "center";
type DialogDensity = "comfortable" | "compact";
type DialogChrome = "sectioned" | "seamless";

const sizeClasses: Record<DialogSize, string> = {
  compact: "max-w-md max-h-[min(76dvh,38rem)] rounded-[var(--radius-xl)]",
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-5xl",
  xl: "max-w-[1440px]",
};

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: DialogSize;
  placement?: DialogPlacement;
  density?: DialogDensity;
  chrome?: DialogChrome;
  closeLabel?: string;
  className?: string;
  bodyClassName?: string;
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function Dialog({
  open,
  onClose,
  title,
  description,
  eyebrow,
  children,
  footer,
  size = "md",
  placement = "responsive",
  density = "comfortable",
  chrome = "sectioned",
  closeLabel = "닫기",
  className,
  bodyClassName,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    window.requestAnimationFrame(() => panel?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={cn("ui-modal-backdrop", placement === "center" && "ui-modal-backdrop-centered")}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn("ui-modal-panel flex flex-col focus:outline-none", sizeClasses[size], className)}
      >
        <header className={cn(
          "flex shrink-0 items-start gap-4",
          chrome === "sectioned" && "border-b border-outline-variant/25",
          chrome === "seamless"
            ? "px-6 pb-2 pt-6"
            : density === "compact" ? "px-5 py-4" : "px-5 py-4 sm:px-6 sm:py-5"
        )}>
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>}
            <h2 id={titleId} className={cn(
              "font-headline font-extrabold leading-snug text-on-surface",
              chrome === "seamless" ? "text-xl tracking-tight sm:text-2xl" : "text-lg sm:text-xl"
            )}>{title}</h2>
            {description && <p id={descriptionId} className="mt-1.5 text-sm leading-6 text-on-surface-variant">{description}</p>}
          </div>
          <Button type="button" variant="icon" size="sm" onClick={onClose} aria-label={closeLabel} className={cn("-mr-1 shrink-0", chrome === "seamless" ? "-mt-2" : "-mt-1")}>
            <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
          </Button>
        </header>
        <div className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          chrome === "seamless"
            ? "px-6 pb-6 pt-2"
            : density === "compact" ? "px-5 py-5" : "px-5 py-5 sm:px-6 sm:py-6",
          bodyClassName
        )}>{children}</div>
        {footer && <footer className={cn(
          "flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end",
          chrome === "sectioned" && "border-t border-outline-variant/25 bg-surface-container-low/70",
          chrome === "seamless"
            ? "px-6 pb-6 pt-0"
            : density === "compact" ? "px-5 py-4" : "px-5 py-4 sm:px-6"
        )}>{footer}</footer>}
      </div>
    </div>
  );
}
