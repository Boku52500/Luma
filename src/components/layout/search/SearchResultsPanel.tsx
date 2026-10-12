import { Clock, X, ChevronRight, Search, PackageSearch, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { iconByVisual } from "@/components/product/ProductImage";
import { SearchProductRow } from "./SearchProductRow";
import type { SearchFlatItem, UseSearchBoxReturn } from "./useSearchBox";

function optionId(idPrefix: string, index: number) {
  return `${idPrefix}-option-${index}`;
}

export function getActiveOptionId(idPrefix: string, activeIndex: number): string | undefined {
  return activeIndex >= 0 ? optionId(idPrefix, activeIndex) : undefined;
}

function itemKey(item: SearchFlatItem): string {
  switch (item.type) {
    case "recent":
      return `recent-${item.term}`;
    case "category":
      return `category-${item.category.id}`;
    case "brand":
      return `brand-${item.brand}`;
    case "product":
      return `product-${item.product.id}`;
    case "view-all":
      return "view-all";
  }
}

function sectionLabel(type: SearchFlatItem["type"]): string | null {
  switch (type) {
    case "category":
      return "კატეგორიები";
    case "brand":
      return "ბრენდები";
    case "product":
      return "პროდუქტები";
    default:
      return null;
  }
}

/**
 * Presentational suggestions list shared by the desktop dropdown and the
 * mobile overlay — all behavior (what's shown, keyboard index, navigation)
 * lives in `useSearchBox`; this component only renders whatever state it's
 * handed.
 */
export function SearchResultsPanel({
  box,
  idPrefix,
  listboxId,
  className,
}: {
  box: UseSearchBoxReturn;
  idPrefix: string;
  listboxId: string;
  className?: string;
}) {
  const {
    query,
    items,
    activeIndex,
    setActiveIndex,
    selectItem,
    showRecent,
    isQuerying,
    belowThreshold,
    hasResults,
    suggestionsPending,
    unavailable,
    recent,
    removeRecent,
    clearRecent,
    prefetchItem,
  } = box;

  if (belowThreshold) {
    return (
      <div className={cn("px-4 py-6 text-center text-small text-text-faint", className)}>
        გააგრძელეთ ტექსტის აკრეფა…
      </div>
    );
  }

  if (showRecent) {
    return (
      <div className={cn("py-2", className)} role="listbox" id={listboxId} aria-label="ბოლოს ძებნილი">
        <div className="flex items-center justify-between px-4 pb-1 pt-1.5">
          <span className="text-label text-text-faint">ბოლოს ძებნილი</span>
          <button
            type="button"
            onClick={clearRecent}
            className="text-label font-medium text-brand-800 transition-colors hover:text-brand-900"
          >
            ყველას გასუფთავება
          </button>
        </div>
        <ul>
          {recent.map((term, index) => {
            const active = index === activeIndex;
            return (
              <li key={term} className="group">
                <div
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn("flex items-center gap-1 pr-2", active && "bg-surface-2")}
                >
                  <button
                    id={optionId(idPrefix, index)}
                    role="option"
                    aria-selected={active}
                    type="button"
                    onClick={() => selectItem({ type: "recent", term })}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-4 text-left"
                  >
                    <Clock className="size-4 shrink-0 text-text-faint" strokeWidth={2} />
                    <span className="truncate text-small text-text">{term}</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`"${term}" წაშლა ბოლოს ძებნილებიდან`}
                    onClick={() => removeRecent(term)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-text-faint opacity-0 transition-opacity hover:bg-black/[0.06] hover:text-text focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <X className="size-3.5" strokeWidth={2.25} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!isQuerying) return null;

  if (unavailable) {
    return (
      <div className={cn("flex flex-col items-center gap-2 px-4 py-8 text-center", className)}>
        <PackageSearch className="size-8 text-text-faint" strokeWidth={1.5} />
        <p className="text-small font-medium text-text">ძიება დროებით მიუწვდომელია</p>
        <p className="text-label text-text-faint">სცადეთ თავიდან ცოტა ხანში</p>
      </div>
    );
  }

  if (!hasResults && suggestionsPending) {
    return <div className={cn("h-16", className)} aria-hidden="true" />;
  }

  if (!hasResults) {
    return (
      <div className={cn("flex flex-col items-center gap-2 px-4 py-8 text-center", className)}>
        <PackageSearch className="size-8 text-text-faint" strokeWidth={1.5} />
        <p className="text-small font-medium text-text">&quot;{query}&quot;-სთვის შედეგი ვერ მოიძებნა</p>
        <p className="text-label text-text-faint">სცადეთ სხვა საკვანძო სიტყვა ან ბრენდი</p>
      </div>
    );
  }

  return (
    <div className={cn("py-2", className)} role="listbox" id={listboxId} aria-label="ძიების შედეგები">
      {items.map((item, index) => {
        const active = index === activeIndex;
        const header = index === 0 || items[index - 1].type !== item.type ? sectionLabel(item.type) : null;

        return (
          <div key={itemKey(item)}>
            {header ? (
              <p className="px-4 pb-1 pt-2.5 text-label text-text-faint first:pt-1.5">{header}</p>
            ) : null}

            {item.type === "category" ? (
              (() => {
                const Icon = iconByVisual[item.category.visual];
                return (
                  <button
                    id={optionId(idPrefix, index)}
                    role="option"
                    aria-selected={active}
                    type="button"
                    onMouseEnter={() => {
                      setActiveIndex(index);
                      prefetchItem(item);
                    }}
                    onClick={() => selectItem(item)}
                    className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", active && "bg-surface-2")}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-ink-700">
                      <Icon className="size-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-small font-medium text-text">
                      {item.category.name}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-text-faint" strokeWidth={2} />
                  </button>
                );
              })()
            ) : item.type === "brand" ? (
              <button
                id={optionId(idPrefix, index)}
                role="option"
                aria-selected={active}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectItem(item)}
                className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", active && "bg-surface-2")}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-surface-2 text-ink-700">
                  <Tag className="size-4" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1 truncate text-small font-medium text-text">{item.brand}</span>
                <ChevronRight className="size-4 shrink-0 text-text-faint" strokeWidth={2} />
              </button>
            ) : item.type === "product" ? (
              <SearchProductRow
                id={optionId(idPrefix, index)}
                product={item.product}
                active={active}
                onHover={() => {
                  setActiveIndex(index);
                  prefetchItem(item);
                }}
                onSelect={() => selectItem(item)}
              />
            ) : item.type === "view-all" ? (
              <button
                id={optionId(idPrefix, index)}
                role="option"
                aria-selected={active}
                type="button"
                onMouseEnter={() => {
                  setActiveIndex(index);
                  prefetchItem(item);
                }}
                onClick={() => selectItem(item)}
                className={cn(
                  "mt-1 flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-3 text-small font-semibold text-brand-800 transition-colors",
                  active && "bg-brand-50"
                )}
              >
                <Search className="size-4" strokeWidth={2.25} />
                ყველა შედეგის ნახვა ({item.total})
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
