"use client";

import Link from "next/link";
import { ProductImage } from "@/components/product/ProductImage";
import { formatPrice } from "@/lib/utils";
import type { StorefrontOrderItem } from "@/lib/orderView";

export function OrderItemsList({ items }: { items: StorefrontOrderItem[] }) {
  const safeItems = Array.isArray(items) ? items.filter((item) => item && typeof item.productId === "string") : [];

  return (
    <div className="flex flex-col divide-y divide-border">
      {safeItems.map((item, index) => {
        const slug = typeof item.slug === "string" && item.slug.trim() ? item.slug.trim() : undefined;
        const href = slug ? `/product/${slug}` : undefined;
        const name = (
          <p className="text-small line-clamp-2 font-medium text-text">{item.name || "პროდუქტი"}</p>
        );

        return (
          <div key={`${item.productId}-${index}`} className="flex items-center gap-3 py-3">
            <ProductImage visual={item.visual ?? "accessory"} tone={item.tone || 1} className="size-14 shrink-0 sm:size-16" />
            <div className="min-w-0 flex-1">
              {href ? (
                <Link href={href} className="hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                  {name}
                </Link>
              ) : (
                name
              )}
              {item.variants?.length ? (
                <p className="text-label text-text-faint">
                  {item.variants.map((v) => `${v.groupLabel}: ${v.optionLabel}`).join(" · ")}
                </p>
              ) : null}
              <p className="text-label text-text-faint">
                {item.quantity || 0} × {formatPrice(item.unitPrice || 0)}
              </p>
            </div>
            <span className="text-small tnum shrink-0 font-semibold text-text">{formatPrice(item.lineTotal || 0)}</span>
          </div>
        );
      })}
    </div>
  );
}
