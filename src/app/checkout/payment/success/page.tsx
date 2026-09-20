import type { Metadata } from "next";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { PaymentReturnClient } from "@/components/payments/PaymentReturnClient";
import { getSessionCustomer } from "@/server/auth/session";
import { getPaymentPageData } from "@/server/payments/load";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "გადახდა — Luma",
  description: "გადახდის სტატუსი.",
  ...noIndexMetadata,
};

export const dynamic = "force-dynamic";

export default async function CheckoutPaymentSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  const customer = await getSessionCustomer();
  const data = await getPaymentPageData(order, customer?.id ?? null, { reconcile: true });

  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <PaymentReturnClient data={data} variant="success" />
      </main>
      <Footer />
    </>
  );
}
