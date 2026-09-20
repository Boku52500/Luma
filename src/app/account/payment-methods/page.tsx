import type { Metadata } from "next";
import { requireCustomer } from "@/server/auth/session";
import { listCustomerSavedPaymentMethods } from "@/server/payments/bog/savedCard";
import { PaymentMethodsPageClient } from "@/components/account/PaymentMethodsPageClient";

export const metadata: Metadata = {
  title: "გადახდის მეთოდები — Luma",
  description: "შენახული გადახდის მეთოდები.",
};

export default async function PaymentMethodsPage() {
  const customer = await requireCustomer("/account/payment-methods");
  const methods = await listCustomerSavedPaymentMethods(customer.id);
  return <PaymentMethodsPageClient methods={methods} />;
}
