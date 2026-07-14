import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// SSR-safe no-op storage (server has no localStorage/sessionStorage)
const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export type LicenseType = "editorial" | "commercial" | "extended";

export interface CartItem {
  id: string;
  assetId?: string;
  title: string;
  photographer: string;
  src: string;
  category: string;
  license: LicenseType;
  creditLine: string;
  usageConditions: string[];
  freeUsagePolicy?: string | null;
  price: number; // KRW
}

export type CartItemInput = Omit<CartItem, "price">;

export function removeUnavailableCartState(
  items: CartItem[],
  directPurchase: CartItem | null,
  unavailableIds: Iterable<string>,
) {
  const ids = new Set(unavailableIds);
  return {
    items: items.filter((item) => !ids.has(item.id)),
    directPurchase: directPurchase && ids.has(directPurchase.id) ? null : directPurchase,
  };
}

export function checkoutItemsForState(items: CartItem[], directPurchase: CartItem | null) {
  return directPurchase ? [directPurchase] : items;
}

export type CheckoutMode = "cart" | "direct" | null;

export function completedCartState(items: CartItem[], directPurchase: CartItem | null, checkoutMode: CheckoutMode) {
  if (checkoutMode === "direct" && directPurchase) {
    return {
      items: items.filter((item) => item.id !== directPurchase.id),
      directPurchase: null,
      checkoutMode: null,
    };
  }
  if (checkoutMode === "cart") return { items: [], directPurchase: null, checkoutMode: null };
  return { items, directPurchase, checkoutMode: null };
}

const LICENSE_PRICES: Record<LicenseType, number> = {
  editorial:  15000,
  commercial: 55000,
  extended:  180000,
};

export function getLicensePrice(license: LicenseType): number {
  return LICENSE_PRICES[license];
}

interface CartStore {
  items: CartItem[];
  directPurchase: CartItem | null;
  checkoutMode: CheckoutMode;
  addItem: (item: CartItemInput) => void;
  startDirectPurchase: (item: CartItemInput) => void;
  clearDirectPurchase: () => void;
  startCartCheckout: () => void;
  completeCheckout: () => void;
  removeUnavailableItems: (ids: string[]) => void;
  removeItem: (id: string) => void;
  updateLicense: (id: string, license: LicenseType) => void;
  clear: () => void;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      directPurchase: null,
      checkoutMode: null,

      addItem: (item) => {
        const exists = get().items.find((i) => i.id === item.id);
        if (exists) {
          // Update license if already in cart
          set((s) => ({
            items: s.items.map((i) =>
              i.id === item.id
                ? { ...i, license: item.license, price: getLicensePrice(item.license) }
                : i
            ),
          }));
        } else {
          set((s) => ({
            items: [
              ...s.items,
              { ...item, price: getLicensePrice(item.license) },
            ],
          }));
        }
      },

      startDirectPurchase: (item) => set({
        directPurchase: { ...item, price: getLicensePrice(item.license) },
        checkoutMode: "direct",
      }),

      clearDirectPurchase: () => set({ directPurchase: null, checkoutMode: null }),

      startCartCheckout: () => set({ directPurchase: null, checkoutMode: "cart" }),

      completeCheckout: () => set((state) => completedCartState(
        state.items,
        state.directPurchase,
        state.checkoutMode,
      )),

      removeUnavailableItems: (ids) => set((state) => removeUnavailableCartState(
        state.items,
        state.directPurchase,
        ids,
      )),

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      updateLicense: (id, license) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, license, price: getLicensePrice(license) } : i
          ),
        })),

      clear: () => set({ items: [], directPurchase: null, checkoutMode: null }),
    }),
    {
      name: "imageptns-cart",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
    }
  )
);
