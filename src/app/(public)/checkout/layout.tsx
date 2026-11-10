import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "주문하기",
  robots: { index: false, follow: false },
};

export default function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
