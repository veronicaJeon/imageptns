export function isCommerceEnabled() {
  return process.env.NEXT_PUBLIC_COMMERCE_ENABLED === "true";
}

export function isCheckoutPaymentProviderEnabled(provider: string) {
  return provider === "bank_transfer" || isCommerceEnabled();
}

export function isCheckoutRequestEnabled(provider: string, totalKrw: number) {
  return totalKrw <= 0 || isCheckoutPaymentProviderEnabled(provider);
}
