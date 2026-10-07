import "server-only";

import { prisma } from "@/server/db";

export type AdminHeroSlideRow = {
  id: string;
  imageUrl: string;
  objectKey: string | null;
  mobileImageUrl: string;
  mobileObjectKey: string | null;
  title: string;
  subtitle: string;
  ctaText: string;
  href: string;
  openInNewTab: boolean;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
};

function toAdminHeroSlideRow(row: {
  id: string;
  imageUrl: string;
  objectKey: string | null;
  mobileImageUrl: string | null;
  mobileObjectKey: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  href: string | null;
  openInNewTab: boolean;
  sortOrder: number;
  isActive: boolean;
  updatedAt: Date;
}): AdminHeroSlideRow {
  return {
    id: row.id,
    imageUrl: row.imageUrl,
    objectKey: row.objectKey,
    mobileImageUrl: row.mobileImageUrl ?? "",
    mobileObjectKey: row.mobileObjectKey,
    title: row.title ?? "",
    subtitle: row.subtitle ?? "",
    ctaText: row.ctaText ?? "",
    href: row.href ?? "",
    openInNewTab: row.openInNewTab,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAdminHeroSlides(): Promise<AdminHeroSlideRow[]> {
  const rows = await prisma.heroSlide.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toAdminHeroSlideRow);
}

export async function getAdminHeroSlide(id: string): Promise<AdminHeroSlideRow | null> {
  const row = await prisma.heroSlide.findUnique({ where: { id } });
  if (!row) return null;
  return toAdminHeroSlideRow(row);
}
