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
  price: number; // KRW
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
  addItem: (item: Omit<CartItem, "price">) => void;
  removeItem: (id: string) => void;
  updateLicense: (id: string, license: LicenseType) => void;
  clear: () => void;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

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

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      updateLicense: (id, license) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, license, price: getLicensePrice(license) } : i
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: "imageptns-cart",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? localStorage : noopStorage
      ),
    }
  )
);
