"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, PackageSearch } from "lucide-react";
import type { Category, Product } from "@/types/product";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { Button } from "@/components/ui/Button";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductListItem } from "@/components/product/ProductListItem";
import { useScrollListingOnPageChange } from "@/hooks/useScrollListingOnPageChange";
import { FilterSidebar } from "@/components/category/FilterSidebar";
import { FilterDrawer } from "@/components/category/FilterDrawer";
import { FilterChips } from "@/components/category/FilterChips";
import { SortSelect } from "@/components/category/SortSelect";
import { ViewToggle, type ViewMode } from "@/components/category/ViewToggle";
import {
  applyFilters,
  categoryLabelsFromProducts,
  countActiveFilters,
  emptyFilters,
  sortProducts,
  type CategoryFilterState,
  type SortKey,
} from "@/components/category/filters";

const PAGE_SIZE = 12;

/** Richer empty state for a zero-result search — offers a way forward instead of a dead end. */
function NoResults({ query, browseCategories }: { query: string; browseCategories: Category[] }) {
  const router = useRouter();
  const [retryQuery, setRetryQuery] = useState("");

  return (
    <div className="py-10 sm:py-16">
      <Container>
        <Breadcrumbs items={[{ label: "ძიების შედეგები" }]} className="mb-6" />

        <div className="mx-auto flex max-w-lg flex-col items-center gap-5 py-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-surface-2">
            <PackageSearch className="size-8 text-text-faint" strokeWidth={1.5} />
          </span>

          <div>
            <h1 className="text-h2 text-text">პროდუქტი ვერ მოიძებნა</h1>
            <p className="text-body mt-2 text-text-muted">
              &quot;{query}&quot;-სთვის შედეგი ვერ მოიძებნა. სცადეთ სხვა საკვანძო სიტყვა ან დაათვალიერეთ კატეგორიები.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (retryQuery.trim()) router.push(`/search?q=${encodeURIComponent(retryQuery.trim())}`);
            }}
            className="flex w-full max-w-sm items-center gap-2"
          >
            <label htmlFor="retry-search" className="sr-only">
              სცადეთ სხვა საკვანძო სიტყვა
            </label>
            <input
              id="retry-search"
              type="search"
              value={retryQuery}
              onChange={(e) => setRetryQuery(e.target.value)}
              placeholder="სცადეთ სხვა საკვანძო სიტყვა"
              className="h-11 min-w-0 flex-1 rounded-[var(--radius-md)] border border-border-strong px-3.5 text-[0.9375rem] text-text placeholder:text-text-faint focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
            />
            <Button type="submit" size="md" className="shrink-0">
              ძებნა
            </Button>
          </form>

          {browseCategories.length > 0 ? (
            <div className="flex flex-col items-center gap-3">
              <p className="text-label text-text-faint">ან დაათვალიერეთ კატეგორიები</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {browseCategories.slice(0, 8).map((category) => (
                  <Link
                    key={category.id}
                    href={category.href}
                    className="text-small rounded-full border border-border-strong px-3.5 py-1.5 font-medium text-text transition-colors hover:border-brand-500 hover:text-brand-600"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <Button href="/" variant="secondary" className="mt-1">
            მთავარზე დაბრუნება
          </Button>
        </div>
      </Container>
    </div>
  );
}

export function SearchPageClient({
  query,
  products,
  browseCategories,
}: {
  query: string;
  products: Product[];
  browseCategories: Category[];
}) {
  const [filters, setFilters] = useState<CategoryFilterState>(emptyFilters);
  const [sort, setSort] = useState<SortKey>("popularity");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const listRef = useScrollListingOnPageChange(page);

  const filtered = useMemo(() => applyFilters(products, filters), [products, filters]);
  const sorted = useMemo(() => sortProducts(filtered, sort), [filtered, sort]);
  const categoryLabels = useMemo(() => categoryLabelsFromProducts(products), [products]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeCount = countActiveFilters(filters);

  const updateFilters = (patch: Partial<CategoryFilterState>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setPage(1);
  };

  const handleSortChange = (value: SortKey) => {
    setSort(value);
    setPage(1);
  };

  if (products.length === 0) {
    return <NoResults query={query} browseCategories={browseCategories} />;
  }

  return (
    <div className="py-6 sm:py-8">
      <Container>
        <Breadcrumbs items={[{ label: "ძიების შედეგები" }]} className="mb-4" />

        <div className="mb-6 max-w-2xl sm:mb-8">
          <h1 className="text-h2 text-text">
            ძიების შედეგები: <span className="text-brand-600">&quot;{query}&quot;</span>
          </h1>
          <p className="text-small tnum mt-2 text-text-faint">ნაპოვნია {products.length} პროდუქტი</p>
        </div>

        <div
          ref={listRef}
          className="mb-5 scroll-mt-28 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5 sm:scroll-mt-32"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="text-small relative inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-border-strong px-3.5 font-medium text-text transition-colors hover:border-border lg:hidden"
            >
              <SlidersHorizontal className="size-4" strokeWidth={2.25} />
              ფილტრი
              {activeCount > 0 ? (
                <span className="tnum ml-0.5 inline-flex size-5 items-center justify-center rounded-full bg-brand-600 text-[0.6875rem] font-semibold text-white">
                  {activeCount}
                </span>
              ) : null}
            </button>

            <p className="text-small tnum hidden text-text-muted sm:block">
              ნაპოვნია <span className="font-semibold text-text">{sorted.length}</span> პროდუქტი
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <SortSelect value={sort} onChange={handleSortChange} />
            <ViewToggle value={view} onChange={setView} className="hidden sm:inline-flex" />
          </div>
        </div>

        <FilterChips
          filters={filters}
          onChange={updateFilters}
          onClearAll={clearFilters}
          categoryLabels={categoryLabels}
          className="mb-5"
        />

        <div className="flex items-start gap-8">
          <FilterSidebar
            products={products}
            filters={filters}
            onChange={updateFilters}
            onClear={clearFilters}
            className="sticky top-24 hidden w-64 shrink-0 lg:block"
          />

          <div className="min-w-0 flex-1">
            {pageItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-border-strong py-20 text-center">
                <PackageSearch className="size-10 text-text-faint" strokeWidth={1.5} />
                <p className="text-body font-semibold text-text">პროდუქტი ვერ მოიძებნა</p>
                <p className="text-small max-w-xs text-text-muted">
                  სცადეთ ფილტრების შეცვლა ან გასუფთავება, რომ მეტი პროდუქტი იხილოთ.
                </p>
                {activeCount > 0 ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-small mt-1 font-semibold text-brand-600 hover:text-brand-700"
                  >
                    ფილტრების გასუფთავება
                  </button>
                ) : null}
              </div>
            ) : view === "grid" ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                {pageItems.map((product) => (
                  <ProductCard key={product.id} product={product} className="h-full" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {pageItems.map((product) => (
                  <ProductListItem key={product.id} product={product} />
                ))}
              </div>
            )}

            <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} className="mt-10" />
          </div>
        </div>
      </Container>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        footer={
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="text-btn flex h-11 w-full items-center justify-center rounded-[var(--radius-sm)] bg-ink-900 text-white transition-colors hover:bg-brand-600"
          >
            შედეგების ნახვა ({sorted.length})
          </button>
        }
      >
        <FilterSidebar
          products={products}
          filters={filters}
          onChange={updateFilters}
          onClear={clearFilters}
          showHeading={false}
        />
      </FilterDrawer>
    </div>
  );
}
