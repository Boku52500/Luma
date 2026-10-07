import type { Prisma } from "@/generated/prisma/client";

export const brandInclude = {
  translations: true,
} satisfies Prisma.BrandInclude;

export const categoryInclude = {
  translations: true,
  children: {
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { translations: true },
  },
} satisfies Prisma.CategoryInclude;

/** Lightweight include for PLP cards, search, related rows — not full PDP. */
export const productListInclude = {
  translations: true,
  brand: { include: brandInclude },
  category: { include: { translations: true } },
  images: {
    orderBy: { sortOrder: "asc" as const },
    take: 2,
    include: { translations: true },
  },
  highlights: {
    orderBy: { sortOrder: "asc" as const },
    take: 4,
    include: { translations: true },
  },
  variants: {
    select: { isActive: true },
  },
  installmentTerms: { orderBy: { months: "desc" as const }, take: 1 },
} satisfies Prisma.ProductInclude;

/** Autocomplete-only include: primary image + purchasability, no highlights/installments. */
export const productSuggestionInclude = {
  translations: true,
  brand: { include: brandInclude },
  category: { include: { translations: true } },
  images: {
    orderBy: { sortOrder: "asc" as const },
    take: 1,
    include: { translations: true },
  },
  highlights: {
    orderBy: { sortOrder: "asc" as const },
    take: 0,
    include: { translations: true },
  },
  variants: {
    select: { isActive: true },
  },
  installmentTerms: { orderBy: { months: "desc" as const }, take: 0 },
} satisfies Prisma.ProductInclude;

export const productDetailInclude = {
  translations: true,
  brand: { include: brandInclude },
  category: { include: { translations: true } },
  images: {
    orderBy: { sortOrder: "asc" },
    include: { translations: true },
  },
  highlights: {
    orderBy: { sortOrder: "asc" },
    include: { translations: true },
  },
  packageItems: {
    orderBy: { sortOrder: "asc" },
    include: { translations: true },
  },
  specifications: {
    include: {
      specification: {
        include: {
          translations: true,
          group: { include: { translations: true } },
        },
      },
    },
  },
  variants: {
    where: { isActive: true },
    include: {
      options: {
        include: {
          option: {
            include: {
              translations: true,
              attribute: { include: { translations: true } },
            },
          },
        },
      },
    },
  },
  installmentTerms: { orderBy: { months: "asc" } },
} satisfies Prisma.ProductInclude;
