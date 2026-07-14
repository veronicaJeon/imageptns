import { describe, expect, it } from "vitest";
import { checkoutItemsForState, completedCartState, removeUnavailableCartState, type CartItem } from "./cart";

function item(id: string): CartItem {
  return {
    id,
    title: id,
    photographer: "photographer",
    src: "preview.jpg",
    category: "nature",
    license: "editorial",
    creditLine: "credit",
    usageConditions: [],
    price: 15000,
  };
}

describe("cart availability", () => {
  it("checks out only the selected buy-now image without consuming the cart", () => {
    expect(checkoutItemsForState([item("cart-1"), item("cart-2")], item("buy-now")))
      .toEqual([item("buy-now")]);
  });

  it("completes direct purchase without clearing unrelated cart items and is idempotent", () => {
    const completed = completedCartState([item("cart"), item("buy-now")], item("buy-now"), "direct");
    expect(completed).toEqual({ items: [item("cart")], directPurchase: null, checkoutMode: null });
    expect(completedCartState(completed.items, completed.directPurchase, completed.checkoutMode)).toEqual(completed);
  });

  it("removes deleted items while retaining purchasable cart entries", () => {
    expect(removeUnavailableCartState([item("active"), item("deleted")], null, ["deleted"])).toEqual({
      items: [item("active")],
      directPurchase: null,
    });
  });

  it("clears an unavailable direct-purchase item", () => {
    expect(removeUnavailableCartState([], item("deleted"), ["deleted"])).toEqual({
      items: [],
      directPurchase: null,
    });
  });
});
