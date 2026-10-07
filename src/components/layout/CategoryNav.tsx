"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type UIEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";
import { CATEGORY_NAV_STACK_CLASS } from "@/lib/headerStack";
import { CategoryIcon } from "@/lib/categoryIcons";
import { CategoryMegaMenu } from "./CategoryMegaMenu";
import type { CategoryNavNode, MainNavItem } from "@/lib/categoryNav";

function NavArrow({
  direction,
  visible,
  onClick,
}: {
  direction: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === "left" ? "წინა კატეგორიები" : "შემდეგი კატეგორიები"}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-ink-700 shadow-sm transition-opacity duration-200",
        "hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
        direction === "left" ? "left-0" : "right-0",
      )}
    >
      <Icon className="size-4" strokeWidth={2.25} />
    </button>
  );
}

export function CategoryNav({
  className,
  mainNav = [],
  categoryTree = [],
}: {
  className?: string;
  mainNav?: MainNavItem[];
  categoryTree?: CategoryNavNode[];
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const track = trackRef.current;
    if (!track) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    const max = track.scrollWidth - track.clientWidth;
    setCanScrollLeft(track.scrollLeft > 2);
    setCanScrollRight(max > 2 && track.scrollLeft < max - 2);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateScrollState();
    const onResize = () => updateScrollState();
    window.addEventListener("resize", onResize);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    observer?.observe(track);
    return () => {
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [mainNav, updateScrollState]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onWheel = (event: WheelEvent) => {
      if (track.scrollWidth <= track.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      track.scrollLeft += event.deltaY;
      updateScrollState();
    };
    track.addEventListener("wheel", onWheel, { passive: false });
    return () => track.removeEventListener("wheel", onWheel);
  }, [updateScrollState]);

  const scrollByDirection = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.min(280, track.clientWidth * 0.65), behavior: "smooth" });
  };

  const onScroll = (_event: UIEvent<HTMLUListElement>) => {
    updateScrollState();
  };

  let fadeOverlay: ReactNode = null;
  if (canScrollLeft || canScrollRight) {
    fadeOverlay = (
      <>
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-surface to-transparent transition-opacity duration-200",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface to-transparent transition-opacity duration-200",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />
      </>
    );
  }

  return (
    <nav
      aria-label="კატეგორიები"
      className={cn("hidden border-b border-border bg-surface lg:block", CATEGORY_NAV_STACK_CLASS, className)}
    >
      <Container className="flex min-w-0 items-center gap-3 py-1.5 xl:gap-4">
        <div className="shrink-0">
          <CategoryMegaMenu tree={categoryTree} />
        </div>
        <div className="relative min-w-0 flex-1">
          <NavArrow direction="left" visible={canScrollLeft} onClick={() => scrollByDirection(-1)} />
          <NavArrow direction="right" visible={canScrollRight} onClick={() => scrollByDirection(1)} />
          {fadeOverlay}
          <ul
            ref={trackRef}
            onScroll={onScroll}
            className={cn(
              "no-scrollbar flex min-w-0 flex-nowrap items-center gap-x-0.5 overflow-x-auto scroll-smooth",
              canScrollLeft || canScrollRight ? "px-8" : "px-0",
            )}
          >
            {mainNav.map((item) => (
              <li key={item.id} className="shrink-0">
                <Link
                  href={item.href}
                  prefetch={false}
                  className={cn(
                    "text-nav flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-1.5 transition-colors duration-200 xl:gap-2 xl:px-2.5",
                    item.highlight
                      ? "font-semibold text-danger-500 hover:text-danger-600"
                      : "text-ink-700 hover:bg-brand-50 hover:text-brand-600",
                  )}
                >
                  <CategoryIcon
                    slug={item.slug}
                    className="size-4 shrink-0 xl:size-[18px]"
                    strokeWidth={1.75}
                  />
                  <span>{item.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </nav>
  );
}
