import { loadPaymentWidget } from "@tosspayments/payment-widget-sdk";

export async function initTossWidget(orderId: string, customerEmail: string) {
  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!;
  const widget = await loadPaymentWidget(clientKey, orderId);
  return widget;
}
