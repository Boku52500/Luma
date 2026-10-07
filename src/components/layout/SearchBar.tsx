"use client";

import { useEffect, useId, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchBox } from "./search/useSearchBox";
import { SearchResultsPanel, getActiveOptionId } from "./search/SearchResultsPanel";

export function SearchBar({ className }: { className?: string }) {
  const idPrefix = useId();
  const listboxId = `${idPrefix}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const box = useSearchBox();
  const { query, setQuery, open, setOpen, activeIndex, handleKeyDown, clear, goToSearch, showRecent, isQuerying } = box;

  const panelVisible = open && (showRecent || isQuerying);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, setOpen]);

  return (
    <div ref={containerRef} className={cn("group relative w-full overflow-visible", className)}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          goToSearch(query);
        }}
        className="relative w-full"
      >
        <label htmlFor="site-search" className="sr-only">
          პროდუქტების ძებნა
        </label>
        <Search
          className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-text-faint"
          strokeWidth={2}
        />
        <input
          id="site-search"
          type="text"
          role="combobox"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={panelVisible}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={panelVisible ? getActiveOptionId(idPrefix, activeIndex) : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="მოძებნე პროდუქტი, ბრენდი ან კატეგორია"
          className="h-11 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface-2 pl-11 pr-24 text-[0.9375rem] text-text placeholder:text-text-faint transition-colors duration-150 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
        />
        {query ? (
          <button
            type="button"
            aria-label="ძებნის გასუფთავება"
            onClick={clear}
            className="absolute right-[4.75rem] top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text-faint transition-colors duration-150 hover:bg-black/[0.05] hover:text-text"
          >
            <X className="size-4" strokeWidth={2.25} />
          </button>
        ) : null}
        <button
          type="submit"
          className="absolute right-1.5 top-1.5 inline-flex h-8 items-center rounded-[var(--radius-sm)] bg-brand-600 px-4 text-[0.8125rem] font-semibold text-white transition-colors hover:bg-brand-700"
        >
          ძებნა
        </button>
      </form>

      {panelVisible ? (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[60] max-h-[28rem] overflow-y-auto rounded-[var(--radius-md)] border border-border bg-surface shadow-lg">
          <SearchResultsPanel box={box} idPrefix={idPrefix} listboxId={listboxId} />
        </div>
      ) : null}
    </div>
  );
}
