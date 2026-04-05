import { TopNavBar } from "@/components/layout/TopNavBar";
import { Footer } from "@/components/layout/Footer";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TopNavBar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
