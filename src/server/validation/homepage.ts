import { z } from "zod";

const linkType = z.enum(["NONE", "CATEGORY", "PRODUCT", "BRAND", "CUSTOM"]);
const productSource = z.enum(["MANUAL", "AUTOMATIC", "POPULAR", "NEWEST"]);

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const homepageIdSchema = z.object({
  id: z.string().trim().min(1),
});

export const homepageMoveSectionSchema = z.object({
  id: z.string().trim().min(1),
  direction: z.enum(["up", "down"]),
});

export const homepageSetEnabledSchema = z.object({
  id: z.string().trim().min(1),
  enabled: z.boolean(),
});

export const homepageSectionMetaSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().max(200).optional().default(""),
});

export const homepageCategoryReelSaveSchema = z.object({
  sectionId: z.string().trim().min(1),
  title: z.string().trim().max(200).optional().default(""),
  categoryId: z.string().trim().min(1).nullable().optional(),
  productSource,
  limit: z.number().int().min(1).max(24).default(12),
  viewAllHref: z.string().trim().max(500).optional().nullable(),
  manualProductIds: z.array(z.string().trim().min(1)).max(24).optional().default([]),
});

export const homepageBrandReelSaveSchema = z.object({
  sectionId: z.string().trim().min(1),
  brandIds: z.array(z.string().trim().min(1)).max(40),
});

const homepageBannerItemSchema = z.object({
  id: z.string().trim().optional(),
  slot: z.enum(["A", "B"]).nullable().optional(),
  imageUrl: nullableText(2000),
  objectKey: nullableText(500),
  mobileImageUrl: nullableText(2000),
  mobileObjectKey: nullableText(500),
  alt: nullableText(255),
  title: nullableText(200),
  subtitle: nullableText(300),
  ctaText: nullableText(80),
  linkType,
  href: nullableText(2000),
  categoryId: nullableText(64),
  productId: nullableText(64),
  brandId: nullableText(64),
  openInNewTab: z.boolean().optional().default(false),
  enabled: z.boolean().optional().default(true),
});

export const homepageSplitBannersSaveSchema = z.object({
  sectionId: z.string().trim().min(1),
  banners: z.array(homepageBannerItemSchema).length(2),
});

export const homepageFeatureBannerSaveSchema = z.object({
  sectionId: z.string().trim().min(1),
  banner: homepageBannerItemSchema,
});

const homepageVisualTileItemSchema = z.object({
  slot: z.enum(["largeA", "wide", "smallC", "smallD", "largeB"]),
  imageUrl: nullableText(2000),
  objectKey: nullableText(500),
  mobileImageUrl: nullableText(2000),
  mobileObjectKey: nullableText(500),
  title: nullableText(200),
  subtitle: nullableText(300),
  linkType,
  href: nullableText(2000),
  categoryId: nullableText(64),
  enabled: z.boolean().optional().default(true),
});

export const homepageVisualTilesSaveSchema = z.object({
  sectionId: z.string().trim().min(1),
  tiles: z.array(homepageVisualTileItemSchema).length(5),
});

export type HomepageCategoryReelSaveInput = z.infer<typeof homepageCategoryReelSaveSchema>;
export type HomepageBrandReelSaveInput = z.infer<typeof homepageBrandReelSaveSchema>;
export type HomepageSplitBannersSaveInput = z.infer<typeof homepageSplitBannersSaveSchema>;
export type HomepageFeatureBannerSaveInput = z.infer<typeof homepageFeatureBannerSaveSchema>;
export type HomepageVisualTilesSaveInput = z.infer<typeof homepageVisualTilesSaveSchema>;
