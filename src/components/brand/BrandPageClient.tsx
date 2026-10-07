"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { PackageSearch } from "lucide-react";
import type { Product } from "@/types/product";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Pagination } from "@/components/ui/Pagination";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductListItem } from "@/components/product/ProductListItem";
import { SortSelect } from "@/components/category/SortSelect";
import { ViewToggle, type ViewMode } from "@/components/category/ViewToggle";
import { sortProducts, type SortKey } from "@/components/category/filters";
import { useScrollListingOnPageChange } from "@/hooks/useScrollListingOnPageChange";

const PAGE_SIZE = 12;

export function BrandPageClient({
  brand,
  products,
}: {
  brand: { name: string; slug: string; logoUrl: string | null; description: string | null };
  products: Product[];
}) {
  const [sort, setSort] = useState<SortKey>("popularity");
  const [view, setView] = useState<ViewMode>("grid");
  const [page, setPage] = useState(1);
  const listRef = useScrollListingOnPageChange(page);

  const sorted = useMemo(() => sortProducts(products, sort), [products, sort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="py-6 sm:py-8">
      <Container>
        <Breadcrumbs items={[{ label: brand.name }]} className="mb-4" />

        <div className="mt-4 flex flex-col gap-4 sm:mt-6 sm:flex-row sm:items-center sm:gap-6">
          {brand.logoUrl ? (
            <span className="relative flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface p-2 sm:h-20 sm:w-36">
              <Image src={brand.logoUrl} alt={brand.name} fill sizes="144px" className="object-contain p-2" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="text-h1 text-text">{brand.name}</h1>
            <p className="tnum mt-1 text-small text-text-muted">{products.length} პროდუქტი</p>
            {brand.description ? <p className="mt-2 max-w-2xl text-small text-text-muted">{brand.description}</p> : null}
          </div>
        </div>

        <div
          ref={listRef}
          className="mt-6 scroll-mt-28 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3 sm:scroll-mt-32"
        >
          <SortSelect value={sort} onChange={(value) => { setSort(value); setPage(1); }} />
          <ViewToggle value={view} onChange={setView} />
        </div>

        {pageItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <PackageSearch className="size-10 text-text-faint" strokeWidth={1.5} />
            <p className="text-body text-text-muted">ამ ბრენდზე პროდუქტები ჯერ არ არის.</p>
          </div>
        ) : view === "grid" ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {pageItems.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {pageItems.map((product) => (
              <ProductListItem key={product.id} product={product} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-8">
            <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
          </div>
        ) : null}
      </Container>
    </div>
  );
}
