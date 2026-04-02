import { MarketingNav } from "@/components/landing/marketing-nav";
import { Footer } from "@/components/landing/footer";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingNav />
      <main className="pt-16">{children}</main>
      <Footer />
    </>
  );
}
