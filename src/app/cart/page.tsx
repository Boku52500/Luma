import type { Metadata } from "next";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { CartPageClient } from "@/components/cart/CartPageClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "კალათა — Luma",
  description: "თქვენი კალათა — გადახედეთ დამატებულ პროდუქტებს და გააგრძელეთ შეკვეთა.",
  ...noIndexMetadata,
};

export default function CartPage() {
  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <CartPageClient />
      </main>
      <Footer />
    </>
  );
}
