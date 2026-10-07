import type { HomepageLinkType, HomepageSectionType } from "@/generated/prisma/client";

export type { HomepageLinkType, HomepageSectionType };

/** How a CATEGORY_PRODUCT_REEL section picks which products to show. */
export type HomepageProductSource = "MANUAL" | "AUTOMATIC" | "POPULAR" | "NEWEST";

export const HOMEPAGE_PRODUCT_SOURCES: readonly HomepageProductSource[] = [
  "AUTOMATIC",
  "POPULAR",
  "NEWEST",
  "MANUAL",
];

export const HOMEPAGE_PRODUCT_SOURCE_LABELS: Record<HomepageProductSource, string> = {
  AUTOMATIC: "ავტომატური",
  POPULAR: "პოპულარული",
  NEWEST: "უახლესი",
  MANUAL: "ხელით არჩეული",
};

/** Stable keys used for idempotent init — never rename once shipped. */
export const HOMEPAGE_SECTION_KEYS = {
  HERO: "hero",
  SPLIT_BANNERS_1: "split-banners-1",
  BRAND_REEL: "brand-reel",
  REEL_PHONES: "reel-phones",
  REEL_LAPTOPS: "reel-laptops",
  FEATURE_BANNER: "feature-banner-1",
  REEL_TV: "reel-tv",
  REEL_GAMING: "reel-gaming",
  VISUAL_CATEGORIES: "visual-categories",
  REEL_KITCHEN: "reel-kitchen",
  REEL_COFFEE: "reel-coffee",
  SPLIT_BANNERS_2: "split-banners-2",
  REEL_COOLERS: "reel-coolers",
} as const;

export type HomepageSectionKey = (typeof HOMEPAGE_SECTION_KEYS)[keyof typeof HOMEPAGE_SECTION_KEYS];

export const HOMEPAGE_VISUAL_TILE_SLOTS = ["largeA", "wide", "smallC", "smallD", "largeB"] as const;
export type HomepageVisualTileSlot = (typeof HOMEPAGE_VISUAL_TILE_SLOTS)[number];

export const HOMEPAGE_BANNER_SLOTS = ["A", "B"] as const;
export type HomepageBannerSlot = (typeof HOMEPAGE_BANNER_SLOTS)[number];

/** Type-specific `HomepageSection.config` JSON shapes. */
export type HomepageCategoryReelConfig = {
  categoryId: string | null;
  productSource: HomepageProductSource;
  limit: number;
  viewAllHref?: string | null;
};

export type HomepageSectionConfig = HomepageCategoryReelConfig | Record<string, never>;

export function defaultCategoryReelConfig(
  categoryId: string | null = null,
  productSource: HomepageProductSource = "AUTOMATIC",
): HomepageCategoryReelConfig {
  return { categoryId, productSource, limit: 12, viewAllHref: null };
}

export function isCategoryReelConfig(
  type: HomepageSectionType,
  config: unknown,
): config is HomepageCategoryReelConfig {
  return type === "CATEGORY_PRODUCT_REEL" && Boolean(config) && typeof config === "object";
}

export function parseCategoryReelConfig(config: unknown): HomepageCategoryReelConfig {
  const raw = (config ?? {}) as Partial<HomepageCategoryReelConfig>;
  const source = raw.productSource;
  const productSource: HomepageProductSource =
    source === "MANUAL" || source === "POPULAR" || source === "NEWEST" || source === "AUTOMATIC"
      ? source
      : "AUTOMATIC";
  const limit = Number.isFinite(raw.limit) && Number(raw.limit) > 0 ? Math.min(Math.round(Number(raw.limit)), 24) : 12;
  return {
    categoryId: typeof raw.categoryId === "string" && raw.categoryId ? raw.categoryId : null,
    productSource,
    limit,
    viewAllHref: typeof raw.viewAllHref === "string" && raw.viewAllHref ? raw.viewAllHref : null,
  };
}

export const HOMEPAGE_SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  HERO: "ჰერო ბანერი",
  SPLIT_BANNERS: "ორმაგი ბანერი",
  BRAND_REEL: "ბრენდების ზოლი",
  CATEGORY_PRODUCT_REEL: "პროდუქტების ზოლი",
  FEATURE_BANNER: "ფართო ბანერი",
  VISUAL_CATEGORIES: "ვიზუალური კატეგორიები",
};

export const HOMEPAGE_LINK_TYPE_LABELS: Record<HomepageLinkType, string> = {
  NONE: "არ არის",
  CATEGORY: "კატეგორია",
  PRODUCT: "პროდუქტი",
  BRAND: "ბრენდი",
  CUSTOM: "სხვა ბმული",
};

type HomepageSectionBlueprintItem = {
  key: HomepageSectionKey;
  type: HomepageSectionType;
  adminLabel: string;
  title?: string | null;
  config?: HomepageSectionConfig;
};

/** Default 13-section homepage layout. Seeded once by `ensureHomepageInitialized`. */
export const HOMEPAGE_SECTION_BLUEPRINT: readonly HomepageSectionBlueprintItem[] = [
  { key: HOMEPAGE_SECTION_KEYS.HERO, type: "HERO", adminLabel: "ჰერო ბანერი" },
  { key: HOMEPAGE_SECTION_KEYS.SPLIT_BANNERS_1, type: "SPLIT_BANNERS", adminLabel: "ორმაგი ბანერი #1" },
  { key: HOMEPAGE_SECTION_KEYS.BRAND_REEL, type: "BRAND_REEL", adminLabel: "ბრენდები", title: "ოფიციალური ბრენდები" },
  {
    key: HOMEPAGE_SECTION_KEYS.REEL_PHONES,
    type: "CATEGORY_PRODUCT_REEL",
    adminLabel: "ზოლი — ტელეფონები",
    title: "ტელეფონები",
    config: defaultCategoryReelConfig(null, "POPULAR"),
  },
  {
    key: HOMEPAGE_SECTION_KEYS.REEL_LAPTOPS,
    type: "CATEGORY_PRODUCT_REEL",
    adminLabel: "ზოლი — ლეპტოპები",
    title: "ლეპტოპები",
    config: defaultCategoryReelConfig(null, "POPULAR"),
  },
  { key: HOMEPAGE_SECTION_KEYS.FEATURE_BANNER, type: "FEATURE_BANNER", adminLabel: "ფართო ბანერი" },
  {
    key: HOMEPAGE_SECTION_KEYS.REEL_TV,
    type: "CATEGORY_PRODUCT_REEL",
    adminLabel: "ზოლი — ტელევიზორები",
    title: "ტელევიზორები",
    config: defaultCategoryReelConfig(null, "NEWEST"),
  },
  {
    key: HOMEPAGE_SECTION_KEYS.REEL_GAMING,
    type: "CATEGORY_PRODUCT_REEL",
    adminLabel: "ზოლი — გეიმინგი",
    title: "გეიმინგი",
    config: defaultCategoryReelConfig(null, "POPULAR"),
  },
  { key: HOMEPAGE_SECTION_KEYS.VISUAL_CATEGORIES, type: "VISUAL_CATEGORIES", adminLabel: "ვიზუალური კატეგორიები" },
  {
    key: HOMEPAGE_SECTION_KEYS.REEL_KITCHEN,
    type: "CATEGORY_PRODUCT_REEL",
    adminLabel: "ზოლი — სამზარეულოს ტექნიკა",
    title: "სამზარეულოს ტექნიკა",
    config: defaultCategoryReelConfig(null, "AUTOMATIC"),
  },
  {
    key: HOMEPAGE_SECTION_KEYS.REEL_COFFEE,
    type: "CATEGORY_PRODUCT_REEL",
    adminLabel: "ზოლი — ყავის აპარატები",
    title: "ყავის აპარატები",
    config: defaultCategoryReelConfig(null, "AUTOMATIC"),
  },
  { key: HOMEPAGE_SECTION_KEYS.SPLIT_BANNERS_2, type: "SPLIT_BANNERS", adminLabel: "ორმაგი ბანერი #2" },
  {
    key: HOMEPAGE_SECTION_KEYS.REEL_COOLERS,
    type: "CATEGORY_PRODUCT_REEL",
    adminLabel: "ზოლი — კონდიციონერები",
    title: "კონდიციონერები",
    config: defaultCategoryReelConfig(null, "NEWEST"),
  },
];

/** Keyword groups (Georgian substrings) used to auto-assign a sensible category per reel key. */
export const HOMEPAGE_REEL_CATEGORY_KEYWORDS: Partial<Record<HomepageSectionKey, string[]>> = {
  [HOMEPAGE_SECTION_KEYS.REEL_PHONES]: ["ტელეფონ", "სმარტფონ"],
  [HOMEPAGE_SECTION_KEYS.REEL_LAPTOPS]: ["ლეპტოპ"],
  [HOMEPAGE_SECTION_KEYS.REEL_TV]: ["ტელევიზორ"],
  [HOMEPAGE_SECTION_KEYS.REEL_GAMING]: ["გეიმინგ", "კონსოლ"],
  [HOMEPAGE_SECTION_KEYS.REEL_KITCHEN]: ["სამზარეულო"],
  [HOMEPAGE_SECTION_KEYS.REEL_COFFEE]: ["ყავის აპარატ", "ყავა"],
  [HOMEPAGE_SECTION_KEYS.REEL_COOLERS]: ["კონდიციონერ", "ქულერ"],
};
