"use client";

import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface AccordionItemProps {
  question: ReactNode;
  answer: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
}

export function AccordionItem({ question, answer, eyebrow, className }: AccordionItemProps) {
  return (
    <details
      className={cn(
        "group ui-list-row border-b border-outline-variant/20 px-4 last:border-b-0 sm:px-5",
        className
      )}
    >
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-bold text-on-surface select-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          {eyebrow && <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-outline">{eyebrow}</span>}
          <span className="block text-sm leading-6 transition-colors group-hover:text-primary sm:text-base">{question}</span>
        </span>
        <span className="material-symbols-outlined ml-4 shrink-0 text-outline transition-transform duration-200 group-open:rotate-180">
          expand_more
        </span>
      </summary>
      <div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity] duration-300 ease-out group-open:grid-rows-[1fr] group-open:opacity-100">
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-outline-variant/20 pb-5 pt-4 text-sm leading-7 text-on-surface-variant">{answer}</div>
        </div>
      </div>
    </details>
  );
}

interface AccordionProps {
  items: { question: ReactNode; answer: ReactNode; eyebrow?: ReactNode }[];
  className?: string;
}

export function Accordion({ items, className }: AccordionProps) {
  return (
    <div className={cn("ui-surface flex flex-col overflow-hidden", className)}>
      {items.map((item, i) => (
        <AccordionItem key={i} {...item} />
      ))}
    </div>
  );
}
