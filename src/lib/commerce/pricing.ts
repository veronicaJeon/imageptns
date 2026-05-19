export interface LicensePriceRow {
  code: string;
  price_krw: number;
}

export interface CartItemPriceInput {
  id: string;
  license: string;
  price?: number;
}

export interface PricedCartItem {
  id: string;
  license: string;
  priceKrw: number;
}

const MIN_PRICE_KRW = 100;
const MAX_PRICE_KRW = 10_000_000;

export function normalizeLicensePrice(value: unknown) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < MIN_PRICE_KRW || price > MAX_PRICE_KRW) {
    throw new Error(`price_krw must be between ${MIN_PRICE_KRW} and ${MAX_PRICE_KRW}`);
  }
  if (!Number.isInteger(price)) {
    throw new Error("price_krw must be a whole KRW amount");
  }

  return price;
}

export function priceCartItemsFromLicenses(
  items: CartItemPriceInput[],
  licenses: LicensePriceRow[],
): PricedCartItem[] {
  const priceMap = new Map(licenses.map((license) => [license.code, normalizeLicensePrice(license.price_krw)]));

  return items.map((item) => {
    const priceKrw = priceMap.get(item.license);
    if (priceKrw == null) throw new Error(`Invalid license: ${item.license}`);

    return {
      id: item.id,
      license: item.license,
      priceKrw,
    };
  });
}
