import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "장바구니",
  robots: { index: false, follow: false },
};

export default function CartLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
