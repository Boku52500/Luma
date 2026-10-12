"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import type { Product } from "@/types/product";
import { cn } from "@/lib/utils";
import { useCart } from "@/hooks/useCart";
import { useMiniCart } from "@/hooks/useMiniCart";

/**
 * Full-width add-to-cart control shared by every product surface (cards,
 * list rows, PDP purchase area, mobile sticky bar). Dispatches straight to
 * the global cart store via `useCart` — no component owns its own cart
 * logic — then briefly swaps into a confirmed "დამატებულია" state before
 * reverting, giving clear feedback without opening the drawer or navigating
 * anywhere.
 *
 * Pass the storefront `Product` DTO. The cart store snapshots price/image/slug;
 * callers must not look up the mock catalogue.
 */
export function AddToCartButton({
  product,
  quantity = 1,
  variants,
  disabled = false,
  size = "md",
  variant = "solid",
  className,
}: {
  product: Product;
  /** Defaults to 1 — the PDP purchase panel passes the selected quantity. */
  quantity?: number;
  /** Selected variant groupId -> option value. Two different selections always become separate cart lines. */
  variants?: Record<string, string>;
  disabled?: boolean;
  /** "lg" is used by the PDP's purchase area; cards/rows keep the default "md". */
  size?: "md" | "lg";
  /** "outline" gives a lighter secondary look (used on the PDP next to Buy Now). */
  variant?: "solid" | "outline";
  className?: string;
}) {
  const { addItem } = useCart();
  const { openWithItem } = useMiniCart();
  const [justAdded, setJustAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productName = product.name;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={
        disabled ? `${productName} — არ არის ხელმისაწვდომი` : `${productName} — კალათაში დამატება`
      }
      onClick={() => {
        if (disabled) return;
        const line = addItem(product, quantity, variants);
        if (line) openWithItem(line);
        setJustAdded(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setJustAdded(false), 1700);
      }}
      className={cn(
        "text-btn inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:pointer-events-none",
        size === "lg" ? "h-12 text-[0.9375rem] sm:h-[3.25rem] sm:text-[1rem]" : "h-10",
        disabled &&
          (variant === "outline"
            ? "border border-border bg-surface-2 text-text-faint"
            : "bg-bg-subtle text-text-faint"),
        !disabled && justAdded && "bg-success-500 text-white",
        !disabled &&
          !justAdded &&
          (variant === "outline"
            ? "border border-brand-600 text-on-brand hover:bg-brand-50 active:bg-brand-100"
            : "bg-brand-600 text-on-brand hover:bg-brand-700 active:bg-brand-800"),
        className
      )}
    >
      {disabled ? (
        "არ არის ხელმისაწვდომი"
      ) : justAdded ? (
        <>
          <Check className="size-4" strokeWidth={2.5} />
          დამატებულია
        </>
      ) : (
        <>
          <ShoppingCart className="size-[17px]" strokeWidth={2} />
          დამატება
        </>
      )}
    </button>
  );
}
