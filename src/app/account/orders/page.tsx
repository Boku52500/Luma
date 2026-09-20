import type { Metadata } from "next";
import { OrdersPageClient } from "@/components/account/OrdersPageClient";
import { requireCustomer } from "@/server/auth/session";
import { listCustomerOrders } from "@/server/account/orders";

export const metadata: Metadata = {
  title: "შეკვეთები — Luma",
  description: "თქვენი შეკვეთების ისტორია.",
};

export default async function OrdersPage() {
  const customer = await requireCustomer("/account/orders");
  const orders = await listCustomerOrders(customer.id);
  return <OrdersPageClient orders={orders} />;
}
