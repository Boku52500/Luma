import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { prisma } from "@/server/db";
import { STOREFRONT_HERO_CACHE_TAG } from "@/server/catalog/merchTags";
import { normalizeMerchHref } from "@/lib/merchHref";

export type StorefrontHeroSlide = {
  id: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  href: string | null;
  openInNewTab: boolean;
  sortOrder: number;
};

const loadActiveHeroSlides = unstable_cache(
  async (): Promise<StorefrontHeroSlide[]> => {
    const rows = await prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        imageUrl: true,
        mobileImageUrl: true,
        title: true,
        subtitle: true,
        ctaText: true,
        href: true,
        openInNewTab: true,
        sortOrder: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      imageUrl: row.imageUrl,
      mobileImageUrl: row.mobileImageUrl,
      title: row.title,
      subtitle: row.subtitle,
      ctaText: row.ctaText,
      href: normalizeMerchHref(row.href),
      openInNewTab: row.openInNewTab,
      sortOrder: row.sortOrder,
    }));
  },
  ["storefront-hero-slides"],
  { revalidate: 300, tags: [STOREFRONT_HERO_CACHE_TAG] },
);

export const getStorefrontHeroSlides = cache(() => loadActiveHeroSlides());
