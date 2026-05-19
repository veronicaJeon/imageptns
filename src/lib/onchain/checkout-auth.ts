import { randomBytes, timingSafeEqual } from "crypto";

interface ConfirmationAuthorizationInput {
  orderBuyerId: string | null;
  authenticatedUserId?: string | null;
  storedConfirmToken?: string | null;
  providedConfirmToken?: string | null;
}

function safeTokenEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createOnchainConfirmToken() {
  return randomBytes(32).toString("hex");
}

export function authorizeOnchainCheckoutConfirmation({
  orderBuyerId,
  authenticatedUserId,
  storedConfirmToken,
  providedConfirmToken,
}: ConfirmationAuthorizationInput) {
  if (orderBuyerId && authenticatedUserId && orderBuyerId === authenticatedUserId) return true;
  if (!storedConfirmToken || !providedConfirmToken) return false;
  return safeTokenEqual(storedConfirmToken, providedConfirmToken);
}
