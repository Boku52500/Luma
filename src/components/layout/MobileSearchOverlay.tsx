"use client";

import { useEffect, useId, useRef } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchBox } from "./search/useSearchBox";
import { SearchResultsPanel, getActiveOptionId } from "./search/SearchResultsPanel";

/** Full-screen, focused mobile search experience — replaces trying to fit the desktop dropdown into the mobile header. */
export function MobileSearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const idPrefix = useId();
  const listboxId = `${idPrefix}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const box = useSearchBox({ onNavigate: onClose });
  const { query, setQuery, activeIndex, handleKeyDown, clear, goToSearch, showRecent, isQuerying, belowThreshold } = box;

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = original;
      clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex flex-col bg-surface transition-opacity duration-150 lg:hidden",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none invisible opacity-0"
      )}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
      aria-label="ძებნა"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <button
          type="button"
          aria-label="ძებნის დახურვა"
          onClick={onClose}
          className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-ink-700 hover:bg-black/[0.05]"
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
        </button>

        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            goToSearch(query);
          }}
          className="relative flex-1"
        >
          <label htmlFor="mobile-site-search" className="sr-only">
            პროდუქტების ძებნა
          </label>
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-text-faint"
            strokeWidth={2}
          />
          <input
            ref={inputRef}
            id="mobile-site-search"
            type="text"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={getActiveOptionId(idPrefix, activeIndex)}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="მოძებნე პროდუქტი, ბრენდი ან კატეგორია"
            className="h-11 w-full rounded-[var(--radius-md)] border border-border-strong bg-surface-2 pl-10 pr-9 text-[0.9375rem] text-text placeholder:text-text-faint transition-colors duration-150 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-100"
          />
          {query ? (
            <button
              type="button"
              aria-label="ძებნის გასუფთავება"
              onClick={clear}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-text-faint transition-colors duration-150 hover:bg-black/[0.06] hover:text-text"
            >
              <X className="size-4" strokeWidth={2.25} />
            </button>
          ) : null}
        </form>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-6">
        {belowThreshold ? (
          <div className="px-4 py-8 text-center text-small text-text-faint">გააგრძელეთ ტექსტის აკრეფა…</div>
        ) : !showRecent && !isQuerying ? (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <Search className="size-8 text-text-faint" strokeWidth={1.5} />
            <p className="text-body font-medium text-text">მოძებნეთ სასურველი პროდუქტი</p>
            <p className="text-small text-text-faint">
              დაიწყეთ ტექსტის აკრეფა — მაგ. iPhone, Samsung, ლეპტოპი
            </p>
          </div>
        ) : (
          <SearchResultsPanel box={box} idPrefix={idPrefix} listboxId={listboxId} />
        )}
      </div>
    </div>
  );
}
