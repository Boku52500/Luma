"use client";

/**
 * Browser-local wishlist persistence. Items store a minimal product snapshot
 * so `/account/wishlist` can render without consulting `src/data`.
 *
 * Stored prices/ratings are the values at toggle time. Visiting a PDP always
 * shows live PostgreSQL data; this list is not kept in sync with the catalogue.
 *
 * Storage shape (version 2):
 *   { version: 2, items: WishlistSnapshot[] }
 *
 * Version 1 was a bare `string[]` of product ids. Those cannot be hydrated
 * without the mock catalogue, so they are discarded on read.
 */

import type { Product } from "@/types/product";
import type { WishlistSnapshot } from "@/lib/productSnapshots";
import { WISHLIST_STORAGE_VERSION, parseWishlistSnapshot, toWishlistSnapshot } from "@/lib/productSnapshots";

export type { WishlistSnapshot } from "@/lib/productSnapshots";

const STORAGE_KEY = "luma:wishlist";
const listeners = new Set<() => void>();
const EMPTY: WishlistSnapshot[] = [];

let cache: WishlistSnapshot[] | null = null;

function parseWishlistDocument(raw: unknown): WishlistSnapshot[] {
  if (Array.isArray(raw)) return [];
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) return [];
  if (typeof record.version === "number" && record.version < WISHLIST_STORAGE_VERSION) return [];
  const items: WishlistSnapshot[] = [];
  const seen = new Set<string>();
  for (const entry of record.items) {
    const item = parseWishlistSnapshot(entry);
    if (!item || seen.has(item.productId)) continue;
    seen.add(item.productId);
    items.push(item);
  }
  return items;
}

function readStorage(): WishlistSnapshot[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseWishlistDocument(JSON.parse(raw));
  } catch {
    return [];
  }
}

function getSnapshot(): WishlistSnapshot[] {
  if (cache === null) cache = readStorage();
  return cache;
}

function getServerSnapshot(): WishlistSnapshot[] {
  return EMPTY;
}

function writeStorage(next: WishlistSnapshot[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: WISHLIST_STORAGE_VERSION, items: next }));
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function add(product: Product) {
  if (!product?.id || !product.slug || !product.name || !product.brand) return;
  const current = getSnapshot();
  if (current.some((item) => item.productId === product.id)) return;
  writeStorage([...current, toWishlistSnapshot(product)]);
}

function remove(productId: string) {
  writeStorage(getSnapshot().filter((item) => item.productId !== productId));
}

function toggle(product: Product) {
  if (!product?.id) return;
  const current = getSnapshot();
  if (current.some((item) => item.productId === product.id)) {
    writeStorage(current.filter((item) => item.productId !== product.id));
    return;
  }
  if (!product.slug || !product.name || !product.brand) return;
  writeStorage([...current, toWishlistSnapshot(product)]);
}

function clear() {
  writeStorage([]);
}

export const wishlistStore = { subscribe, getSnapshot, getServerSnapshot, add, remove, toggle, clear };
