import "server-only";

import type { HomepageLinkType, HomepageSectionType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { pickTranslation } from "@/server/locale";
import { deleteProductImageObject, isManagedMerchImageKey } from "@/server/storage";
import { logError } from "@/server/log";
import {
  HOMEPAGE_PRODUCT_SOURCE_LABELS,
  HOMEPAGE_SECTION_KEYS,
  HOMEPAGE_SECTION_TYPE_LABELS,
  HOMEPAGE_VISUAL_TILE_SLOTS,
  parseCategoryReelConfig,
  type HomepageCategoryReelConfig,
  type HomepageVisualTileSlot,
} from "@/lib/homepage/types";

// ---------------------------------------------------------------------------
// Shared row types
// ---------------------------------------------------------------------------

export type AdminHomepageSectionRow = {
  id: string;
  key: string;
  type: HomepageSectionType;
  position: number;
  adminLabel: string;
  title: string | null;
  enabled: boolean;
  typeLabel: string;
  summary: string;
};

export type AdminHomepageSectionMeta = {
  id: string;
  key: string;
  type: HomepageSectionType;
  position: number;
  adminLabel: string;
  title: string;
  enabled: boolean;
};

export type AdminHomepageBannerRow = {
  id: string;
  slot: "A" | "B" | null;
  imageUrl: string;
  objectKey: string | null;
  mobileImageUrl: string;
  mobileObjectKey: string | null;
  alt: string;
  title: string;
  subtitle: string;
  ctaText: string;
  linkType: HomepageLinkType;
  href: string;
  categoryId: string;
  categoryLabel: string;
  productId: string;
  productLabel: string;
  brandId: string;
  brandLabel: string;
  openInNewTab: boolean;
  enabled: boolean;
  sortOrder: number;
};

export type AdminHomepageTileRow = {
  id: string | null;
  slot: HomepageVisualTileSlot;
  imageUrl: string;
  objectKey: string | null;
  mobileImageUrl: string;
  mobileObjectKey: string | null;
  title: string;
  subtitle: string;
  linkType: HomepageLinkType;
  href: string;
  categoryId: string;
  categoryLabel: string;
  enabled: boolean;
};

export type AdminHomepageOption = { id: string; label: string; slug: string };
export type AdminHomepageProductOption = AdminHomepageOption & { sku: string; imageUrl: string | null };

// ---------------------------------------------------------------------------
// List + summaries
// ---------------------------------------------------------------------------

function emptyBannerRow(slot: "A" | "B" | null, sortOrder: number): AdminHomepageBannerRow {
  return {
    id: "",
    slot,
    imageUrl: "",
    objectKey: null,
    mobileImageUrl: "",
    mobileObjectKey: null,
    alt: "",
    title: "",
    subtitle: "",
    ctaText: "",
    linkType: "NONE",
    href: "",
    categoryId: "",
    categoryLabel: "",
    productId: "",
    productLabel: "",
    brandId: "",
    brandLabel: "",
    openInNewTab: false,
    enabled: true,
    sortOrder,
  };
}

export async function listAdminHomepageSections(): Promise<AdminHomepageSectionRow[]> {
  const [sections, heroSlideCount, categories] = await Promise.all([
    prisma.homepageSection.findMany({
      orderBy: { position: "asc" },
      include: {
        banners: { select: { imageUrl: true } },
        tiles: { select: { imageUrl: true } },
        _count: { select: { brandItems: true, products: true } },
      },
    }),
    prisma.heroSlide.count(),
    prisma.category.findMany({ select: { id: true, translations: { where: { locale: "ka" } } } }),
  ]);
  const categoryNameById = new Map(categories.map((row) => [row.id, row.translations[0]?.name ?? ""]));

  return sections.map((section) => {
    let summary = "";
    switch (section.type) {
      case "HERO":
        summary = `${heroSlideCount} სლაიდი`;
        break;
      case "SPLIT_BANNERS": {
        const filled = section.banners.filter((row) => Boolean(row.imageUrl)).length;
        summary = `${filled}/2 ბანერი შევსებული`;
        break;
      }
      case "FEATURE_BANNER": {
        const filled = section.banners.some((row) => Boolean(row.imageUrl));
        summary = filled ? "ბანერი შევსებულია" : "ბანერი ცარიელია";
        break;
      }
      case "BRAND_REEL":
        summary = `${section._count.brandItems} ბრენდი`;
        break;
      case "CATEGORY_PRODUCT_REEL": {
        const config = parseCategoryReelConfig(section.config);
        const categoryName = config.categoryId ? categoryNameById.get(config.categoryId) ?? null : null;
        summary = `${categoryName ?? "კატეგორია არ არის არჩეული"} · ${HOMEPAGE_PRODUCT_SOURCE_LABELS[config.productSource]}`;
        break;
      }
      case "VISUAL_CATEGORIES": {
        const filled = section.tiles.filter((row) => Boolean(row.imageUrl)).length;
        summary = `${filled}/5 ფილა შევსებული`;
        break;
      }
      default:
        summary = "";
    }
    return {
      id: section.id,
      key: section.key,
      type: section.type,
      position: section.position,
      adminLabel: section.adminLabel,
      title: section.title,
      enabled: section.enabled,
      typeLabel: HOMEPAGE_SECTION_TYPE_LABELS[section.type],
      summary,
    };
  });
}

export async function getAdminHomepageSectionMeta(id: string): Promise<AdminHomepageSectionMeta | null> {
  const section = await prisma.homepageSection.findUnique({ where: { id } });
  if (!section) return null;
  return {
    id: section.id,
    key: section.key,
    type: section.type,
    position: section.position,
    adminLabel: section.adminLabel,
    title: section.title ?? "",
    enabled: section.enabled,
  };
}

// ---------------------------------------------------------------------------
// Lookups (category / brand / product pickers)
// ---------------------------------------------------------------------------

export async function listHomepageCategoryOptions(): Promise<AdminHomepageOption[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    include: { translations: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });
  return categories.map((category) => ({
    id: category.id,
    slug: category.slug,
    label: pickTranslation(category.translations).name,
  }));
}

export async function listHomepageBrandOptions(): Promise<AdminHomepageOption[]> {
  const brands = await prisma.brand.findMany({
    include: { translations: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });
  return brands.map((brand) => ({
    id: brand.id,
    slug: brand.slug,
    label: pickTranslation(brand.translations).name,
  }));
}

export async function searchHomepageProducts(query: string, limit = 20): Promise<AdminHomepageProductOption[]> {
  const q = query.trim();
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      ...(q
        ? {
            OR: [
              { sku: { contains: q, mode: "insensitive" } },
              { slug: { contains: q, mode: "insensitive" } },
              { translations: { some: { locale: "ka", name: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: {
      translations: { where: { locale: "ka" } },
      images: { orderBy: { sortOrder: "asc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return products.map((product) => ({
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    label: product.translations[0]?.name ?? product.sku,
    imageUrl: product.images[0]?.url ?? null,
  }));
}

export async function getProductLabelsByIds(ids: string[]): Promise<AdminHomepageProductOption[]> {
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { translations: { where: { locale: "ka" } }, images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  const byId = new Map<string, AdminHomepageProductOption>(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        slug: product.slug,
        sku: product.sku,
        label: product.translations[0]?.name ?? product.sku,
        imageUrl: product.images[0]?.url ?? null,
      },
    ]),
  );
  return ids.map((id) => byId.get(id)).filter((row): row is AdminHomepageProductOption => Boolean(row));
}

// ---------------------------------------------------------------------------
// Reordering + enable/disable + title
// ---------------------------------------------------------------------------

export async function moveHomepageSectionData(
  id: string,
  direction: "up" | "down",
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sections = await prisma.homepageSection.findMany({
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  });
  const index = sections.findIndex((row) => row.id === id);
  if (index === -1) return { ok: false, message: "სექცია ვერ მოიძებნა" };

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= sections.length) return { ok: true };

  const current = sections[index]!;
  const neighbor = sections[swapIndex]!;
  await prisma.$transaction([
    prisma.homepageSection.update({ where: { id: current.id }, data: { position: neighbor.position } }),
    prisma.homepageSection.update({ where: { id: neighbor.id }, data: { position: current.position } }),
  ]);
  return { ok: true };
}

export async function setHomepageSectionEnabledData(id: string, enabled: boolean): Promise<boolean> {
  const section = await prisma.homepageSection.findUnique({ where: { id }, select: { id: true } });
  if (!section) return false;
  await prisma.homepageSection.update({ where: { id }, data: { enabled } });
  return true;
}

export async function saveHomepageSectionMetaData(id: string, title: string): Promise<boolean> {
  const section = await prisma.homepageSection.findUnique({ where: { id }, select: { id: true } });
  if (!section) return false;
  await prisma.homepageSection.update({ where: { id }, data: { title: title.trim() || null } });
  return true;
}

// ---------------------------------------------------------------------------
// SPLIT_BANNERS + FEATURE_BANNER
// ---------------------------------------------------------------------------

function kaName(translations: { locale: string; name: string }[] | undefined): string {
  if (!translations || translations.length === 0) return "";
  return translations.find((row) => row.locale === "ka")?.name ?? translations[0]?.name ?? "";
}

function toAdminBannerRow(row: {
  id: string;
  slot: string | null;
  imageUrl: string | null;
  objectKey: string | null;
  mobileImageUrl: string | null;
  mobileObjectKey: string | null;
  alt: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  linkType: HomepageLinkType;
  href: string | null;
  categoryId: string | null;
  category: { translations: { locale: string; name: string }[] } | null;
  productId: string | null;
  product: { translations: { locale: string; name: string }[] } | null;
  brandId: string | null;
  brand: { translations: { locale: string; name: string }[] } | null;
  openInNewTab: boolean;
  enabled: boolean;
  sortOrder: number;
}): AdminHomepageBannerRow {
  return {
    id: row.id,
    slot: row.slot === "A" || row.slot === "B" ? row.slot : null,
    imageUrl: row.imageUrl ?? "",
    objectKey: row.objectKey,
    mobileImageUrl: row.mobileImageUrl ?? "",
    mobileObjectKey: row.mobileObjectKey,
    alt: row.alt ?? "",
    title: row.title ?? "",
    subtitle: row.subtitle ?? "",
    ctaText: row.ctaText ?? "",
    linkType: row.linkType,
    href: row.href ?? "",
    categoryId: row.categoryId ?? "",
    categoryLabel: kaName(row.category?.translations),
    productId: row.productId ?? "",
    productLabel: kaName(row.product?.translations),
    brandId: row.brandId ?? "",
    brandLabel: kaName(row.brand?.translations),
    openInNewTab: row.openInNewTab,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

const bannerRelationInclude = {
  category: { include: { translations: true } },
  product: { include: { translations: true } },
  brand: { include: { translations: true } },
} satisfies Prisma.HomepageBannerInclude;

export async function getAdminSplitBannersSection(
  sectionId: string,
): Promise<{ meta: AdminHomepageSectionMeta; banners: [AdminHomepageBannerRow, AdminHomepageBannerRow] } | null> {
  const meta = await getAdminHomepageSectionMeta(sectionId);
  if (!meta) return null;
  const rows = await prisma.homepageBanner.findMany({
    where: { sectionId },
    include: bannerRelationInclude,
    orderBy: { sortOrder: "asc" },
  });
  const slotA = rows.find((row) => row.slot === "A");
  const slotB = rows.find((row) => row.slot === "B");
  return {
    meta,
    banners: [
      slotA ? toAdminBannerRow(slotA) : emptyBannerRow("A", 0),
      slotB ? toAdminBannerRow(slotB) : emptyBannerRow("B", 1),
    ],
  };
}

export async function getAdminFeatureBannerSection(
  sectionId: string,
): Promise<{ meta: AdminHomepageSectionMeta; banner: AdminHomepageBannerRow } | null> {
  const meta = await getAdminHomepageSectionMeta(sectionId);
  if (!meta) return null;
  const row = await prisma.homepageBanner.findFirst({
    where: { sectionId },
    include: bannerRelationInclude,
  });
  return { meta, banner: row ? toAdminBannerRow(row) : emptyBannerRow(null, 0) };
}

type BannerSaveInput = {
  id?: string;
  slot?: "A" | "B" | null;
  imageUrl: string | null;
  objectKey: string | null;
  mobileImageUrl: string | null;
  mobileObjectKey: string | null;
  alt: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  linkType: HomepageLinkType;
  href: string | null;
  categoryId: string | null;
  productId: string | null;
  brandId: string | null;
  openInNewTab: boolean;
  enabled: boolean;
};

async function cleanupStaleObjectKeys(stale: (string | null)[], fresh: (string | null)[]): Promise<void> {
  const freshSet = new Set(fresh.filter((key): key is string => Boolean(key)));
  for (const key of stale) {
    if (!key || freshSet.has(key)) continue;
    if (!isManagedMerchImageKey(key)) continue;
    try {
      await deleteProductImageObject(key);
    } catch (error) {
      logError("homepage.r2_cleanup_failed", { error, key });
    }
  }
}

async function upsertBannerRow(
  tx: Prisma.TransactionClient,
  sectionId: string,
  slot: "A" | "B" | null,
  input: BannerSaveInput,
): Promise<{ objectKey: string | null; mobileObjectKey: string | null }> {
  const existing = input.id
    ? await tx.homepageBanner.findFirst({ where: { id: input.id, sectionId } })
    : await tx.homepageBanner.findFirst({ where: { sectionId, slot } });

  const data = {
    imageUrl: input.imageUrl,
    objectKey: input.objectKey,
    mobileImageUrl: input.mobileImageUrl,
    mobileObjectKey: input.mobileObjectKey,
    alt: input.alt,
    title: input.title,
    subtitle: input.subtitle,
    ctaText: input.ctaText,
    linkType: input.linkType,
    href: input.href,
    categoryId: input.linkType === "CATEGORY" ? input.categoryId : null,
    productId: input.linkType === "PRODUCT" ? input.productId : null,
    brandId: input.linkType === "BRAND" ? input.brandId : null,
    openInNewTab: input.openInNewTab,
    enabled: input.enabled,
  };

  if (existing) {
    await tx.homepageBanner.update({ where: { id: existing.id }, data });
    await cleanupStaleObjectKeys([existing.objectKey], [input.objectKey]);
    await cleanupStaleObjectKeys([existing.mobileObjectKey], [input.mobileObjectKey]);
    return { objectKey: existing.objectKey, mobileObjectKey: existing.mobileObjectKey };
  }

  await tx.homepageBanner.create({
    data: { ...data, sectionId, slot, sortOrder: slot === "B" ? 1 : 0 },
  });
  return { objectKey: null, mobileObjectKey: null };
}

export async function saveHomepageSplitBannersData(
  sectionId: string,
  banners: BannerSaveInput[],
): Promise<boolean> {
  const section = await prisma.homepageSection.findUnique({ where: { id: sectionId }, select: { id: true } });
  if (!section) return false;

  await prisma.$transaction(async (tx) => {
    for (const banner of banners) {
      await upsertBannerRow(tx, sectionId, banner.slot ?? null, banner);
    }
  });
  return true;
}

export async function saveHomepageFeatureBannerData(
  sectionId: string,
  banner: BannerSaveInput,
): Promise<boolean> {
  const section = await prisma.homepageSection.findUnique({ where: { id: sectionId }, select: { id: true } });
  if (!section) return false;

  await prisma.$transaction(async (tx) => {
    await upsertBannerRow(tx, sectionId, null, banner);
  });
  return true;
}

// ---------------------------------------------------------------------------
// BRAND_REEL
// ---------------------------------------------------------------------------

export async function getAdminBrandReelSection(
  sectionId: string,
): Promise<{ meta: AdminHomepageSectionMeta; brandIds: string[] } | null> {
  const meta = await getAdminHomepageSectionMeta(sectionId);
  if (!meta) return null;
  const items = await prisma.homepageBrandItem.findMany({
    where: { sectionId },
    orderBy: { sortOrder: "asc" },
    select: { brandId: true },
  });
  return { meta, brandIds: items.map((row) => row.brandId) };
}

export async function saveHomepageBrandReelData(sectionId: string, brandIds: string[]): Promise<boolean> {
  const section = await prisma.homepageSection.findUnique({ where: { id: sectionId }, select: { id: true } });
  if (!section) return false;

  const unique = [...new Set(brandIds)];
  await prisma.$transaction(async (tx) => {
    await tx.homepageBrandItem.deleteMany({ where: { sectionId } });
    if (unique.length > 0) {
      await tx.homepageBrandItem.createMany({
        data: unique.map((brandId, index) => ({ sectionId, brandId, sortOrder: index })),
      });
    }
  });
  return true;
}

// ---------------------------------------------------------------------------
// CATEGORY_PRODUCT_REEL
// ---------------------------------------------------------------------------

export async function getAdminCategoryReelSection(
  sectionId: string,
): Promise<{
  meta: AdminHomepageSectionMeta;
  config: HomepageCategoryReelConfig;
  manualProductIds: string[];
} | null> {
  const section = await prisma.homepageSection.findUnique({ where: { id: sectionId } });
  if (!section) return null;
  const meta: AdminHomepageSectionMeta = {
    id: section.id,
    key: section.key,
    type: section.type,
    position: section.position,
    adminLabel: section.adminLabel,
    title: section.title ?? "",
    enabled: section.enabled,
  };
  const config = parseCategoryReelConfig(section.config);
  const manualItems = await prisma.homepageProductItem.findMany({
    where: { sectionId },
    orderBy: { sortOrder: "asc" },
    select: { productId: true },
  });
  return { meta, config, manualProductIds: manualItems.map((row) => row.productId) };
}

export async function saveHomepageCategoryReelData(
  sectionId: string,
  title: string,
  config: HomepageCategoryReelConfig,
  manualProductIds: string[],
): Promise<boolean> {
  const section = await prisma.homepageSection.findUnique({ where: { id: sectionId }, select: { id: true } });
  if (!section) return false;

  const unique = [...new Set(manualProductIds)];
  await prisma.$transaction(async (tx) => {
    await tx.homepageSection.update({
      where: { id: sectionId },
      data: { title: title.trim() || null, config: config as unknown as Prisma.InputJsonValue },
    });
    await tx.homepageProductItem.deleteMany({ where: { sectionId } });
    if (config.productSource === "MANUAL" && unique.length > 0) {
      await tx.homepageProductItem.createMany({
        data: unique.map((productId, index) => ({ sectionId, productId, sortOrder: index })),
      });
    }
  });
  return true;
}

// ---------------------------------------------------------------------------
// VISUAL_CATEGORIES
// ---------------------------------------------------------------------------

export async function getAdminVisualTilesSection(
  sectionId: string,
): Promise<{ meta: AdminHomepageSectionMeta; tiles: AdminHomepageTileRow[] } | null> {
  const meta = await getAdminHomepageSectionMeta(sectionId);
  if (!meta) return null;
  const rows = await prisma.homepageVisualTile.findMany({
    where: { sectionId },
    include: { category: { include: { translations: true } } },
  });
  const bySlot = new Map(rows.map((row) => [row.slot, row]));
  const tiles = HOMEPAGE_VISUAL_TILE_SLOTS.map((slot) => {
    const row = bySlot.get(slot);
    if (!row) {
      return {
        id: null,
        slot,
        imageUrl: "",
        objectKey: null,
        mobileImageUrl: "",
        mobileObjectKey: null,
        title: "",
        subtitle: "",
        linkType: "CATEGORY" as HomepageLinkType,
        href: "",
        categoryId: "",
        categoryLabel: "",
        enabled: true,
      };
    }
    return {
      id: row.id,
      slot,
      imageUrl: row.imageUrl ?? "",
      objectKey: row.objectKey,
      mobileImageUrl: row.mobileImageUrl ?? "",
      mobileObjectKey: row.mobileObjectKey,
      title: row.title ?? "",
      subtitle: row.subtitle ?? "",
      linkType: row.linkType,
      href: row.href ?? "",
      categoryId: row.categoryId ?? "",
      categoryLabel: row.category ? pickTranslation(row.category.translations).name : "",
      enabled: row.enabled,
    };
  });
  return { meta, tiles };
}

type TileSaveInput = {
  slot: HomepageVisualTileSlot;
  imageUrl: string | null;
  objectKey: string | null;
  mobileImageUrl: string | null;
  mobileObjectKey: string | null;
  title: string | null;
  subtitle: string | null;
  linkType: HomepageLinkType;
  href: string | null;
  categoryId: string | null;
  enabled: boolean;
};

export async function saveHomepageVisualTilesData(sectionId: string, tiles: TileSaveInput[]): Promise<boolean> {
  const section = await prisma.homepageSection.findUnique({ where: { id: sectionId }, select: { id: true } });
  if (!section) return false;

  const existing = await prisma.homepageVisualTile.findMany({ where: { sectionId } });
  const existingBySlot = new Map(existing.map((row) => [row.slot, row]));

  await prisma.$transaction(async (tx) => {
    for (const tile of tiles) {
      const current = existingBySlot.get(tile.slot);
      const data = {
        imageUrl: tile.imageUrl,
        objectKey: tile.objectKey,
        mobileImageUrl: tile.mobileImageUrl,
        mobileObjectKey: tile.mobileObjectKey,
        title: tile.title,
        subtitle: tile.subtitle,
        linkType: tile.linkType,
        href: tile.linkType === "CUSTOM" ? tile.href : null,
        categoryId: tile.linkType === "CATEGORY" ? tile.categoryId : null,
        enabled: tile.enabled,
      };
      if (current) {
        await tx.homepageVisualTile.update({ where: { id: current.id }, data });
        await cleanupStaleObjectKeys([current.objectKey], [tile.objectKey]);
        await cleanupStaleObjectKeys([current.mobileObjectKey], [tile.mobileObjectKey]);
      } else {
        await tx.homepageVisualTile.create({
          data: { ...data, sectionId, slot: tile.slot, sortOrder: HOMEPAGE_VISUAL_TILE_SLOTS.indexOf(tile.slot) },
        });
      }
    }
  });
  return true;
}

export { HOMEPAGE_SECTION_KEYS };
