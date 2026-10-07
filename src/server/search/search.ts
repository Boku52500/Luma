import { unstable_cache } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import type { Category, Product } from "@/types/product";
import {
  SEARCH_MIN_QUERY_LENGTH,
  SEARCH_PAGE_LIMIT,
  SEARCH_SUGGESTION_LIMITS,
  emptySearchSuggestions,
  sanitizeSearchQuery,
  type SearchSuggestions,
} from "@/lib/search";
import { prisma } from "@/server/prisma";
import { getBrands } from "@/server/catalog/brands";
import { getCategories } from "@/server/catalog/categories";
import { productListInclude, productSuggestionInclude } from "@/server/catalog/include";
import { mapProductList } from "@/server/catalog/mappers";
import { toStorefrontCategory, toStorefrontProduct } from "@/server/catalog/toStorefrontProduct";
import type { CatalogProduct } from "@/server/catalog/types";
import { DEFAULT_LOCALE, resolveLocale, type AppLocale } from "@/server/locale";
import {
  normalizeSearchText,
  scoreBrandName,
  scoreCategoryName,
  scoreProduct,
  searchNeedles,
} from "@/server/search/match";

export type SearchProductsOptions = {
  take?: number;
  locale?: string;
  /** Lighter Prisma include for autocomplete (primary image only). */
  suggestion?: boolean;
};

function contains(needle: string) {
  return { contains: needle, mode: "insensitive" as const };
}

function productCandidateWhere(needles: string[]): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = needles.flatMap((needle) => [
    { sku: contains(needle) },
    { slug: contains(needle) },
    { storageLabel: contains(needle) },
    { ramLabel: contains(needle) },
    { translations: { some: { name: contains(needle) } } },
    { highlights: { some: { translations: { some: { text: contains(needle) } } } } },
    {
      brand: {
        OR: [{ slug: contains(needle) }, { translations: { some: { name: contains(needle) } } }],
      },
    },
    {
      category: {
        OR: [{ slug: contains(needle) }, { translations: { some: { name: contains(needle) } } }],
      },
    },
  ]);

  return { isActive: true, deletedAt: null, OR: clauses };
}

function rankCatalogProducts(products: CatalogProduct[], query: string): CatalogProduct[] {
  const q = normalizeSearchText(query);
  return products
    .map((product) => ({
      product,
      score: scoreProduct(
        {
          name: product.name,
          brand: product.brand.name,
          sku: product.sku,
          slug: product.slug,
          categoryName: product.category.name,
          storage: product.storageLabel,
          ram: product.ramLabel,
          highlights: product.highlights,
          reviewCount: product.reviewCount,
        },
        q,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.product.reviewCount - a.product.reviewCount)
    .map((entry) => entry.product);
}

const cachedCategories = unstable_cache(
  async (locale: AppLocale) => getCategories(locale),
  ["search-catalog-categories"],
  { revalidate: 300 },
);

const cachedBrands = unstable_cache(
  async (locale: AppLocale) => getBrands(locale),
  ["search-catalog-brands"],
  { revalidate: 300 },
);

function toSuggestionProduct(product: Product): Product {
  return {
    id: product.id,
    slug: product.slug,
    brand: product.brand,
    name: product.name,
    category: product.category,
    categoryName: product.categoryName,
    visual: product.visual,
    tone: product.tone,
    rating: product.rating,
    reviewCount: product.reviewCount,
    price: product.price,
    previousPrice: product.previousPrice,
    availability: product.availability,
    images: product.images,
    sku: product.sku,
    isNew: product.isNew,
    badge: product.badge,
  };
}

export async function searchProducts(
  query: string,
  options: SearchProductsOptions = {},
): Promise<Product[]> {
  const q = sanitizeSearchQuery(query);
  if (q.length < SEARCH_MIN_QUERY_LENGTH) return [];

  const needles = searchNeedles(q);
  if (needles.length === 0) return [];

  const take = Math.min(Math.max(options.take ?? SEARCH_PAGE_LIMIT, 1), SEARCH_PAGE_LIMIT);
  const locale = resolveLocale(options.locale ?? DEFAULT_LOCALE);
  const include = options.suggestion ? productSuggestionInclude : productListInclude;

  const rows = await prisma.product.findMany({
    where: productCandidateWhere(needles),
    include,
    take,
  });

  const ranked = rankCatalogProducts(
    rows.map((row) => mapProductList(row, locale)),
    q,
  );
  return ranked.map(toStorefrontProduct);
}

export async function searchCategories(query: string, locale = DEFAULT_LOCALE): Promise<Category[]> {
  const q = sanitizeSearchQuery(query);
  if (q.length < SEARCH_MIN_QUERY_LENGTH) return [];

  const normalized = normalizeSearchText(q);
  const categories = await cachedCategories(locale);

  return categories
    .map((category) => ({ category, score: scoreCategoryName(category.name, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => toStorefrontCategory(entry.category, 0));
}

export async function searchBrands(query: string, locale = DEFAULT_LOCALE): Promise<string[]> {
  const q = sanitizeSearchQuery(query);
  if (q.length < SEARCH_MIN_QUERY_LENGTH) return [];

  const normalized = normalizeSearchText(q);
  const brands = await cachedBrands(locale);

  return brands
    .map((brand) => ({ brand: brand.name, score: scoreBrandName(brand.name, normalized) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.brand);
}

export async function getSearchSuggestions(
  query: string,
  limits: { products?: number; categories?: number; brands?: number } = {},
): Promise<SearchSuggestions> {
  const q = sanitizeSearchQuery(query);
  if (q.length < SEARCH_MIN_QUERY_LENGTH) return emptySearchSuggestions;

  const productLimit = Math.min(limits.products ?? SEARCH_SUGGESTION_LIMITS.products, 8);
  const categoryLimit = Math.min(limits.categories ?? SEARCH_SUGGESTION_LIMITS.categories, 6);
  const brandLimit = Math.min(limits.brands ?? SEARCH_SUGGESTION_LIMITS.brands, 6);

  const [products, categories, brands] = await Promise.all([
    searchProducts(q, { take: Math.max(12, productLimit * 3), suggestion: true }),
    searchCategories(q),
    searchBrands(q),
  ]);

  return {
    products: products.slice(0, productLimit).map(toSuggestionProduct),
    productsTotal: products.length,
    categories: categories.slice(0, categoryLimit),
    brands: brands.slice(0, brandLimit),
  };
}
