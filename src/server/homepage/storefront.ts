import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import type { Product } from "@/types/product";
import { prisma } from "@/server/db";
import { pickTranslation } from "@/server/locale";
import { storefrontProductWhere } from "@/server/catalog/visibility";
import { productListInclude } from "@/server/catalog/include";
import { mapProductList } from "@/server/catalog/mappers";
import { toStorefrontProduct } from "@/server/catalog/toStorefrontProduct";
import { getProductsByIds } from "@/server/catalog/products";
import { getStorefrontHeroSlides, type StorefrontHeroSlide } from "@/server/catalog/hero";
import { STOREFRONT_HOMEPAGE_CACHE_TAG } from "@/server/catalog/merchTags";
import { resolveHomepageLink } from "@/lib/homepage/resolveLink";
import { parseCategoryReelConfig, type HomepageCategoryReelConfig, type HomepageProductSource } from "@/lib/homepage/types";

export type HomepageBannerDTO = {
  id: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  alt: string;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  href: string | null;
  openInNewTab: boolean;
};

export type HomepageVisualTileDTO = {
  id: string;
  slot: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  href: string | null;
};

export type HomepageSectionDTO =
  | { type: "HERO"; id: string; slides: StorefrontHeroSlide[] }
  | { type: "SPLIT_BANNERS"; id: string; banners: HomepageBannerDTO[] }
  | { type: "BRAND_REEL"; id: string; title: string | null; brands: { id: string; slug: string; name: string; logoUrl: string | null; href: string }[] }
  | { type: "CATEGORY_PRODUCT_REEL"; id: string; title: string | null; href: string | null; products: Product[] }
  | { type: "FEATURE_BANNER"; id: string; banner: HomepageBannerDTO }
  | { type: "VISUAL_CATEGORIES"; id: string; title: string | null; tiles: HomepageVisualTileDTO[] };

async function categoryTreeIds(categoryId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE tree AS (
      SELECT id FROM "Category" WHERE id = ${categoryId}
      UNION ALL
      SELECT c.id FROM "Category" c INNER JOIN tree t ON c."parentId" = t.id
    )
    SELECT id FROM tree
  `;
  return rows.map((row) => row.id);
}

function orderByForSource(source: HomepageProductSource): Prisma.ProductOrderByWithRelationInput[] {
  switch (source) {
    case "POPULAR":
      return [{ reviewCount: "desc" }, { isFeatured: "desc" }, { createdAt: "desc" }];
    case "NEWEST":
      return [{ createdAt: "desc" }];
    case "MANUAL":
    case "AUTOMATIC":
    default:
      return [{ isFeatured: "desc" }, { createdAt: "desc" }];
  }
}

async function loadCategoryReelProducts(
  config: HomepageCategoryReelConfig,
  manualProductIds: string[],
): Promise<Product[]> {
  if (config.productSource === "MANUAL") {
    if (manualProductIds.length === 0) return [];
    const products = await getProductsByIds(manualProductIds);
    const byId = new Map(products.map((product) => [product.id, product]));
    return manualProductIds
      .map((id) => byId.get(id))
      .filter((product): product is NonNullable<typeof product> => Boolean(product))
      .map(toStorefrontProduct);
  }

  if (!config.categoryId) return [];
  const ids = await categoryTreeIds(config.categoryId);
  if (ids.length === 0) return [];

  const products = await prisma.product.findMany({
    where: storefrontProductWhere({ categoryId: { in: ids } }),
    include: productListInclude,
    orderBy: orderByForSource(config.productSource),
    take: config.limit,
  });
  return products.map((product) => toStorefrontProduct(mapProductList(product)));
}

function toBannerDTO(row: {
  id: string;
  imageUrl: string | null;
  mobileImageUrl: string | null;
  alt: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  linkType: Parameters<typeof resolveHomepageLink>[0]["linkType"];
  href: string | null;
  openInNewTab: boolean;
  category: { slug: string } | null;
  product: { slug: string } | null;
  brand: { slug: string } | null;
}): HomepageBannerDTO | null {
  if (!row.imageUrl) return null;
  const resolvedHref = resolveHomepageLink({
    linkType: row.linkType,
    href: row.href,
    categorySlug: row.category?.slug ?? null,
    productSlug: row.product?.slug ?? null,
    brandSlug: row.brand?.slug ?? null,
  });
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    mobileImageUrl: row.mobileImageUrl,
    alt: row.alt ?? "",
    title: row.title,
    subtitle: row.subtitle,
    ctaText: row.ctaText,
    href: resolvedHref,
    openInNewTab: row.openInNewTab,
  };
}

async function hydrateSection(section: {
  id: string;
  type: string;
  title: string | null;
  config: Prisma.JsonValue;
}): Promise<HomepageSectionDTO | null> {
  switch (section.type) {
    case "HERO": {
      const slides = await getStorefrontHeroSlides();
      if (slides.length === 0) return null;
      return { type: "HERO", id: section.id, slides };
    }

    case "SPLIT_BANNERS": {
      const rows = await prisma.homepageBanner.findMany({
        where: { sectionId: section.id, enabled: true },
        orderBy: { sortOrder: "asc" },
        include: {
          category: { select: { slug: true } },
          product: { select: { slug: true } },
          brand: { select: { slug: true } },
        },
      });
      const banners = rows.map(toBannerDTO).filter((row): row is HomepageBannerDTO => Boolean(row));
      if (banners.length === 0) return null;
      return { type: "SPLIT_BANNERS", id: section.id, banners };
    }

    case "FEATURE_BANNER": {
      const row = await prisma.homepageBanner.findFirst({
        where: { sectionId: section.id, enabled: true },
        include: {
          category: { select: { slug: true } },
          product: { select: { slug: true } },
          brand: { select: { slug: true } },
        },
      });
      const banner = row ? toBannerDTO(row) : null;
      if (!banner) return null;
      return { type: "FEATURE_BANNER", id: section.id, banner };
    }

    case "BRAND_REEL": {
      const items = await prisma.homepageBrandItem.findMany({
        where: { sectionId: section.id },
        orderBy: { sortOrder: "asc" },
        include: { brand: { include: { translations: true } } },
      });
      if (items.length === 0) return null;
      return {
        type: "BRAND_REEL",
        id: section.id,
        title: section.title,
        brands: items.map((item) => ({
          id: item.brand.id,
          slug: item.brand.slug,
          name: pickTranslation(item.brand.translations).name,
          logoUrl: item.brand.logoUrl,
          href: `/brand/${item.brand.slug}`,
        })),
      };
    }

    case "CATEGORY_PRODUCT_REEL": {
      const config = parseCategoryReelConfig(section.config);
      const manualItems =
        config.productSource === "MANUAL"
          ? await prisma.homepageProductItem.findMany({
              where: { sectionId: section.id },
              orderBy: { sortOrder: "asc" },
              select: { productId: true },
            })
          : [];
      const products = await loadCategoryReelProducts(
        config,
        manualItems.map((row) => row.productId),
      );
      if (products.length === 0) return null;
      let href = config.viewAllHref ?? null;
      if (!href && config.categoryId) {
        const category = await prisma.category.findUnique({ where: { id: config.categoryId }, select: { slug: true } });
        href = category ? `/category/${category.slug}` : null;
      }
      return { type: "CATEGORY_PRODUCT_REEL", id: section.id, title: section.title, href, products };
    }

    case "VISUAL_CATEGORIES": {
      const rows = await prisma.homepageVisualTile.findMany({
        where: { sectionId: section.id, enabled: true },
        orderBy: { sortOrder: "asc" },
        include: { category: { select: { slug: true } } },
      });
      const tiles = rows
        .filter((row) => Boolean(row.imageUrl))
        .map((row) => ({
          id: row.id,
          slot: row.slot,
          imageUrl: row.imageUrl as string,
          mobileImageUrl: row.mobileImageUrl,
          title: row.title,
          subtitle: row.subtitle,
          href: resolveHomepageLink({
            linkType: row.linkType,
            href: row.href,
            categorySlug: row.category?.slug ?? null,
          }),
        }));
      if (tiles.length === 0) return null;
      return { type: "VISUAL_CATEGORIES", id: section.id, title: section.title, tiles };
    }

    default:
      return null;
  }
}

const loadHomepageSections = unstable_cache(
  async (): Promise<HomepageSectionDTO[]> => {
    const sections = await prisma.homepageSection.findMany({
      where: { enabled: true },
      orderBy: { position: "asc" },
      select: { id: true, type: true, title: true, config: true },
    });
    const hydrated = await Promise.all(sections.map((section) => hydrateSection(section)));
    return hydrated.filter((row): row is HomepageSectionDTO => row !== null);
  },
  ["storefront-homepage-sections"],
  { revalidate: 120, tags: [STOREFRONT_HOMEPAGE_CACHE_TAG] },
);

export const getHomepagePageData = cache(() => loadHomepageSections());
