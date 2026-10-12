"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ProductCard } from "@/components/product/ProductCard";
import { useWishlist } from "@/hooks/useWishlist";
import { listWishlistProducts } from "@/server/actions/wishlist";
import type { Product } from "@/types/product";
import { AccountEmptyState } from "./AccountEmptyState";

export function WishlistPageClient({ initialProducts = [] }: { initialProducts?: Product[] }) {
  const { products: localProducts, ids, isLoggedIn } = useWishlist();
  const [remoteProducts, setRemoteProducts] = useState<Product[]>(initialProducts);
  const idKey = ids.join("|");

  useEffect(() => {
    if (!isLoggedIn) return;
    let cancelled = false;
    void listWishlistProducts().then((rows) => {
      if (!cancelled) setRemoteProducts(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, idKey]);

  const products = isLoggedIn ? remoteProducts : localProducts;

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
        <div>
          <p className="text-label font-semibold text-brand-800">სურვილები</p>
          <h1 className="text-h2 mt-1 text-text">რჩეულები</h1>
          <p className="text-body mt-2 text-text-muted">
            შენახული პროდუქტები — დაამატეთ კალათაში ან წაშალეთ სიიდან.
          </p>
        </div>
        {products.length > 0 ? (
          <p className="text-small tnum rounded-full border border-border bg-surface px-3 py-1.5 font-medium text-text-muted">
            {products.length} პროდუქტი
          </p>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface-2/40 py-16">
          <AccountEmptyState
            icon={Heart}
            title="რჩეულების სია ცარიელია"
            description="დააჭირეთ გულის იკონს პროდუქტზე, რომ შეინახოთ ის აქ შემდგომი შენაძენისთვის."
            secondaryHref="/"
            secondaryLabel="მთავარზე დაბრუნება"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} className="h-full" />
          ))}
        </div>
      )}

      {products.length > 0 ? (
        <div className="mt-10 text-center">
          <Link href="/" className="text-small font-semibold text-brand-800 hover:text-brand-900">
            ← მთავარზე დაბრუნება
          </Link>
        </div>
      ) : null}
    </Container>
  );
}
