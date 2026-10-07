"use client";

import Link from "next/link";
import { Trash2, X } from "lucide-react";
import type { ResolvedCartLine } from "@/hooks/useCart";
import { ProductImage } from "@/components/product/ProductImage";
import { QuantitySelector } from "@/components/product/QuantitySelector";
import { formatPrice, getDiscountPercent } from "@/lib/utils";

/**
 * Single cart line, shared by the mini-cart drawer (`compact`), the full
 * `/cart` page, and the read-only checkout order summary (`compact` +
 * `readOnly`) so item rendering/quantity/remove logic only exists once.
 */
export function CartLineCard({
  line,
  onQuantityChange,
  onRemove,
  compact = false,
  readOnly = false,
  allowRemove = false,
}: {
  line: ResolvedCartLine;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  compact?: boolean;
  /** Checkout-summary mode: no quantity stepper, quantity shown as plain text. */
  readOnly?: boolean;
  /** Show a remove control even when `readOnly` (checkout line edit). */
  allowRemove?: boolean;
}) {
  const { snapshot, quantity, lineTotal, variantLabels } = line;
  const href = `/product/${snapshot.slug}`;
  const unavailable = snapshot.availability === "out-of-stock";
  const discount = getDiscountPercent(snapshot.unitPrice, snapshot.previousPrice);
  const removeLabel = `${snapshot.name} — წაშლა კალათიდან`;
  const showRemove = allowRemove || !readOnly;

  if (compact) {
    return (
      <div className="flex gap-3 py-4">
        <Link href={href} className="block shrink-0" aria-hidden tabIndex={-1}>
          <ProductImage visual={snapshot.visual} tone={snapshot.tone} src={snapshot.imageSrc} alt={snapshot.imageAlt || snapshot.name} sizes="72px" className="size-[4.5rem]" />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={href} className="text-small line-clamp-2 font-semibold leading-snug text-text hover:text-brand-600">
              {snapshot.name}
            </Link>
            {showRemove ? (
              <button
                type="button"
                aria-label={removeLabel}
                onClick={onRemove}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-danger-50 hover:text-danger-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:size-7"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            ) : null}
          </div>

          {variantLabels.length ? (
            <p className="text-label text-text-faint">
              {variantLabels.map((v) => `${v.groupLabel}: ${v.optionLabel}`).join(" · ")}
            </p>
          ) : null}

          {unavailable ? <p className="text-label font-medium text-danger-500">არ არის ხელმისაწვდომი</p> : null}

          <div className="mt-1.5 flex items-center justify-between gap-2">
            {readOnly ? (
              <span className="text-small tnum text-text-muted">
                {quantity} x {formatPrice(snapshot.unitPrice)}
              </span>
            ) : (
              <QuantitySelector value={quantity} onChange={onQuantityChange} max={10} disabled={unavailable} className="h-9" />
            )}
            <span className="text-small tnum font-semibold text-text">{formatPrice(lineTotal)}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-4 sm:flex-row sm:gap-5">
      <Link href={href} className="mx-auto block w-28 shrink-0 sm:mx-0" aria-hidden tabIndex={-1}>
        <ProductImage visual={snapshot.visual} tone={snapshot.tone} src={snapshot.imageSrc} alt={snapshot.imageAlt || snapshot.name} sizes="112px" />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-label text-text-faint">{snapshot.brand}</span>
            <Link href={href} className="text-body block font-semibold leading-snug text-text hover:text-brand-600">
              {snapshot.name}
            </Link>
          </div>
          <button
            type="button"
            aria-label={removeLabel}
            onClick={onRemove}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-danger-50 hover:text-danger-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <Trash2 className="size-[18px]" strokeWidth={1.75} />
          </button>
        </div>

        {variantLabels.length ? (
          <p className="text-small text-text-muted">
            {variantLabels.map((v) => `${v.groupLabel}: ${v.optionLabel}`).join(" · ")}
          </p>
        ) : null}

        {unavailable ? (
          <p className="text-small font-medium text-danger-500">არ არის ხელმისაწვდომი</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-body tnum font-semibold text-text">{formatPrice(snapshot.unitPrice)}</span>
            {snapshot.previousPrice && discount ? (
              <span className="text-small tnum text-text-faint line-through">{formatPrice(snapshot.previousPrice)}</span>
            ) : null}
          </div>
          <QuantitySelector value={quantity} onChange={onQuantityChange} max={10} disabled={unavailable} />
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-center justify-between border-t border-border pt-3 sm:w-28 sm:flex-col sm:items-end sm:justify-between sm:border-t-0 sm:pt-0">
        <span className="text-label text-text-faint sm:hidden">ჯამი</span>
        <span className="text-body tnum font-bold text-text sm:text-right">{formatPrice(lineTotal)}</span>
      </div>
    </div>
  );
}
