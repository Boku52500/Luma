"use client";

/**
 * Browser-local cart persistence. Lines store a minimal catalogue snapshot
 * taken at add time so the mini-cart, `/cart`, and checkout can render
 * without consulting `src/data` or PostgreSQL.
 *
 * `snapshot.unitPrice` is the displayed price when the user added the line —
 * not payment-authoritative. A future server checkout must revalidate
 * against PostgreSQL before creating a real order.
 *
 * Storage shape (version 2):
 *   { version: 2, items: CartLineItem[] }
 *
 * Version 1 was a bare array of `{ productId, quantity, variants }` with no
 * snapshot. Those entries cannot be hydrated without the mock catalogue, so
 * they are discarded on read rather than keeping a permanent `src/data` fallback.
 */

import type { Product } from "@/types/product";
import {
  CART_STORAGE_VERSION,
  buildLineId,
  cartSnapshotFromProduct,
  parseCartLineItem,
  type CartLineItem,
} from "@/lib/productSnapshots";
import { MAX_CART_LINES } from "@/lib/cart";

export type { CartLineItem } from "@/lib/productSnapshots";

const STORAGE_KEY = "luma:cart";
const MAX_QUANTITY = 99;
const listeners = new Set<() => void>();

/** Always the same empty-array reference for SSR/pre-hydration snapshots — required by `useSyncExternalStore` to avoid an "infinite loop" warning. */
const EMPTY_CART: CartLineItem[] = [];

let cache: CartLineItem[] | null = null;

function clampQuantity(quantity: number): number {
  if (!Number.isFinite(quantity)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(quantity)));
}

function parseCartDocument(raw: unknown): CartLineItem[] {
  // v1: bare array of id-only lines. Cannot resolve without mock catalogue.
  if (Array.isArray(raw)) return [];
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) return [];
  if (typeof record.version === "number" && record.version < CART_STORAGE_VERSION) return [];
  const items: CartLineItem[] = [];
  const seen = new Set<string>();
  for (const entry of record.items) {
    const line = parseCartLineItem(entry);
    if (!line || seen.has(line.id)) continue;
    seen.add(line.id);
    items.push(line);
  }
  return items;
}

/** Reads and validates persisted cart data — malformed/corrupted entries are silently dropped instead of crashing the app. */
function readStorage(): CartLineItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseCartDocument(JSON.parse(raw));
  } catch {
    return [];
  }
}

function getSnapshot(): CartLineItem[] {
  if (cache === null) cache = readStorage();
  return cache;
}

function getServerSnapshot(): CartLineItem[] {
  return EMPTY_CART;
}

function writeStorage(next: CartLineItem[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: CART_STORAGE_VERSION, items: next }));
  } catch {
    // Storage can throw (quota, private-browsing) — the in-memory cache still
    // keeps the cart working for the rest of the session.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function addItem(product: Product, quantity = 1, variants?: Record<string, string>): CartLineItem | null {
  if (quantity <= 0 || !product?.id || !product.slug || !product.name || !product.brand) return null;
  const mapped = cartSnapshotFromProduct(product, variants);
  const id = buildLineId(mapped.productId, mapped.variants);
  const current = getSnapshot();
  const existingIndex = current.findIndex((item) => item.id === id);

  if (existingIndex >= 0) {
    const next = current.slice();
    const existing = next[existingIndex];
    next[existingIndex] = {
      ...existing,
      quantity: clampQuantity(existing.quantity + quantity),
    };
    writeStorage(next);
    return next[existingIndex];
  }

  if (current.length >= MAX_CART_LINES) return null;

  const line: CartLineItem = {
    id,
    productId: mapped.productId,
    quantity: clampQuantity(quantity),
    variants: mapped.variants,
    variantLabels: mapped.variantLabels,
    snapshot: mapped.snapshot,
    addedAt: Date.now(),
  };
  writeStorage([...current, line]);
  return line;
}

function setQuantity(lineId: string, quantity: number) {
  const current = getSnapshot();
  if (quantity <= 0) {
    writeStorage(current.filter((item) => item.id !== lineId));
    return;
  }
  writeStorage(current.map((item) => (item.id === lineId ? { ...item, quantity: clampQuantity(quantity) } : item)));
}

function removeItem(lineId: string) {
  writeStorage(getSnapshot().filter((item) => item.id !== lineId));
}

function clear() {
  writeStorage([]);
}

export const cartStore = {
  subscribe,
  getSnapshot,
  getServerSnapshot,
  addItem,
  setQuantity,
  removeItem,
  clear,
  buildLineId,
};
