"use client";

import { useEffect, useRef } from "react";

/**
 * Scrolls the product listing anchor into view when `trigger` changes
 * (pagination page and/or filter revision). Skips the initial mount.
 */
export function useScrollListingIntoView(trigger: string | number) {
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
  }, [trigger]);

  return listRef;
}

/** @deprecated Prefer useScrollListingIntoView — kept for any external imports. */
export function useScrollListingOnPageChange(page: number) {
  return useScrollListingIntoView(page);
}
