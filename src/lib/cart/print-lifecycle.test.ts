import { describe, expect, it, vi } from "vitest";
import { CART_PRINT_CLASS, prepareCartPrint } from "./print-lifecycle";

function fakePrintWindow() {
  const classes = new Set<string>();
  const body = {
    classList: {
      add: (value: string) => { classes.add(value); },
      remove: (value: string) => { classes.delete(value); },
      contains: (value: string) => classes.has(value),
    },
  } as HTMLElement;
  const listeners = new Map<string, EventListener>();
  return {
    document: { body },
    addEventListener: vi.fn((event: string, listener: EventListener) => {
      listeners.set(event, listener);
    }),
    removeEventListener: vi.fn((event: string, listener: EventListener) => {
      if (listeners.get(event) === listener) listeners.delete(event);
    }),
    fire(event: string) {
      listeners.get(event)?.(new Event(event));
    },
  };
}

describe("cart print lifecycle", () => {
  it("keeps print-only mode active until the browser emits afterprint", () => {
    const win = fakePrintWindow();

    prepareCartPrint(win);

    expect(win.document.body.classList.contains(CART_PRINT_CLASS)).toBe(true);

    win.fire("afterprint");

    expect(win.document.body.classList.contains(CART_PRINT_CLASS)).toBe(false);
  });

  it("returns an idempotent cleanup function for print failures", () => {
    const win = fakePrintWindow();
    const cleanup = prepareCartPrint(win);

    cleanup();
    cleanup();

    expect(win.document.body.classList.contains(CART_PRINT_CLASS)).toBe(false);
    expect(win.removeEventListener).toHaveBeenCalledTimes(1);
  });
});
