"use client";

import { cn } from "@/lib/utils/cn";

interface AccordionItemProps {
  question: string;
  answer: string;
  className?: string;
}

export function AccordionItem({ question, answer, className }: AccordionItemProps) {
  return (
    <details
      className={cn(
        "group border-b border-outline-variant/15 pb-4 cursor-pointer",
        className
      )}
    >
      <summary className="flex justify-between items-center py-4 font-bold text-base text-on-surface list-none select-none">
        <span>{question}</span>
        <span className="material-symbols-outlined text-outline transition-transform duration-200 group-open:rotate-180 shrink-0 ml-4">
          expand_more
        </span>
      </summary>
      <p className="text-on-surface-variant leading-relaxed text-sm pb-2">
        {answer}
      </p>
    </details>
  );
}

interface AccordionProps {
  items: { question: string; answer: string }[];
  className?: string;
}

export function Accordion({ items, className }: AccordionProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {items.map((item, i) => (
        <AccordionItem key={i} {...item} />
      ))}
    </div>
  );
}
