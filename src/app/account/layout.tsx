import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireCustomer } from "@/server/auth/session";
import { AccountLayoutClient } from "@/components/account/AccountLayoutClient";
import { noIndexMetadata } from "@/lib/seo";
import { getStorefrontNav } from "@/server/catalog/nav";

export const metadata: Metadata = {
  title: "ანგარიში — Luma",
  ...noIndexMetadata,
};

export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireCustomer("/account");
  const { mainNav, categoryTree } = await getStorefrontNav();
  return (
    <AccountLayoutClient mainNav={mainNav} categoryTree={categoryTree}>
      {children}
    </AccountLayoutClient>
  );
}
