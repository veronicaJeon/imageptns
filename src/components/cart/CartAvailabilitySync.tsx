"use client";

import { useCallback, useEffect } from "react";
import { useCart } from "@/lib/store/cart";

const RECHECK_INTERVAL_MS = 60_000;

export function CartAvailabilitySync() {
  const items = useCart((state) => state.items);
  const directPurchase = useCart((state) => state.directPurchase);
  const removeUnavailableItems = useCart((state) => state.removeUnavailableItems);
  const imageIds = Array.from(new Set([
    ...items.map((item) => item.id),
    ...(directPurchase ? [directPurchase.id] : []),
  ])).join(",");

  const reconcile = useCallback(async () => {
    if (!imageIds) return;
    const response = await fetch(`/api/cart/availability?imageIds=${encodeURIComponent(imageIds)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = await response.json() as { unavailableIds?: string[] };
    if (data.unavailableIds?.length) removeUnavailableItems(data.unavailableIds);
  }, [imageIds, removeUnavailableItems]);

  useEffect(() => {
    void reconcile();
    const interval = window.setInterval(() => void reconcile(), RECHECK_INTERVAL_MS);
    const handleFocus = () => void reconcile();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [reconcile]);

  return null;
}
