"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import { cn, getDiscountPercent } from "@/lib/utils";
import { availabilityLabel } from "@/lib/productLabels";
import { getDefaultVariants } from "@/lib/cart";
import { ProductImage } from "./ProductImage";
import { ProductPrice } from "./ProductPrice";
import { WishlistButton } from "./WishlistButton";
import { AddToCartButton } from "./AddToCartButton";
import { DiscountBadge } from "./ProductBadge";

export function ProductListItem({ product, className }: { product: Product; className?: string }) {
  const router = useRouter();
  const discount = getDiscountPercent(product.price, product.previousPrice);
  const outOfStock = product.availability === "out-of-stock";
  const href = `/product/${product.slug}`;
  const prefetch = () => router.prefetch(href);
  const primaryPhoto = product.images?.find((image) => image.src);
  const hoverPhoto = product.images?.find((image) => image.src && image.src !== primaryPhoto?.src);

  return (
    <div
      className={cn(
        "group flex flex-col gap-4 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface p-3 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md sm:flex-row sm:items-stretch sm:gap-5 sm:p-4",
        className
      )}
    >
      <div className="relative w-full shrink-0 sm:w-44">
        <Link href={href} prefetch={false} tabIndex={-1} aria-hidden className="block">
          <ProductImage
            visual={product.visual}
            tone={product.tone}
            hoverVisual={product.secondaryVisual}
            src={primaryPhoto?.src}
            alt={primaryPhoto?.alt || product.name}
            hoverSrc={hoverPhoto?.src}
            sizes="176px"
            className="rounded-[var(--radius-md)] bg-surface-2/40 transition-transform duration-200 group-hover:scale-[1.02]"
          />
        </Link>

        <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
          {discount ? <DiscountBadge percent={discount} /> : null}
        </div>

        <WishlistButton product={product} className="absolute right-3 top-3" />

        {outOfStock ? (
          <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-[var(--radius-md)] bg-white/75 backdrop-saturate-150">
            <span className="text-label rounded-[var(--radius-xs)] bg-ink-900 px-2.5 py-1 text-white">
              {availabilityLabel["out-of-stock"]}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:py-1">
        <Link href={href} onMouseEnter={prefetch} onFocus={prefetch} className="flex flex-col gap-1.5">
          <span className="text-label text-text-faint">{product.brand}</span>
          <h3 className="text-body font-semibold leading-snug text-text">{product.name}</h3>
        </Link>

        <ProductPrice price={product.price} previousPrice={product.previousPrice} installment={product.installment} />

        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
          <span
            className={cn(
              "text-small inline-flex items-center gap-1.5 font-medium",
              product.availability === "in-stock" && "text-success-600",
              product.availability === "low-stock" && "text-warning-500",
              product.availability === "out-of-stock" && "text-text-faint"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                product.availability === "in-stock" && "bg-success-500",
                product.availability === "low-stock" && "bg-warning-500",
                product.availability === "out-of-stock" && "bg-text-faint"
              )}
            />
            {availabilityLabel[product.availability]}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-end justify-between gap-3 border-t border-border pt-3 sm:w-52 sm:flex-col sm:items-stretch sm:justify-start sm:border-t-0 sm:border-l sm:pl-5 sm:pt-1">
        <AddToCartButton
          product={product}
          variants={getDefaultVariants(product)}
          disabled={outOfStock}
          className="w-auto min-w-[9.5rem] sm:mt-3 sm:w-full"
        />
      </div>
    </div>
  );
}
