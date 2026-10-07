import type { Product, ProductAvailability } from "@/types/product";

/**
 * Pure filter/sort logic shared by the category page, the search results
 * page, and their sidebars — kept free of React so it's trivial to unit
 * test and reuse anywhere, since every option below is derived from
 * whatever product list is passed in rather than hardcoded per page.
 */
export interface CategoryFilterState {
  /** Only meaningful on pages spanning multiple categories (e.g. search results) — a single-category page will simply never show this facet. */
  categories: string[];
  brands: string[];
  storage: string[];
  ram: string[];
  availability: ProductAvailability[];
  priceMin: number | null;
  priceMax: number | null;
}

export const emptyFilters: CategoryFilterState = {
  categories: [],
  brands: [],
  storage: [],
  ram: [],
  availability: [],
  priceMin: null,
  priceMax: null,
};

export type SortKey = "popularity" | "newest" | "price-asc" | "price-desc";

export const sortOptions: { value: SortKey; label: string }[] = [
  { value: "popularity", label: "პოპულარობით" },
  { value: "newest", label: "ახალი დამატებული" },
  { value: "price-asc", label: "ფასი: იაფიდან ძვირისკენ" },
  { value: "price-desc", label: "ფასი: ძვირიდან იაფისკენ" },
];

export type FacetKey = "categories" | "brands" | "storage" | "ram" | "availability" | "price";

/** Apply every filter except one facet — used to derive dynamic facet options/counts. */
export function filtersOmitting(filters: CategoryFilterState, facet: FacetKey): CategoryFilterState {
  switch (facet) {
    case "categories":
      return { ...filters, categories: [] };
    case "brands":
      return { ...filters, brands: [] };
    case "storage":
      return { ...filters, storage: [] };
    case "ram":
      return { ...filters, ram: [] };
    case "availability":
      return { ...filters, availability: [] };
    case "price":
      return { ...filters, priceMin: null, priceMax: null };
  }
}

export function getPriceBounds(products: Product[]): { min: number; max: number } {
  if (products.length === 0) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const p of products) {
    if (p.price < min) min = p.price;
    if (p.price > max) max = p.price;
  }
  return { min: Math.floor(min), max: Math.ceil(max) };
}

function parseLeadingNumber(value: string): number {
  const match = value.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

export function categoryLabelsFromProducts(products: Product[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const product of products) {
    if (product.categoryName) labels[product.category] = product.categoryName;
  }
  return labels;
}

export function getUniqueCategories(products: Product[]): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  const labels = categoryLabelsFromProducts(products);
  for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({
      value,
      label: labels[value] ?? value,
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function getUniqueBrands(products: Product[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.brand, (counts.get(p.brand) ?? 0) + 1);
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function getUniqueSpecValues(
  products: Product[],
  key: "storage" | "ram",
): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of products) {
    const value = p[key];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => parseLeadingNumber(a.value) - parseLeadingNumber(b.value));
}

export function getUniqueAvailability(products: Product[]): { value: ProductAvailability; count: number }[] {
  const counts = new Map<ProductAvailability, number>();
  for (const p of products) counts.set(p.availability, (counts.get(p.availability) ?? 0) + 1);
  const order: ProductAvailability[] = ["in-stock", "low-stock", "out-of-stock"];
  return order
    .filter((value) => (counts.get(value) ?? 0) > 0)
    .map((value) => ({ value, count: counts.get(value) ?? 0 }));
}

/**
 * Facet options for one dimension, counted against the current selection with
 * that facet cleared. Zero-count options are hidden unless already selected.
 */
export function getFacetCategories(
  products: Product[],
  filters: CategoryFilterState,
): { value: string; label: string; count: number }[] {
  const base = applyFilters(products, filtersOmitting(filters, "categories"));
  const labels = categoryLabelsFromProducts(products);
  const options = getUniqueCategories(base);
  const byValue = new Map(options.map((row) => [row.value, row]));
  for (const selected of filters.categories) {
    if (!byValue.has(selected)) {
      byValue.set(selected, { value: selected, label: labels[selected] ?? selected, count: 0 });
    }
  }
  return [...byValue.values()]
    .filter((row) => row.count > 0 || filters.categories.includes(row.value))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function getFacetBrands(
  products: Product[],
  filters: CategoryFilterState,
): { value: string; count: number }[] {
  const base = applyFilters(products, filtersOmitting(filters, "brands"));
  const options = getUniqueBrands(base);
  const byValue = new Map(options.map((row) => [row.value, row]));
  for (const selected of filters.brands) {
    if (!byValue.has(selected)) byValue.set(selected, { value: selected, count: 0 });
  }
  return [...byValue.values()]
    .filter((row) => row.count > 0 || filters.brands.includes(row.value))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

export function getFacetSpecValues(
  products: Product[],
  filters: CategoryFilterState,
  key: "storage" | "ram",
): { value: string; count: number }[] {
  const selected = key === "storage" ? filters.storage : filters.ram;
  const base = applyFilters(products, filtersOmitting(filters, key));
  const options = getUniqueSpecValues(base, key);
  const byValue = new Map(options.map((row) => [row.value, row]));
  for (const value of selected) {
    if (!byValue.has(value)) byValue.set(value, { value, count: 0 });
  }
  return [...byValue.values()]
    .filter((row) => row.count > 0 || selected.includes(row.value))
    .sort((a, b) => parseLeadingNumber(a.value) - parseLeadingNumber(b.value));
}

export function getFacetAvailability(
  products: Product[],
  filters: CategoryFilterState,
): { value: ProductAvailability; count: number }[] {
  const base = applyFilters(products, filtersOmitting(filters, "availability"));
  const options = getUniqueAvailability(base);
  const byValue = new Map(options.map((row) => [row.value, row]));
  for (const selected of filters.availability) {
    if (!byValue.has(selected)) byValue.set(selected, { value: selected, count: 0 });
  }
  const order: ProductAvailability[] = ["in-stock", "low-stock", "out-of-stock"];
  return order
    .map((value) => byValue.get(value))
    .filter((row): row is { value: ProductAvailability; count: number } => Boolean(row))
    .filter((row) => row.count > 0 || filters.availability.includes(row.value));
}

export function getFacetPriceBounds(products: Product[], filters: CategoryFilterState): { min: number; max: number } {
  return getPriceBounds(applyFilters(products, filtersOmitting(filters, "price")));
}

export function applyFilters(products: Product[], filters: CategoryFilterState): Product[] {
  return products.filter((p) => {
    if (filters.categories.length && !filters.categories.includes(p.category)) return false;
    if (filters.brands.length && !filters.brands.includes(p.brand)) return false;
    if (filters.storage.length && (!p.storage || !filters.storage.includes(p.storage))) return false;
    if (filters.ram.length && (!p.ram || !filters.ram.includes(p.ram))) return false;
    if (filters.availability.length && !filters.availability.includes(p.availability)) return false;
    if (filters.priceMin != null && p.price < filters.priceMin) return false;
    if (filters.priceMax != null && p.price > filters.priceMax) return false;
    return true;
  });
}

function popularityScore(product: Product): number {
  return Number(product.isNew) * 100 + (product.badge ? 50 : 0) + (product.previousPrice ? 10 : 0);
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  const list = [...products];
  switch (sort) {
    case "price-asc":
      return list.sort((a, b) => a.price - b.price);
    case "price-desc":
      return list.sort((a, b) => b.price - a.price);
    case "newest":
      return list.sort((a, b) => Number(b.isNew) - Number(a.isNew));
    case "popularity":
    default:
      return list.sort((a, b) => popularityScore(b) - popularityScore(a) || a.name.localeCompare(b.name, "ka"));
  }
}

export function countActiveFilters(filters: CategoryFilterState): number {
  return (
    filters.categories.length +
    filters.brands.length +
    filters.storage.length +
    filters.ram.length +
    filters.availability.length +
    (filters.priceMin != null ? 1 : 0) +
    (filters.priceMax != null ? 1 : 0)
  );
}

/** Stable key for scroll-on-filter triggers. */
export function filtersRevision(filters: CategoryFilterState): string {
  return [
    filters.categories.slice().sort().join(","),
    filters.brands.slice().sort().join(","),
    filters.storage.slice().sort().join(","),
    filters.ram.slice().sort().join(","),
    filters.availability.slice().sort().join(","),
    filters.priceMin ?? "",
    filters.priceMax ?? "",
  ].join("|");
}
