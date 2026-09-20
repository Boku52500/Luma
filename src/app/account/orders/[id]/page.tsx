import type { Metadata } from "next";
import { OrderDetailPageClient } from "@/components/account/OrderDetailPageClient";
import { requireCustomer } from "@/server/auth/session";
import { getPaymentPageData } from "@/server/payments/load";

export const metadata: Metadata = {
  title: "შეკვეთის დეტალები — Luma",
  description: "შეკვეთის სრული დეტალები.",
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await requireCustomer("/account/orders");
  const data = await getPaymentPageData(decodeURIComponent(id), customer.id, { reconcile: true });
  return <OrderDetailPageClient order={data?.order ?? null} canRetryPayment={data?.canRetry ?? false} />;
}
