"use client";

import { useEffect, useRef } from "react";

/**
 * Scrolls the product listing anchor into view when pagination page changes.
 * Skips the initial mount so first paint / back-forward restore stay calm.
 */
export function useScrollListingOnPageChange(page: number) {
  const listRef = useRef<HTMLDivElement>(null);
  const skipInitial = useRef(true);

  useEffect(() => {
    if (skipInitial.current) {
      skipInitial.current = false;
      return;
    }
    const node = listRef.current;
    if (!node) return;

    const frame = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [page]);

  return listRef;
}
