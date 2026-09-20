import type { Metadata } from "next";
import { WishlistPageClient } from "@/components/account/WishlistPageClient";
import { requireCustomer } from "@/server/auth/session";
import { listWishlistProducts } from "@/server/actions/wishlist";

export const metadata: Metadata = {
  title: "რჩეულები — Luma",
  description: "თქვენი შენახული პროდუქტები.",
};

export default async function WishlistPage() {
  await requireCustomer("/account/wishlist");
  const products = await listWishlistProducts();
  return <WishlistPageClient initialProducts={products} />;
}
