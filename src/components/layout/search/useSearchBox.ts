"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { Category, Product } from "@/types/product";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useRecentSearches } from "@/hooks/useRecentSearches";
import {
  SEARCH_MIN_QUERY_LENGTH,
  emptySearchSuggestions,
  type SearchSuggestions,
} from "@/lib/search";

export type SearchFlatItem =
  | { type: "recent"; term: string }
  | { type: "category"; category: Category }
  | { type: "brand"; brand: string }
  | { type: "product"; product: Product }
  | { type: "view-all"; query: string; total: number };

function isSearchSuggestions(value: unknown): value is SearchSuggestions {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record.products) &&
    Array.isArray(record.categories) &&
    Array.isArray(record.brands) &&
    typeof record.productsTotal === "number"
  );
}

/**
 * Shared stateful "brain" behind every search UI (desktop dropdown + mobile
 * overlay): query/debounce, suggestion lookup, recent searches, the flat
 * keyboard-navigable item list, and selection/navigation. Both surfaces
 * render their own markup around this so they can look completely
 * different while sharing one source of truth for behavior.
 */
export function useSearchBox({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebouncedValue(query, 250);
  const { recent, addRecent, removeRecent, clearRecent } = useRecentSearches();

  const [results, setResults] = useState<SearchSuggestions>(emptySearchSuggestions);
  const [resultsFor, setResultsFor] = useState("");
  const [errorFor, setErrorFor] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const cacheRef = useRef(new Map<string, SearchSuggestions>());

  // Reset the highlighted option whenever the query text itself changes, using
  // the React-recommended "adjust state during render" pattern instead of an
  // effect (avoids an extra commit + cascading render on every keystroke).
  const [prevQueryForReset, setPrevQueryForReset] = useState(query);
  if (query !== prevQueryForReset) {
    setPrevQueryForReset(query);
    if (activeIndex !== -1) setActiveIndex(-1);
  }

  const trimmed = query.trim();
  const isQuerying = trimmed.length >= SEARCH_MIN_QUERY_LENGTH;
  const belowThreshold = trimmed.length > 0 && !isQuerying;
  const debouncedTrimmed = debouncedQuery.trim();

  useEffect(() => {
    if (debouncedTrimmed.length < SEARCH_MIN_QUERY_LENGTH) {
      return;
    }

    const cached = cacheRef.current.get(debouncedTrimmed);
    if (cached) {
      setResults(cached);
      setResultsFor(debouncedTrimmed);
      setErrorFor(null);
      return;
    }

    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedTrimmed)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload: unknown = await response.json().catch(() => null);
        if (requestId !== requestIdRef.current) return;
        if (!response.ok || !isSearchSuggestions(payload)) {
          setErrorFor(debouncedTrimmed);
          return;
        }
        cacheRef.current.set(debouncedTrimmed, payload);
        if (cacheRef.current.size > 40) {
          const oldest = cacheRef.current.keys().next().value;
          if (oldest) cacheRef.current.delete(oldest);
        }
        setResults(payload);
        setResultsFor(debouncedTrimmed);
        setErrorFor(null);
      })
      .catch((error: unknown) => {
        if (requestId !== requestIdRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setErrorFor(debouncedTrimmed);
      });

    return () => {
      controller.abort();
    };
  }, [debouncedTrimmed]);

  const unavailable = errorFor === debouncedTrimmed;
  const hasResults = results.products.length > 0 || results.categories.length > 0 || results.brands.length > 0;
  const suggestionsPending = isQuerying && resultsFor !== debouncedTrimmed && !unavailable;
  const showRecent = !isQuerying && !belowThreshold && recent.length > 0;

  const items = useMemo<SearchFlatItem[]>(() => {
    if (showRecent) return recent.map((term) => ({ type: "recent", term }));
    if (!isQuerying || !hasResults) return [];
    return [
      ...results.categories.map((category): SearchFlatItem => ({ type: "category", category })),
      ...results.brands.map((brand): SearchFlatItem => ({ type: "brand", brand })),
      ...results.products.map((product): SearchFlatItem => ({ type: "product", product })),
      { type: "view-all", query: trimmed, total: results.productsTotal },
    ];
  }, [showRecent, recent, isQuerying, hasResults, results, trimmed]);

  const goToSearch = useCallback(
    (term: string) => {
      const value = term.trim();
      if (!value) return;
      addRecent(value);
      setOpen(false);
      setQuery("");
      onNavigate?.();
      router.push(`/search?q=${encodeURIComponent(value)}`);
    },
    [addRecent, onNavigate, router],
  );

  const goToCategory = useCallback(
    (category: Category) => {
      setOpen(false);
      setQuery("");
      onNavigate?.();
      router.push(category.href);
    },
    [onNavigate, router],
  );

  const goToProduct = useCallback(
    (product: Product) => {
      if (trimmed) addRecent(trimmed);
      setOpen(false);
      setQuery("");
      onNavigate?.();
      router.push(`/product/${product.slug}`);
    },
    [addRecent, onNavigate, router, trimmed],
  );

  const prefetchItem = useCallback(
    (item: SearchFlatItem) => {
      switch (item.type) {
        case "category":
          router.prefetch(item.category.href);
          return;
        case "product":
          router.prefetch(`/product/${item.product.slug}`);
          return;
        case "view-all":
          router.prefetch(`/search?q=${encodeURIComponent(item.query)}`);
          return;
        default:
          return;
      }
    },
    [router],
  );

  const selectItem = useCallback(
    (item: SearchFlatItem) => {
      switch (item.type) {
        case "recent":
          goToSearch(item.term);
          return;
        case "category":
          goToCategory(item.category);
          return;
        case "brand":
          goToSearch(item.brand);
          return;
        case "product":
          goToProduct(item.product);
          return;
        case "view-all":
          goToSearch(item.query);
          return;
      }
    },
    [goToSearch, goToCategory, goToProduct],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        if (items.length === 0) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i + 1) % items.length);
      } else if (event.key === "ArrowUp") {
        if (items.length === 0) return;
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
      } else if (event.key === "Enter") {
        if (activeIndex >= 0 && items[activeIndex]) {
          event.preventDefault();
          selectItem(items[activeIndex]);
        } else if (trimmed) {
          event.preventDefault();
          goToSearch(trimmed);
        }
      } else if (event.key === "Escape") {
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        }
      }
    },
    [activeIndex, items, open, selectItem, trimmed, goToSearch],
  );

  const clear = useCallback(() => {
    setQuery("");
    setActiveIndex(-1);
  }, []);

  return {
    query,
    setQuery,
    open,
    setOpen,
    activeIndex,
    setActiveIndex,
    items,
    results,
    recent,
    removeRecent,
    clearRecent,
    isQuerying,
    belowThreshold,
    hasResults,
    showRecent,
    suggestionsPending,
    unavailable,
    selectItem,
    goToSearch,
    handleKeyDown,
    clear,
    prefetchItem,
  };
}

export type UseSearchBoxReturn = ReturnType<typeof useSearchBox>;
