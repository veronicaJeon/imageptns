import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("shared design system policy", () => {
  it("defines motion, focus, surface, field, and reduced-motion primitives", () => {
    const css = source("src/app/globals.css");
    expect(css).toContain("--duration-fast: 140ms");
    expect(css).toContain(":focus-visible");
    expect(css).toContain(".ui-surface");
    expect(css).toContain(".ui-field");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps button hierarchy and large CTA sizing in the shared component", () => {
    const button = source("src/components/ui/Button.tsx");
    expect(button).toContain('"primary" | "secondary" | "tertiary" | "danger" | "ghost" | "icon"');
    expect(button).toContain('lg:  "min-h-14');
    expect(button).toContain('"ui-interactive"');
  });

  it("provides an accessible dialog with escape, focus containment, and scroll locking", () => {
    const dialog = source("src/components/ui/Dialog.tsx");
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('aria-modal="true"');
    expect(dialog).toContain('event.key === "Escape"');
    expect(dialog).toContain('event.key !== "Tab"');
    expect(dialog).toContain('document.body.style.overflow = "hidden"');
  });

  it("uses shared search and accordion patterns on the support and notice screens", () => {
    expect(source("src/app/(public)/support/page.tsx")).toContain("SearchInput");
    expect(source("src/app/(public)/support/page.tsx")).toContain("AccordionItem");
    expect(source("src/app/(public)/notices/page.tsx")).toContain("AccordionItem");
    expect(source("src/components/ui/NoticePopup.tsx")).toContain("<Dialog");
  });
});
