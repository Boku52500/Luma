"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useCartDrawer } from "@/hooks/useCartDrawer";
import { useMiniCart } from "@/hooks/useMiniCart";

/**
 * Header cart trigger — always opens the full CartDrawer.
 * Mini-cart popover is only opened after Add to Cart, never by this icon.
 */
export function HeaderCartButton() {
  const { count } = useCart();
  const { openDrawer } = useCartDrawer();
  const { open, close } = useMiniCart();

  return (
    <button
      type="button"
      aria-label={count > 0 ? `კალათა — ${count} პროდუქტი` : "კალათა"}
      onClick={() => {
        if (open) close();
        openDrawer();
      }}
      className="relative flex size-10 items-center justify-center rounded-[var(--radius-md)] text-ink-700 transition-colors hover:bg-black/[0.05] hover:text-ink-900"
    >
      <ShoppingCart className="size-[21px]" strokeWidth={1.75} />
      {count > 0 ? (
        <span
          aria-hidden
          className="tnum absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[0.625rem] font-bold leading-none text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
