import type { Metadata } from "next";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { CheckoutSuccessClient } from "@/components/checkout/CheckoutSuccessClient";
import { getSessionCustomer } from "@/server/auth/session";
import { getOrderForConfirmation } from "@/server/account/orders";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "შეკვეთა დადასტურებულია — Luma",
  description: "თქვენი შეკვეთა წარმატებით გაფორმდა.",
  ...noIndexMetadata,
};

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;
  const customer = await getSessionCustomer();
  const order = await getOrderForConfirmation(orderId, customer?.id ?? null);

  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <CheckoutSuccessClient order={order} />
      </main>
      <Footer />
    </>
  );
}
