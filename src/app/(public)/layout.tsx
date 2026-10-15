import { TopNavBar } from "@/components/layout/TopNavBar";
import { Footer } from "@/components/layout/Footer";
import { CartAvailabilitySync } from "@/components/cart/CartAvailabilitySync";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <CartAvailabilitySync />
      <TopNavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
