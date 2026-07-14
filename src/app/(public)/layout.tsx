import { TopNavBar } from "@/components/layout/TopNavBar";
import { Footer } from "@/components/layout/Footer";
import { CartAvailabilitySync } from "@/components/cart/CartAvailabilitySync";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <CartAvailabilitySync />
      <TopNavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
