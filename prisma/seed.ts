/**
 * Deterministic development seed. Rebuilds catalogue tables from the existing
 * mock TypeScript data in `src/data` so the database stays aligned with the
 * storefront without rewriting the UI.
 *
 * Customers, passwords, addresses, orders, and wishlists are not seeded.
 * Auth.js + PostgreSQL own those after a customer registers.
 */
import "dotenv/config";
import { prisma, pingDatabase } from "../src/server/prisma";
import { toDeveloperDatabaseError } from "../src/server/env";
import { allCategories } from "../src/data/categories";
import { allProducts, featuredProducts, newArrivals } from "../src/data/products";
import {
  getDelivery,
  getDescription,
  getGalleryImages,
  getInstallmentOptions,
  getKeyFeatures,
  getSku,
  getSpecGroups,
  getVariantGroups,
  getWarranty,
  getWhatsIncluded,
} from "../src/lib/productDetails";
import type { Product, ProductAvailability } from "../src/types/product";

const GROUP_SLUGS: Record<string, string> = {
  ზოგადი: "general",
  ეკრანი: "display",
  პროცესორი: "processor",
  მეხსიერება: "memory",
  კამერა: "camera",
  კავშირი: "connectivity",
  ბატარეა: "battery",
  ზომები: "dimensions",
};

const SPEC_SLUGS: Record<string, string> = {
  "ზოგადი::ბრენდი": "brand",
  "ზოგადი::მოდელი": "model",
  "ზოგადი::გამოშვების წელი": "release-year",
  "ზოგადი::ფერი": "color",
  "ეკრანი::ზომა": "screen-size",
  "ეკრანი::ტექნოლოგია": "screen-tech",
  "ეკრანი::განახლების სიხშირე": "refresh-rate",
  "ეკრანი::სიკაშკაშე": "brightness",
  "პროცესორი::ჩიპსეტი": "chipset",
  "პროცესორი::CPU": "cpu",
  "პროცესორი::GPU": "gpu",
  "მეხსიერება::შიდა მეხსიერება": "storage",
  "მეხსიერება::ოპერატიული მეხსიერება": "ram",
  "მეხსიერება::მეხსიერების გაფართოება": "storage-expandable",
  "კამერა::მთავარი კამერა": "rear-camera",
  "კამერა::წინა კამერა": "front-camera",
  "კამერა::ვიდეო": "video",
  "კამერა::ოპტიკური ზუმი": "optical-zoom",
};

const FILTERABLE_SPEC_SLUGS = new Set(["ram", "storage", "screen-size", "chipset", "refresh-rate"]);

function hashKey(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function latinSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function brandSlug(name: string): string {
  return latinSlug(name) || `brand-${hashKey(name)}`;
}

function groupSlug(name: string): string {
  return GROUP_SLUGS[name] ?? (latinSlug(name) || `group-${hashKey(name)}`);
}

function specSlug(group: string, label: string): string {
  const key = `${group}::${label}`;
  if (SPEC_SLUGS[key]) return SPEC_SLUGS[key];
  const ascii = latinSlug(label);
  return ascii.length >= 2 ? ascii : `s-${hashKey(key)}`;
}

function mockImageUrl(visual: string, tone?: number): string {
  return `mock://${visual}?tone=${tone ?? 1}`;
}

function stockFromAvailability(availability: ProductAvailability, variantCount: number): number {
  if (availability === "out-of-stock") return 0;
  if (availability === "low-stock") return variantCount > 1 ? 1 : 3;
  return variantCount > 1 ? 8 : 25;
}

function parseNumericValue(value: string): number | null {
  const match = value.replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function warrantyMonths(text: string): number | null {
  const match = text.match(/(\d+)\s*თვე/);
  return match ? Number(match[1]) : null;
}

function cartesian<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>((acc, group) => acc.flatMap((combo) => group.map((item) => [...combo, item])), [[]]);
}

async function resetCatalogue() {
  await prisma.$transaction([
    prisma.review.deleteMany(),
    prisma.wishlistItem.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.address.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.productSpecification.deleteMany(),
    prisma.productVariantOption.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.productImageTranslation.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productHighlightTranslation.deleteMany(),
    prisma.productHighlight.deleteMany(),
    prisma.productPackageItemTranslation.deleteMany(),
    prisma.productPackageItem.deleteMany(),
    prisma.productRelation.deleteMany(),
    prisma.productInstallmentTerm.deleteMany(),
    prisma.productTranslation.deleteMany(),
    prisma.product.deleteMany(),
    prisma.categorySpecification.deleteMany(),
    prisma.variantAttributeOptionTranslation.deleteMany(),
    prisma.variantAttributeOption.deleteMany(),
    prisma.variantAttributeTranslation.deleteMany(),
    prisma.variantAttribute.deleteMany(),
    prisma.specificationDefinitionTranslation.deleteMany(),
    prisma.specificationDefinition.deleteMany(),
    prisma.specificationGroupTranslation.deleteMany(),
    prisma.specificationGroup.deleteMany(),
    prisma.categoryTranslation.deleteMany(),
    prisma.category.deleteMany(),
    prisma.brandTranslation.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.promotionTranslation.deleteMany(),
    prisma.promotion.deleteMany(),
  ]);
}

async function seedBrands() {
  const names = [...new Set(allProducts.map((product) => product.brand))];
  const byName = new Map<string, string>();

  for (const [index, name] of names.entries()) {
    const id = brandSlug(name);
    await prisma.brand.create({
      data: {
        id,
        slug: id,
        sortOrder: index,
        translations: {
          create: {
            locale: "ka",
            name,
            description: `${name} — ოფიციალური პროდუქცია Luma-ში.`,
            seoTitle: `${name} | Luma`,
            seoDescription: `${name}-ის ორიგინალი ტექნიკა ოფიციალური გარანტიით.`,
          },
        },
      },
    });
    byName.set(name, id);
  }

  return byName;
}

async function seedCategories() {
  for (const [index, category] of allCategories.entries()) {
    await prisma.category.create({
      data: {
        id: category.id,
        slug: category.id,
        iconKey: category.visual,
        imageUrl: mockImageUrl(category.visual, 3),
        sortOrder: index,
        isActive: true,
        translations: {
          create: {
            locale: "ka",
            name: category.name,
            description: category.description ?? null,
            seoTitle: `${category.name} | Luma`,
            seoDescription: category.description ?? `${category.name} Luma-ში`,
          },
        },
      },
    });
  }

  await prisma.category.create({
    data: {
      id: "phones-smartphones",
      slug: "phones-smartphones",
      parentId: "phones",
      iconKey: "phone",
      imageUrl: mockImageUrl("phone", 2),
      sortOrder: 0,
      isActive: true,
      translations: {
        create: {
          locale: "ka",
          name: "სმარტფონები",
          description: "სმარტფონები ყველა ბრენდისგან — ტელეფონების კატეგორიის ქვეჯგუფი.",
          seoTitle: "სმარტფონები | Luma",
          seoDescription: "სმარტფონები Apple, Samsung და სხვა ბრენდებისგან.",
        },
      },
    },
  });

  await prisma.category.create({
    data: {
      id: "phones-apple",
      slug: "phones-apple",
      parentId: "phones-smartphones",
      iconKey: "phone",
      imageUrl: mockImageUrl("phone", 1),
      sortOrder: 0,
      isActive: true,
      translations: {
        create: {
          locale: "ka",
          name: "Apple",
          description: "Apple სმარტფონები — იერარქიის მაგალითი: ტელეფონები → სმარტფონები → Apple.",
          seoTitle: "Apple სმარტფონები | Luma",
          seoDescription: "iPhone მოდელები ოფიციალური გარანტიით.",
        },
      },
    },
  });
}

async function seedPromotions() {
  await prisma.promotion.create({
    data: {
      id: "promo-luma10",
      code: "LUMA10",
      type: "percentage",
      value: "10.00",
      isActive: true,
      translations: {
        create: {
          locale: "ka",
          name: "Luma 10%",
          description: "10% ფასდაკლება კალათის ჯამზე. დემო კატალოგის პრომოკოდი.",
        },
      },
    },
  });
}

type SpecDef = { id: string; groupId: string; slug: string };

async function seedSpecifications(products: Product[]) {
  const groups = new Map<string, { id: string; name: string }>();
  const definitions = new Map<string, SpecDef>();

  for (const product of products) {
    for (const group of getSpecGroups(product)) {
      const gSlug = groupSlug(group.group);
      if (!groups.has(gSlug)) {
        const id = `sg-${gSlug}`;
        groups.set(gSlug, { id, name: group.group });
        await prisma.specificationGroup.create({
          data: {
            id,
            slug: gSlug,
            sortOrder: groups.size,
            translations: { create: { locale: "ka", name: group.group } },
          },
        });
      }

      const groupId = groups.get(gSlug)!.id;
      for (const [itemIndex, item] of group.items.entries()) {
        const sSlug = specSlug(group.group, item.label);
        const key = `${gSlug}::${sSlug}`;
        if (definitions.has(key)) continue;
        const id = `sd-${gSlug}-${sSlug}`;
        definitions.set(key, { id, groupId, slug: sSlug });
        await prisma.specificationDefinition.create({
          data: {
            id,
            groupId,
            slug: sSlug,
            isFilterable: FILTERABLE_SPEC_SLUGS.has(sSlug),
            sortOrder: itemIndex,
            translations: { create: { locale: "ka", name: item.label } },
          },
        });
      }
    }
  }

  await ensureMemoryFilterSpecs(groups, definitions);
  return definitions;
}

async function ensureMemoryFilterSpecs(
  groups: Map<string, { id: string; name: string }>,
  definitions: Map<string, SpecDef>,
) {
  const gSlug = "memory";
  if (!groups.has(gSlug)) {
    const id = `sg-${gSlug}`;
    groups.set(gSlug, { id, name: "მეხსიერება" });
    await prisma.specificationGroup.create({
      data: {
        id,
        slug: gSlug,
        sortOrder: groups.size,
        translations: { create: { locale: "ka", name: "მეხსიერება" } },
      },
    });
  }

  const groupId = groups.get(gSlug)!.id;
  const extras: { key: string; slug: string; name: string }[] = [
    { key: "memory::storage", slug: "storage", name: "შიდა მეხსიერება" },
    { key: "memory::ram", slug: "ram", name: "ოპერატიული მეხსიერება" },
  ];

  for (const extra of extras) {
    if (definitions.has(extra.key)) continue;
    const id = `sd-${gSlug}-${extra.slug}`;
    definitions.set(extra.key, { id, groupId, slug: extra.slug });
    await prisma.specificationDefinition.create({
      data: {
        id,
        groupId,
        slug: extra.slug,
        isFilterable: true,
        sortOrder: definitions.size,
        translations: { create: { locale: "ka", name: extra.name } },
      },
    });
  }
}

async function seedFilterSpec(
  productId: string,
  specDefs: Map<string, SpecDef>,
  seenSpecs: Set<string>,
  key: string,
  value: string | undefined,
) {
  if (!value) return;
  const def = specDefs.get(key);
  if (!def || seenSpecs.has(def.id)) return;
  seenSpecs.add(def.id);
  await prisma.productSpecification.create({
    data: {
      productId,
      specificationId: def.id,
      value,
      numericValue: parseNumericValue(value),
    },
  });
}

async function seedVariantAttributes(products: Product[]) {
  const attributes = new Map<string, string>();
  const options = new Map<string, string>();

  for (const product of products) {
    for (const [groupIndex, group] of getVariantGroups(product).entries()) {
      const attrSlug = latinSlug(group.id) || `attr-${hashKey(group.id)}`;
      if (!attributes.has(attrSlug)) {
        const id = `va-${attrSlug}`;
        attributes.set(attrSlug, id);
        await prisma.variantAttribute.create({
          data: {
            id,
            slug: attrSlug,
            sortOrder: groupIndex,
            translations: { create: { locale: "ka", name: group.label } },
          },
        });
      }

      const attributeId = attributes.get(attrSlug)!;
      for (const [optionIndex, option] of group.options.entries()) {
        const optSlug = latinSlug(option.value) || `opt-${hashKey(option.value)}`;
        const key = `${attrSlug}::${optSlug}`;
        if (options.has(key)) continue;
        const id = `vao-${attrSlug}-${optSlug}`;
        options.set(key, id);
        await prisma.variantAttributeOption.create({
          data: {
            id,
            attributeId,
            slug: optSlug,
            swatch: option.swatch ?? null,
            sortOrder: optionIndex,
            translations: { create: { locale: "ka", name: option.label } },
          },
        });
      }
    }
  }

  return { attributes, options };
}

async function seedProduct(
  product: Product,
  brandIds: Map<string, string>,
  specDefs: Map<string, SpecDef>,
  optionIds: Map<string, string>,
  featuredSortById: Map<string, number>,
  newArrivalSortById: Map<string, number>,
) {
  const sku = getSku(product);
  const brandId = brandIds.get(product.brand);
  if (!brandId) throw new Error(`Missing brand ${product.brand}`);

  const variantGroups = getVariantGroups(product);
  const combinations = variantGroups.length
    ? cartesian(
        variantGroups.map((group) =>
          group.options.map((option) => ({
            attributeSlug: latinSlug(group.id) || `attr-${hashKey(group.id)}`,
            optionSlug: latinSlug(option.value) || `opt-${hashKey(option.value)}`,
          })),
        ),
      )
    : [];

  const variantCount = combinations.length;
  const perVariantStock = stockFromAvailability(product.availability, Math.max(variantCount, 1));
  const stockQuantity = variantCount > 0 ? perVariantStock * variantCount : perVariantStock;
  const warranty = getWarranty(product);
  const delivery = getDelivery(product);
  const description = getDescription(product);

  await prisma.product.create({
    data: {
      id: product.id,
      sku,
      slug: product.slug,
      brandId,
      categoryId: product.category,
      price: product.price.toFixed(2),
      previousPrice: product.previousPrice == null ? null : product.previousPrice.toFixed(2),
      stockQuantity,
      isActive: true,
      isFeatured: featuredSortById.has(product.id),
      isNew: Boolean(product.isNew) || newArrivalSortById.has(product.id),
      featuredSort: featuredSortById.get(product.id) ?? null,
      newArrivalSort: newArrivalSortById.get(product.id) ?? null,
      badgeKind: product.badge?.kind ?? null,
      badgeLabel: product.badge?.label ?? null,
      stockStatus: product.availability,
      storageLabel: product.storage ?? null,
      ramLabel: product.ram ?? null,
      illustrationKey: product.visual,
      illustrationTone: product.tone,
      warrantyMonths: warrantyMonths(warranty),
      returnDays: delivery.returnDays,
      ratingAverage: product.rating.toFixed(2),
      reviewCount: product.reviewCount,
      translations: {
        create: {
          locale: "ka",
          name: product.name,
          shortDescription: product.shortDescription ?? null,
          description,
          seoTitle: `${product.name} | Luma`,
          seoDescription: (product.shortDescription ?? description).slice(0, 500),
          deliveryEstimate: delivery.estimate,
          warranty,
        },
      },
    },
  });

  for (const [index, image] of getGalleryImages(product).entries()) {
    await prisma.productImage.create({
      data: {
        id: `${product.id}-img-${index}`,
        productId: product.id,
        url: mockImageUrl(image.visual, image.tone),
        sortOrder: index,
        translations: {
          create: { locale: "ka", alt: product.name },
        },
      },
    });
  }

  for (const [index, text] of getKeyFeatures(product).entries()) {
    await prisma.productHighlight.create({
      data: {
        id: `${product.id}-hl-${index}`,
        productId: product.id,
        sortOrder: index,
        translations: { create: { locale: "ka", text } },
      },
    });
  }

  for (const [index, text] of getWhatsIncluded(product).entries()) {
    await prisma.productPackageItem.create({
      data: {
        id: `${product.id}-pkg-${index}`,
        productId: product.id,
        sortOrder: index,
        translations: { create: { locale: "ka", text } },
      },
    });
  }

  for (const term of getInstallmentOptions(product)) {
    await prisma.productInstallmentTerm.create({
      data: {
        productId: product.id,
        months: term.months,
        monthlyPrice: term.monthlyPrice.toFixed(2),
      },
    });
  }

  const seenSpecs = new Set<string>();
  for (const group of getSpecGroups(product)) {
    const gSlug = groupSlug(group.group);
    for (const item of group.items) {
      const def = specDefs.get(`${gSlug}::${specSlug(group.group, item.label)}`);
      if (!def || seenSpecs.has(def.id)) continue;
      seenSpecs.add(def.id);
      await prisma.productSpecification.create({
        data: {
          productId: product.id,
          specificationId: def.id,
          value: item.value,
          numericValue: parseNumericValue(item.value),
        },
      });
    }
  }

  await seedFilterSpec(product.id, specDefs, seenSpecs, "memory::storage", product.storage);
  await seedFilterSpec(product.id, specDefs, seenSpecs, "memory::ram", product.ram);

  for (const combo of combinations) {
    const optionIdList = combo.map((part) => {
      const id = optionIds.get(`${part.attributeSlug}::${part.optionSlug}`);
      if (!id) throw new Error(`Missing variant option ${part.attributeSlug}/${part.optionSlug}`);
      return id;
    });
    const variantSku = `${sku}-${combo.map((part) => part.optionSlug).join("-")}`;
    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: variantSku,
        stockQuantity: perVariantStock,
        isActive: true,
      },
    });
    await prisma.productVariantOption.createMany({
      data: optionIdList.map((optionId) => ({ variantId: variant.id, optionId })),
    });
  }
}

async function seedRelations(products: Product[]) {
  const ids = new Set(products.map((product) => product.id));
  for (const product of products) {
    for (const [index, relatedId] of (product.relatedIds ?? []).entries()) {
      if (!ids.has(relatedId) || relatedId === product.id) continue;
      await prisma.productRelation.create({
        data: {
          productId: product.id,
          relatedProductId: relatedId,
          sortOrder: index,
        },
      });
    }
  }
}

async function seedCategorySpecifications() {
  const rows = await prisma.productSpecification.findMany({
    select: { specificationId: true, product: { select: { categoryId: true } } },
  });
  const seen = new Set<string>();
  let sort = 0;
  for (const row of rows) {
    const key = `${row.product.categoryId}::${row.specificationId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await prisma.categorySpecification.create({
      data: {
        categoryId: row.product.categoryId,
        specificationId: row.specificationId,
        sortOrder: sort++,
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error(
      "Refusing to seed: this wipes and rebuilds catalogue tables. For a deliberate production seed set ALLOW_PRODUCTION_SEED=true. See docs/deployment.md.",
    );
  }

  const featuredSortById = new Map(featuredProducts.map((product, index) => [product.id, index]));
  const newArrivalSortById = new Map(newArrivals.map((product, index) => [product.id, index]));

  console.log("Seeding Luma catalogue…");
  await pingDatabase();
  await resetCatalogue();
  const brandIds = await seedBrands();
  await seedCategories();
  await seedPromotions();
  const specDefs = await seedSpecifications(allProducts);
  const { options } = await seedVariantAttributes(allProducts);

  for (const product of allProducts) {
    await seedProduct(product, brandIds, specDefs, options, featuredSortById, newArrivalSortById);
  }

  await seedRelations(allProducts);
  await seedCategorySpecifications();

  const productCount = await prisma.product.count();
  const sample = await prisma.product.findUnique({
    where: { slug: "apple-iphone-15-pro-128" },
    include: { translations: true, variants: true, images: true, specifications: true },
  });

  console.log(`Seeded ${productCount} products, ${await prisma.brand.count()} brands, ${await prisma.category.count()} categories.`);
  if (!sample) {
    throw new Error("Seed verification failed: iPhone 15 Pro was not found.");
  }
  console.log(
    `Verified ${sample.translations[0]?.name} — ${sample.images.length} images, ${sample.variants.length} variants, ${sample.specifications.length} specs.`,
  );
}

main()
  .catch((error) => {
    console.error(toDeveloperDatabaseError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
