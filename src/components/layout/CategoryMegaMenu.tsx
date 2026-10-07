"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "@/lib/categoryIcons";
import type { CategoryNavNode } from "@/lib/categoryNav";
import { CategoryTreeList } from "./AllCategoriesMenu";

const CLOSE_DELAY_MS = 160;

function groupChildren(nodes: CategoryNavNode[]): CategoryNavNode[][] {
  if (nodes.length === 0) return [];
  const columns = 3;
  const perCol = Math.ceil(nodes.length / columns);
  const groups: CategoryNavNode[][] = [];
  for (let i = 0; i < nodes.length; i += perCol) {
    groups.push(nodes.slice(i, i + perCol));
  }
  return groups;
}

function MegaPanel({
  active,
  onNavigate,
}: {
  active: CategoryNavNode;
  onNavigate: () => void;
}) {
  const childGroups = groupChildren(active.children);

  return (
    <div className="flex min-h-[20rem] flex-1 flex-col p-6">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-5">
        <div className="flex items-center gap-3.5">
          <span className="flex size-11 items-center justify-center rounded-[var(--radius-md)] bg-brand-50 text-brand-600">
            <CategoryIcon slug={active.slug} className="size-5" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-body font-semibold text-text">{active.name}</p>
            <Link
              href={active.href}
              onClick={onNavigate}
              className="text-small font-medium text-brand-600 transition-colors hover:text-brand-700"
            >
              ყველა {active.name} →
            </Link>
          </div>
        </div>
      </div>

      {active.children.length === 0 ? (
        <Link
          href={active.href}
          onClick={onNavigate}
          className="text-body inline-flex items-center gap-2 font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          {active.name} — ყველა პროდუქტი
          <ChevronRight className="size-4" strokeWidth={2} />
        </Link>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
          {childGroups.map((group, index) => (
            <ul key={index} className="space-y-0.5">
              {group.map((child) => (
                <li key={child.id}>
                  <Link
                    href={child.href}
                    prefetch={false}
                    onClick={onNavigate}
                    className="flex items-center justify-between rounded-[var(--radius-sm)] px-2.5 py-2.5 text-small font-medium text-ink-800 transition-colors hover:bg-brand-50 hover:text-brand-700"
                  >
                    <span className="truncate">{child.name}</span>
                    {child.children.length > 0 ? (
                      <ChevronRight className="size-3.5 shrink-0 text-text-faint" strokeWidth={2} />
                    ) : null}
                  </Link>
                  {child.children.length > 0 ? (
                    <ul className="ml-3 border-l border-border pl-3">
                      {child.children.slice(0, 8).map((grand) => (
                        <li key={grand.id}>
                          <Link
                            href={grand.href}
                            prefetch={false}
                            onClick={onNavigate}
                            className="block truncate rounded-[var(--radius-sm)] px-2 py-1.5 text-[0.8125rem] text-text-muted transition-colors hover:bg-surface-2 hover:text-brand-600"
                          >
                            {grand.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryMegaMenu({
  tree,
  onNavigate,
  variant = "default",
}: {
  tree: CategoryNavNode[];
  onNavigate?: () => void;
  /** Compact trigger for the main header row next to search. */
  variant?: "default" | "header";
}) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(tree[0]?.id ?? null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const labelId = useId();
  const isHeader = variant === "header";

  const active = tree.find((node) => node.id === activeId) ?? tree[0] ?? null;

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  const handleOpen = useCallback(() => {
    clearCloseTimer();
    setOpen(true);
    if (!activeId && tree[0]) setActiveId(tree[0].id);
  }, [activeId, clearCloseTimer, tree]);

  const handleNavigate = useCallback(() => {
    setOpen(false);
    onNavigate?.();
  }, [onNavigate]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={handleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={labelId}
        onClick={() => (open ? setOpen(false) : handleOpen())}
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-md)] font-semibold text-white transition-colors duration-150",
          isHeader
            ? "h-11 gap-1.5 px-3 text-[0.8125rem] xl:gap-2 xl:px-3.5 xl:text-nav"
            : "h-10 px-4 text-nav",
          open ? "bg-brand-700" : "bg-brand-600 hover:bg-brand-700",
        )}
      >
        <LayoutGrid className={cn(isHeader ? "size-4 xl:size-[18px]" : "size-[18px]")} strokeWidth={2} />
        <span className={cn(isHeader && "whitespace-nowrap")}>ყველა კატეგორია</span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={labelId}
          role="menu"
          className={cn(
            "absolute top-[calc(100%+0.35rem)] z-[70] flex overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-[0_12px_40px_rgba(15,17,23,0.12)]",
            isHeader
              ? "left-0 w-[min(68rem,calc(100vw-2rem))]"
              : "left-0 w-[min(68rem,calc(100vw-1.5rem))]",
          )}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          <nav aria-label="კატეგორიების სია" className="w-[16.5rem] shrink-0 border-r border-border bg-surface-2/60 py-2">
            <ul>
              {tree.map((node) => {
                const isActive = node.id === active?.id;
                return (
                  <li key={node.id}>
                    <Link
                      href={node.href}
                      prefetch={false}
                      role="menuitem"
                      onMouseEnter={() => setActiveId(node.id)}
                      onFocus={() => setActiveId(node.id)}
                      onClick={handleNavigate}
                      className={cn(
                        "flex min-h-11 items-center gap-3 px-3 text-small transition-colors",
                        isActive
                          ? "bg-brand-600 font-semibold text-white"
                          : "text-ink-800 hover:bg-white hover:text-brand-600",
                        node.highlight && !isActive && "text-danger-500",
                      )}
                    >
                      <CategoryIcon slug={node.slug} className="size-[18px] shrink-0" strokeWidth={1.75} />
                      <span className="truncate">{node.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          {active ? <MegaPanel active={active} onNavigate={handleNavigate} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Mobile drawer category tree — re-export for MobileMenu. */
export { CategoryTreeList };
