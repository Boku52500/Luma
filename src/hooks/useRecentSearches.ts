"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "luma:recent-searches";
const MAX_RECENT = 5;
const listeners = new Set<() => void>();

/** Lazily-read, module-level cache — read once from localStorage, then only ever updated through `writeStorage` so `getSnapshot` can return a stable reference (required by `useSyncExternalStore`). */
let cache: string[] | null = null;

/** Stable, never-mutated reference for the server/pre-hydration snapshot — `useSyncExternalStore` requires the same reference back when nothing has changed, or it assumes an infinite loop. */
const EMPTY_RECENT: string[] = [];

function readStorage(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT);
    }
  } catch {
    // Ignore malformed/inaccessible storage — starts from an empty recent list.
  }
  return [];
}

function getSnapshot(): string[] {
  if (cache === null) cache = readStorage();
  return cache;
}

/** Always `[]` on the server (and for React's very first client hydration pass) so markup can never diverge between server and client — the real localStorage value is only swapped in by `useSyncExternalStore` immediately after hydration completes. */
function getServerSnapshot(): string[] {
  return EMPTY_RECENT;
}

function writeStorage(next: string[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage can throw in private-browsing/storage-restricted contexts — recent searches are a nice-to-have, so fail silently.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Small localStorage-backed "recent searches" store (latest 5, most recent
 * first). No login required. Backed by `useSyncExternalStore` — the
 * React-sanctioned way to read a mutable external source (like
 * localStorage) without risking a hydration mismatch, and it keeps every
 * mounted search UI (desktop bar + mobile overlay) in sync automatically.
 * Kept behind a hook so this can later be swapped for a per-account backend
 * list without touching any UI.
 */
export function useRecentSearches() {
  const recent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addRecent = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const current = getSnapshot();
    const withoutDuplicate = current.filter((t) => t.toLowerCase() !== trimmed.toLowerCase());
    writeStorage([trimmed, ...withoutDuplicate].slice(0, MAX_RECENT));
  }, []);

  const removeRecent = useCallback((term: string) => {
    writeStorage(getSnapshot().filter((t) => t !== term));
  }, []);

  const clearRecent = useCallback(() => {
    writeStorage([]);
  }, []);

  return { recent, addRecent, removeRecent, clearRecent };
}
