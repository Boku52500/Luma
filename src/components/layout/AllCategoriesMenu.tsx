"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryNavNode } from "@/lib/categoryNav";

function menuItems(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[role="menuitem"], button[aria-expanded]')];
}

function Branch({
  nodes,
  depth,
  onNavigate,
}: {
  nodes: CategoryNavNode[];
  depth: number;
  onNavigate: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className={cn(depth === 0 ? "py-1" : "border-l border-border ml-3")}>
      {nodes.map((node) => {
        const expandable = node.children.length > 0;
        const open = openId === node.id;
        return (
          <li key={node.id}>
            <div className="flex items-stretch">
              <Link
                href={node.href}
                prefetch={false}
                role="menuitem"
                onClick={onNavigate}
                className={cn(
                  "flex min-h-10 min-w-0 flex-1 items-center px-3 text-small text-ink-800 hover:bg-black/[0.04] hover:text-brand-800",
                  node.highlight && "font-semibold text-danger-500",
                )}
              >
                <span className="truncate">{node.name}</span>
              </Link>
              {expandable ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`cat-branch-${node.id}`}
                  aria-label={`${node.name} — ქვეკატეგორიები`}
                  className="flex size-10 shrink-0 items-center justify-center text-ink-600 hover:bg-black/[0.04]"
                  onClick={() => setOpenId(open ? null : node.id)}
                >
                  <ChevronRight className={cn("size-4 transition-transform", open && "rotate-90")} />
                </button>
              ) : null}
            </div>
            {expandable && open ? (
              <div id={`cat-branch-${node.id}`}>
                <Branch nodes={node.children} depth={depth + 1} onNavigate={onNavigate} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function CategoryTreeList({
  nodes,
  depth = 0,
  onNavigate,
}: {
  nodes: CategoryNavNode[];
  depth?: number;
  onNavigate: () => void;
}) {
  return <Branch nodes={nodes} depth={depth} onNavigate={onNavigate} />;
}

export function AllCategoriesMenu({
  tree,
  onNavigate,
}: {
  tree: CategoryNavNode[];
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
        return;
      }
      if (!panelRef.current) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") {
        return;
      }
      const items = menuItems(panelRef.current);
      if (items.length === 0) return;
      event.preventDefault();
      const current = items.findIndex((item) => item === document.activeElement);
      let next = 0;
      if (event.key === "ArrowDown") next = current < 0 ? 0 : Math.min(current + 1, items.length - 1);
      if (event.key === "ArrowUp") next = current < 0 ? items.length - 1 : Math.max(current - 1, 0);
      if (event.key === "End") next = items.length - 1;
      items[next]?.focus();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={labelId}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="text-nav flex items-center gap-2 py-3 text-ink-900 hover:text-brand-800"
      >
        <LayoutGrid className="size-[18px]" strokeWidth={2} />
        ყველა კატეგორია
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={labelId}
          role="menu"
          className="absolute left-0 top-full z-30 max-h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2rem))] overflow-x-hidden overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface py-2 shadow-lg"
        >
          {tree.length === 0 ? (
            <p className="px-3 py-2 text-small text-text-muted">კატეგორიები ჯერ არ არის.</p>
          ) : (
            <Branch
              nodes={tree}
              depth={0}
              onNavigate={() => {
                setOpen(false);
                onNavigate?.();
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
