"use client";

/**
 * Persisted "currently applied promo code" — a single string, empty when
 * none is applied. Lives independently from `cartStore` so it can be read
 * from both the `/cart` page and `/checkout` (single source of truth, per
 * the checkout spec's "no conflicting promo calculations" requirement),
 * using the same SSR-safe module-singleton pattern as the cart itself.
 */

const STORAGE_KEY = "luma:promo-code";
const listeners = new Set<() => void>();
const EMPTY = "";

let cache: string | null = null;

function readStorage(): string {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return typeof raw === "string" ? raw : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): string {
  if (cache === null) cache = readStorage();
  return cache;
}

function getServerSnapshot(): string {
  return EMPTY;
}

function writeStorage(next: string) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore — promo persistence is a nice-to-have, not critical.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setCode(code: string) {
  writeStorage(code.trim().toUpperCase());
}

function clear() {
  writeStorage(EMPTY);
}

export const promoStore = { subscribe, getSnapshot, getServerSnapshot, setCode, clear };
