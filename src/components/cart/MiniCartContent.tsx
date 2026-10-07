"use client";

import { Check, ShoppingBag } from "lucide-react";
import type { CartLineItem } from "@/lib/productSnapshots";
import { useCart } from "@/hooks/useCart";
import { useCartDrawer } from "@/hooks/useCartDrawer";
import { ProductImage } from "@/components/product/ProductImage";
import { Button } from "@/components/ui/Button";
import { getLineTotal } from "@/lib/cart";
import { formatPrice } from "@/lib/utils";

export function MiniCartContent({
  displayItem,
  onClose,
}: {
  displayItem: CartLineItem;
  onClose: () => void;
}) {
  const { items, count, subtotal } = useCart();
  const { openDrawer } = useCartDrawer();
  const { snapshot, quantity, variantLabels } = displayItem;
  const lineTotal = getLineTotal(snapshot.unitPrice, quantity);

  return (
    <div className="flex max-h-[min(85vh,32rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
        <span className="flex size-8 items-center justify-center rounded-full bg-success-50 text-success-600">
          <Check className="size-4" strokeWidth={2.5} />
        </span>
        <p className="text-body font-semibold text-text">პროდუქტი დაემატა კალათაში</p>
      </div>

      <div className="overflow-y-auto px-4 py-4 sm:px-5">
        <div className="flex gap-3 rounded-[var(--radius-md)] border border-border bg-surface-2/60 p-3">
          <ProductImage
            visual={snapshot.visual}
            tone={snapshot.tone}
            src={snapshot.imageSrc}
            alt={snapshot.imageAlt || snapshot.name}
            sizes="72px"
            className="size-16 shrink-0 sm:size-[4.5rem]"
          />
          <div className="min-w-0 flex-1">
            <p className="text-label text-text-faint">{snapshot.brand}</p>
            <p className="text-small line-clamp-2 font-semibold leading-snug text-text">{snapshot.name}</p>
            {variantLabels.length ? (
              <p className="text-label mt-1 text-text-muted">
                {variantLabels.map((v) => `${v.groupLabel}: ${v.optionLabel}`).join(" · ")}
              </p>
            ) : null}
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-small tnum text-text-muted">{quantity} × {formatPrice(snapshot.unitPrice)}</span>
              <span className="text-small tnum font-semibold text-text">{formatPrice(lineTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-surface px-4 py-4 sm:px-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="text-body text-text-muted">
            ჯამი ({count} {count === 1 ? "პროდუქტი" : "პროდუქტი"})
          </span>
          <span className="text-price text-lg text-text">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex flex-col gap-2.5">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => {
              onClose();
              openDrawer();
            }}
          >
            <ShoppingBag className="size-[18px]" strokeWidth={2} />
            კალათის ნახვა
          </Button>
          <Button href="/checkout" onClick={onClose} variant="secondary" size="lg" className="w-full">
            გადახდაზე გადასვლა
          </Button>
        </div>
        {items.length > 1 ? (
          <p className="text-label mt-3 text-center text-text-faint">+ {items.length - 1} სხვა პროდუქტი კალათაში</p>
        ) : null}
      </div>
    </div>
  );
}
