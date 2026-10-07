"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal, PackageSearch } from "lucide-react";
import type { Category, Product } from "@/types/product";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductListItem } from "@/components/product/ProductListItem";
import { useScrollListingIntoView } from "@/hooks/useScrollListingOnPageChange";
import { FilterSidebar } from "./FilterSidebar";
import { FilterDrawer } from "./FilterDrawer";
import { FilterChips } from "./FilterChips";
import { SortSelect } from "./SortSelect";
import { ViewToggle, type ViewMode } from "./ViewToggle";
import {
  applyFilters,
  categoryLabelsFromProducts,
  countActiveFilters,
  emptyFilters,
  filtersRevision,
  sortProducts,
  type CategoryFilterState,
  type SortKey,
} from "./filters";

const PAGE_SIZE = 12;

export function CategoryPageClient({ category, products }: { category: Category; products: Product[] }) {
  const [filters, setFilters] = useState<CategoryFilterState>(emptyFilters);
  const [sort, setSort] = useState<SortKey>("popularity");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const listRef = useScrollListingIntoView(`${page}:${filtersRevision(filters)}`);

  const filtered = useMemo(() => applyFilters(products, filters), [products, filters]);
  const sorted = useMemo(() => sortProducts(filtered, sort), [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeCount = countActiveFilters(filters);
  const categoryLabels = useMemo(() => categoryLabelsFromProducts(products), [products]);

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

  return (
    <div className="py-6 sm:py-8">
      <Container>
        <Breadcrumbs items={[{ label: category.name }]} className="mb-5" />

        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
          <div className="max-w-2xl">
            <h1 className="text-h2 text-text">{category.name}</h1>
            {category.description ? (
              <p className="text-body mt-2 text-text-muted">{category.description}</p>
            ) : null}
          </div>
          <p className="text-small tnum rounded-full border border-border bg-surface px-3 py-1.5 font-medium text-text-muted">
            {products.length} პროდუქტი
          </p>
        </div>

        <div
          ref={listRef}
          className="mb-5 scroll-mt-28 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border bg-surface px-3 py-3 sm:scroll-mt-32 sm:px-4"
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="text-small relative inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface px-3.5 font-medium text-text transition-colors hover:border-brand-200 hover:bg-brand-50 lg:hidden"
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
