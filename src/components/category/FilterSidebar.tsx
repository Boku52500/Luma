"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { Product } from "@/types/product";
import { cn } from "@/lib/utils";
import { availabilityLabel } from "@/lib/productLabels";
import {
  type CategoryFilterState,
  getFacetAvailability,
  getFacetBrands,
  getFacetCategories,
  getFacetPriceBounds,
  getFacetSpecValues,
} from "./filters";

function toggleValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="border-b border-border py-4 first:pt-0 last:border-b-0">
      <h3 className="text-label mb-2.5 font-semibold text-text">{title}</h3>
      {children}
    </div>
  );
}

function FilterCheckbox({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  count?: number;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 py-1.5 text-small text-text transition-colors duration-150">
      <span className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="size-4 shrink-0 rounded-[4px] border-border-strong accent-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        />
        {label}
      </span>
      {typeof count === "number" ? <span className="tnum text-text-faint">{count}</span> : null}
    </label>
  );
}

/**
 * Faceted filter sidebar: each section's options/counts are derived from the
 * current selection with that facet cleared, so impossible zero-count options
 * disappear while still-selected values remain visible for deselection.
 */
export function FilterSidebar({
  products,
  filters,
  onChange,
  onClear,
  showHeading = true,
  className,
}: {
  /** Full catalogue product list for this page (before client filters). */
  products: Product[];
  filters: CategoryFilterState;
  onChange: (patch: Partial<CategoryFilterState>) => void;
  onClear: () => void;
  /** Set to false when embedded in a drawer that already renders its own title. */
  showHeading?: boolean;
  className?: string;
}) {
  const categories = useMemo(() => getFacetCategories(products, filters), [products, filters]);
  const brands = useMemo(() => getFacetBrands(products, filters), [products, filters]);
  const storageOptions = useMemo(() => getFacetSpecValues(products, filters, "storage"), [products, filters]);
  const ramOptions = useMemo(() => getFacetSpecValues(products, filters, "ram"), [products, filters]);
  const availabilityOptions = useMemo(() => getFacetAvailability(products, filters), [products, filters]);
  const priceBounds = useMemo(() => getFacetPriceBounds(products, filters), [products, filters]);

  const [priceMinInput, setPriceMinInput] = useState(filters.priceMin?.toString() ?? "");
  const [priceMaxInput, setPriceMaxInput] = useState(filters.priceMax?.toString() ?? "");

  const applyPrice = () => {
    const min = priceMinInput.trim() ? Number(priceMinInput) : null;
    const max = priceMaxInput.trim() ? Number(priceMaxInput) : null;
    onChange({ priceMin: min, priceMax: max });
  };

  const showCategories = categories.length > 1 || filters.categories.length > 0;
  const showBrands = brands.length > 0;
  const showStorage = storageOptions.length > 0;
  const showRam = ramOptions.length > 0;
  const showPrice = priceBounds.max > priceBounds.min || filters.priceMin != null || filters.priceMax != null;
  const showAvailability = availabilityOptions.length > 0;

  return (
    <div className={cn("flex flex-col rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-xs", className)}>
      <div className="mb-1 flex items-center justify-between">
        {showHeading ? <h2 className="text-h3 text-text">ფილტრი</h2> : <span />}
        <button
          type="button"
          onClick={() => {
            setPriceMinInput("");
            setPriceMaxInput("");
            onClear();
          }}
          className="text-small font-medium text-brand-600 transition-colors duration-150 hover:text-brand-700"
        >
          გასუფთავება
        </button>
      </div>

      {showCategories ? (
        <FilterSection title="კატეგორია">
          {categories.map(({ value, label, count }) => (
            <FilterCheckbox
              key={value}
              label={label}
              count={count}
              checked={filters.categories.includes(value)}
              onChange={() => onChange({ categories: toggleValue(filters.categories, value) })}
            />
          ))}
        </FilterSection>
      ) : null}

      {showBrands ? (
        <FilterSection title="ბრენდი">
          {brands.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={value}
              count={count}
              checked={filters.brands.includes(value)}
              onChange={() => onChange({ brands: toggleValue(filters.brands, value) })}
            />
          ))}
        </FilterSection>
      ) : null}

      {showPrice ? (
        <FilterSection title="ფასი">
          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              placeholder={String(priceBounds.min)}
              value={priceMinInput}
              onChange={(e) => setPriceMinInput(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
              aria-label="მინიმალური ფასი, ₾"
              className="text-small tnum h-9 w-full min-w-0 rounded-[var(--radius-sm)] border border-border-strong px-2.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            />
            <span className="text-text-faint">—</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder={String(priceBounds.max)}
              value={priceMaxInput}
              onChange={(e) => setPriceMaxInput(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => e.key === "Enter" && applyPrice()}
              aria-label="მაქსიმალური ფასი, ₾"
              className="text-small tnum h-9 w-full min-w-0 rounded-[var(--radius-sm)] border border-border-strong px-2.5 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            />
            <span className="text-small shrink-0 text-text-faint">₾</span>
          </div>
        </FilterSection>
      ) : null}

      {showStorage ? (
        <FilterSection title="მეხსიერება">
          {storageOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={value}
              count={count}
              checked={filters.storage.includes(value)}
              onChange={() => onChange({ storage: toggleValue(filters.storage, value) })}
            />
          ))}
        </FilterSection>
      ) : null}

      {showRam ? (
        <FilterSection title="ოპერატიული მეხსიერება (RAM)">
          {ramOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={value}
              count={count}
              checked={filters.ram.includes(value)}
              onChange={() => onChange({ ram: toggleValue(filters.ram, value) })}
            />
          ))}
        </FilterSection>
      ) : null}

      {showAvailability ? (
        <FilterSection title="ხელმისაწვდომობა">
          {availabilityOptions.map(({ value, count }) => (
            <FilterCheckbox
              key={value}
              label={availabilityLabel[value]}
              count={count}
              checked={filters.availability.includes(value)}
              onChange={() => onChange({ availability: toggleValue(filters.availability, value) })}
            />
          ))}
        </FilterSection>
      ) : null}
    </div>
  );
}
