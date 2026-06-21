export const CART_PRINT_CLASS = "printing-cart";

interface PrintLifecycleWindow {
  document: { body: HTMLElement };
  addEventListener(type: "afterprint", listener: EventListener): void;
  removeEventListener(type: "afterprint", listener: EventListener): void;
}

export function prepareCartPrint(win: PrintLifecycleWindow) {
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    win.document.body.classList.remove(CART_PRINT_CLASS);
    win.removeEventListener("afterprint", cleanup);
  };

  win.document.body.classList.add(CART_PRINT_CLASS);
  win.addEventListener("afterprint", cleanup);

  return cleanup;
}
