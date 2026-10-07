import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Product } from "@/types/product";
import {
  emptyFilters,
  getFacetBrands,
  getFacetCategories,
  type CategoryFilterState,
} from "./filters";

function product(partial: Partial<Product> & Pick<Product, "id" | "brand" | "category">): Product {
  return {
    visual: "accessory",
    tone: 1,
    rating: 0,
    reviewCount: 0,
    price: 100,
    availability: "in-stock",
    ...partial,
    slug: partial.slug ?? partial.id,
    name: partial.name ?? partial.id,
    categoryName: partial.categoryName ?? partial.category,
  };
}

describe("faceted filters", () => {
  const catalog: Product[] = [
    product({ id: "c1", brand: "Deepcool", category: "coolers", categoryName: "ქულერი" }),
    product({ id: "c2", brand: "Noctua", category: "coolers", categoryName: "ქულერი" }),
    product({ id: "p1", brand: "Samsung", category: "phones", categoryName: "ტელეფონები" }),
    product({ id: "p2", brand: "Lenovo", category: "laptops", categoryName: "ლეპტოპები" }),
  ];

  it("narrows brands to the selected category facet", () => {
    const filters: CategoryFilterState = { ...emptyFilters, categories: ["coolers"] };
    const brands = getFacetBrands(catalog, filters).map((row) => row.value);
    assert.deepEqual(brands.sort(), ["Deepcool", "Noctua"]);
    assert.ok(!brands.includes("Samsung"));
    assert.ok(!brands.includes("Lenovo"));
  });

  it("keeps a selected brand visible even when other facets would hide it", () => {
    const filters: CategoryFilterState = {
      ...emptyFilters,
      categories: ["coolers"],
      brands: ["Samsung"],
    };
    const brands = getFacetBrands(catalog, filters);
    const samsung = brands.find((row) => row.value === "Samsung");
    assert.ok(samsung);
    assert.equal(samsung!.count, 0);
  });

  it("counts category options against other active filters", () => {
    const filters: CategoryFilterState = { ...emptyFilters, brands: ["Deepcool"] };
    const categories = getFacetCategories(catalog, filters);
    assert.equal(categories.length, 1);
    assert.equal(categories[0]?.value, "coolers");
    assert.equal(categories[0]?.count, 1);
  });
});
