"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { Product } from "@/types/product";
import type { CartLineItem, CartProductSnapshot, CartVariantLabel } from "@/lib/productSnapshots";
import { cartStore } from "@/lib/cartStore";
import { getCartItemCount, getCartSubtotal, getLineTotal } from "@/lib/cart";

/**
 * A cart line ready to render. Pricing comes from the persisted snapshot
 * (`snapshot.unitPrice`), not from PostgreSQL and not from `src/data`.
 *
 * That snapshot is trustworthy enough for local UI totals only. A future
 * server-side checkout must revalidate live product prices before charging.
 */
export interface ResolvedCartLine {
  id: string;
  productId: string;
  quantity: number;
  variants: Record<string, string>;
  variantLabels: CartVariantLabel[];
  snapshot: CartProductSnapshot;
  addedAt: number;
  lineTotal: number;
}

function resolveLine(item: CartLineItem): ResolvedCartLine {
  return {
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    variants: item.variants,
    variantLabels: item.variantLabels,
    snapshot: item.snapshot,
    addedAt: item.addedAt,
    lineTotal: getLineTotal(item.snapshot.unitPrice, item.quantity),
  };
}

const imageHydrationAttempted = new Set<string>();

async function hydrateMissingCartImages(items: CartLineItem[]) {
  const missingIds = [
    ...new Set(
      items
        .filter((item) => !item.snapshot.imageSrc && !imageHydrationAttempted.has(item.productId))
        .map((item) => item.productId),
    ),
  ];
  if (missingIds.length === 0) return;
  for (const id of missingIds) imageHydrationAttempted.add(id);

  try {
    const response = await fetch(`/api/cart/product-images?ids=${encodeURIComponent(missingIds.join(","))}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { images?: Record<string, { src: string; alt?: string }> };
    if (data.images && Object.keys(data.images).length > 0) {
      cartStore.hydrateImages(data.images);
    }
  } catch {
    // Offline / transient — keep illustration fallback until next opportunity.
  }
}

/**
 * The single hook every surface (header badge, mini-cart, `/cart` page,
 * add-to-cart buttons) uses to read and mutate the cart.
 *
 * Add-to-cart takes a storefront `Product` DTO (from PostgreSQL pages) and
 * snapshots the displayed price/image/slug into localStorage. Same product +
 * same variants merge quantity and keep the original price snapshot; a
 * different variant selection is always a separate line.
 */
export function useCart() {
  const rawItems = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);

  useEffect(() => {
    void hydrateMissingCartImages(rawItems);
  }, [rawItems]);

  const items = useMemo<ResolvedCartLine[]>(
    () => rawItems.map(resolveLine).sort((a, b) => a.addedAt - b.addedAt),
    [rawItems],
  );

  const count = useMemo(() => getCartItemCount(items), [items]);
  const subtotal = useMemo(() => getCartSubtotal(items), [items]);

  const addItem = useCallback((product: Product, quantity = 1, variants?: Record<string, string>) => {
    return cartStore.addItem(product, quantity, variants);
  }, []);

  const setQuantity = useCallback((lineId: string, quantity: number) => {
    cartStore.setQuantity(lineId, quantity);
  }, []);

  const removeItem = useCallback((lineId: string) => {
    cartStore.removeItem(lineId);
  }, []);

  const clear = useCallback(() => {
    cartStore.clear();
  }, []);

  return { items, count, subtotal, addItem, setQuantity, removeItem, clear };
}
