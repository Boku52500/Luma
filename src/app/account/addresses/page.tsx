import type { Metadata } from "next";
import { AddressesPageClient } from "@/components/account/AddressesPageClient";
import { listMyAddresses } from "@/server/actions/addresses";
import { requireCustomer } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "მისამართები — Luma",
  description: "შეინახეთ მიწოდების მისამართები.",
};

export default async function AddressesPage() {
  await requireCustomer("/account/addresses");
  const addresses = await listMyAddresses();
  return <AddressesPageClient initialAddresses={addresses} />;
}
