import type { Metadata } from "next";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { CheckoutPageClient } from "@/components/checkout/CheckoutPageClient";
import { noIndexMetadata } from "@/lib/seo";
import { getCheckoutPaymentCapabilities } from "@/server/payments/bog/capabilities";
import { getSessionCustomer } from "@/server/auth/session";
import { listCustomerSavedPaymentMethods } from "@/server/payments/bog/savedCard";

export const metadata: Metadata = {
  title: "შეკვეთის გაფორმება — Luma",
  description: "დაასრულეთ შეკვეთა — მიწოდების და გადახდის დეტალები.",
  ...noIndexMetadata,
};

export default async function CheckoutPage() {
  const capabilities = getCheckoutPaymentCapabilities();
  const session = await getSessionCustomer();
  const savedMethods =
    session && capabilities.savedCard ? await listCustomerSavedPaymentMethods(session.id) : [];
  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <CheckoutPageClient
          capabilities={capabilities}
          savedMethods={savedMethods.map((row) => ({
            id: row.id,
            maskedPan: row.maskedPan,
            cardType: row.cardType,
            cardExpiry: row.cardExpiry,
          }))}
        />
      </main>
      <Footer />
    </>
  );
}
