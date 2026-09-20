import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account/AccountDashboard";
import { requireCustomer } from "@/server/auth/session";
import { listCustomerOrders } from "@/server/account/orders";
import { listMyAddresses } from "@/server/actions/addresses";

export const metadata: Metadata = {
  title: "ჩემი ანგარიში — Luma",
  description: "მართეთ შეკვეთები, რჩეულები, მისამართები და პროფილი.",
};

export default async function AccountPage() {
  const customer = await requireCustomer("/account");
  const [orders, addresses] = await Promise.all([listCustomerOrders(customer.id), listMyAddresses()]);
  return <AccountDashboard orders={orders} addresses={addresses} />;
}
