import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import {
  HOMEPAGE_BANNER_SLOTS,
  HOMEPAGE_REEL_CATEGORY_KEYWORDS,
  HOMEPAGE_SECTION_BLUEPRINT,
  HOMEPAGE_SECTION_KEYS,
  HOMEPAGE_VISUAL_TILE_SLOTS,
  defaultCategoryReelConfig,
  parseCategoryReelConfig,
  type HomepageSectionKey,
} from "@/lib/homepage/types";

const BRAND_REEL_LIMIT = 12;

type CategoryCandidate = {
  id: string;
  name: string;
  productCount: number;
  childCount: number;
};

function findCategoryForKeywords(
  categories: CategoryCandidate[],
  keywords: string[],
  used: Set<string>,
): CategoryCandidate | null {
  const matches = categories.filter((category) =>
    keywords.some((keyword) => category.name.includes(keyword)),
  );
  if (matches.length === 0) return null;

  const rank = (category: CategoryCandidate) => {
    let score = category.productCount;
    if (category.childCount === 0) score += 1000; // strongly prefer leaf categories
    if (!used.has(category.id)) score += 100000; // strongly prefer not-yet-used categories
    return score;
  };

  return [...matches].sort((a, b) => rank(b) - rank(a))[0] ?? null;
}

/**
 * Create the default 13-section homepage layout (idempotent, keyed by `HomepageSection.key`)
 * and best-effort backfill content (brand reel, category reel assignment, empty banner/tile rows).
 * Never deletes sections, products, or categories; safe to call repeatedly (e.g. on every boot).
 */
export async function ensureHomepageInitialized(): Promise<void> {
  const existing = await prisma.homepageSection.findMany({
    select: { id: true, key: true, type: true, position: true, config: true },
  });
  const byKey = new Map(existing.map((row) => [row.key, row]));
  const maxPosition = existing.reduce((max, row) => Math.max(max, row.position), -1);

  const missing = HOMEPAGE_SECTION_BLUEPRINT.filter((item) => !byKey.has(item.key));
  if (missing.length > 0) {
    await prisma.$transaction(async (tx) => {
      let position = maxPosition + 1;
      for (const item of missing) {
        const created = await tx.homepageSection.create({
          data: {
            key: item.key,
            type: item.type,
            position: position++,
            adminLabel: item.adminLabel,
            title: item.title ?? null,
            config: (item.config ?? {}) as Prisma.InputJsonValue,
          },
        });
        byKey.set(created.key, {
          id: created.id,
          key: created.key,
          type: created.type,
          position: created.position,
          config: created.config,
        });
      }
    });
  }

  await backfillHomepageContent(byKey);
}

async function backfillHomepageContent(
  byKey: Map<string, { id: string; key: string; type: string; position: number; config: Prisma.JsonValue }>,
): Promise<void> {
  // --- BRAND_REEL ---
  const brandSection = byKey.get(HOMEPAGE_SECTION_KEYS.BRAND_REEL);
  if (brandSection) {
    const brandItemCount = await prisma.homepageBrandItem.count({ where: { sectionId: brandSection.id } });
    if (brandItemCount === 0) {
      const brands = await prisma.brand.findMany({
        where: {
          logoUrl: { not: null },
          products: { some: { isActive: true, deletedAt: null } },
        },
        orderBy: [{ homepageSortOrder: "asc" }, { sortOrder: "asc" }, { slug: "asc" }],
        take: BRAND_REEL_LIMIT,
        select: { id: true },
      });
      if (brands.length > 0) {
        await prisma.homepageBrandItem.createMany({
          data: brands.map((brand, index) => ({ sectionId: brandSection.id, brandId: brand.id, sortOrder: index })),
          skipDuplicates: true,
        });
      }
    }
  }

  // --- CATEGORY_PRODUCT_REEL: assign a sensible category when missing ---
  const reelKeys = Object.values(HOMEPAGE_SECTION_KEYS).filter(
    (key) => key in HOMEPAGE_REEL_CATEGORY_KEYWORDS,
  ) as HomepageSectionKey[];
  const reelSections = reelKeys
    .map((key) => byKey.get(key))
    .filter((row): row is NonNullable<typeof row> => Boolean(row) && row!.type === "CATEGORY_PRODUCT_REEL");

  const needsCategory = reelSections.filter((section) => !parseCategoryReelConfig(section.config).categoryId);
  let matchedCategoryIds: string[] = [];

  if (needsCategory.length > 0) {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      include: {
        translations: { where: { locale: "ka" } },
        _count: { select: { products: true, children: true } },
      },
    });
    const candidates: CategoryCandidate[] = categories.map((category) => ({
      id: category.id,
      name: category.translations[0]?.name ?? category.slug,
      productCount: category._count.products,
      childCount: category._count.children,
    }));

    const used = new Set<string>();
    const updates: { sectionId: string; categoryId: string }[] = [];
    for (const section of needsCategory) {
      const keywords = HOMEPAGE_REEL_CATEGORY_KEYWORDS[section.key as HomepageSectionKey] ?? [];
      const match = findCategoryForKeywords(candidates, keywords, used);
      if (!match) continue;
      used.add(match.id);
      const config = defaultCategoryReelConfig(match.id, parseCategoryReelConfig(section.config).productSource);
      updates.push({ sectionId: section.id, categoryId: match.id });
      await prisma.homepageSection.update({
        where: { id: section.id },
        data: { config: config as unknown as Prisma.InputJsonValue },
      });
    }
    matchedCategoryIds = updates.map((row) => row.categoryId);
  } else {
    matchedCategoryIds = reelSections
      .map((section) => parseCategoryReelConfig(section.config).categoryId)
      .filter((id): id is string => Boolean(id));
  }

  // --- SPLIT_BANNERS: ensure empty A/B placeholder rows exist ---
  for (const key of [HOMEPAGE_SECTION_KEYS.SPLIT_BANNERS_1, HOMEPAGE_SECTION_KEYS.SPLIT_BANNERS_2]) {
    const section = byKey.get(key);
    if (!section) continue;
    const count = await prisma.homepageBanner.count({ where: { sectionId: section.id } });
    if (count === 0) {
      await prisma.homepageBanner.createMany({
        data: HOMEPAGE_BANNER_SLOTS.map((slot, index) => ({
          sectionId: section.id,
          slot,
          sortOrder: index,
          linkType: "NONE" as const,
        })),
      });
    }
  }

  // --- FEATURE_BANNER: ensure a single empty row exists ---
  const featureSection = byKey.get(HOMEPAGE_SECTION_KEYS.FEATURE_BANNER);
  if (featureSection) {
    const count = await prisma.homepageBanner.count({ where: { sectionId: featureSection.id } });
    if (count === 0) {
      await prisma.homepageBanner.create({
        data: { sectionId: featureSection.id, slot: null, sortOrder: 0, linkType: "NONE" },
      });
    }
  }

  // --- VISUAL_CATEGORIES: ensure 5 tile rows exist, seeded with matched categories when available ---
  const visualSection = byKey.get(HOMEPAGE_SECTION_KEYS.VISUAL_CATEGORIES);
  if (visualSection) {
    const count = await prisma.homepageVisualTile.count({ where: { sectionId: visualSection.id } });
    if (count === 0) {
      const pool = [...matchedCategoryIds];
      await prisma.homepageVisualTile.createMany({
        data: HOMEPAGE_VISUAL_TILE_SLOTS.map((slot, index) => {
          const categoryId = pool[index] ?? null;
          return {
            sectionId: visualSection.id,
            slot,
            sortOrder: index,
            linkType: "CATEGORY" as const,
            categoryId,
          };
        }),
        skipDuplicates: true,
      });
    }
  }
}
