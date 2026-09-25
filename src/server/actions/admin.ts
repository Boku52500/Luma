"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { requireAdminAction } from "@/server/auth/admin";
import { logError } from "@/server/log";
import { firstZodMessage, isUniqueConstraintError } from "@/server/actions/helpers";
import { GENERIC_SERVER_ERROR, type ActionResult } from "@/server/actions/result";
import {
  adminBrandSaveSchema,
  adminCategorySaveSchema,
  adminCategoryTreeMoveSchema,
  adminHeroReorderSchema,
  adminHeroSlideSaveSchema,
  adminIdSchema,
  adminOrderStatusSchema,
  adminProductImageAltSchema,
  adminProductImageReorderSchema,
  adminProductSaveSchema,
  adminPromotionSaveSchema,
  adminSpecificationCreateSchema,
  adminSpecificationRenameSchema,
  adminSpecificationValueCreateSchema,
  adminVariantOptionCreateSchema,
} from "@/server/validation/admin";
import { parseMoneyInput } from "@/server/money";
import { categoryWouldCycle } from "@/server/admin/categories";
import { productArchiveData, productRestoreData } from "@/server/admin/productArchive";
import { createReusableVariantOption } from "@/server/admin/variantOptions";
import { planProductSpecifications } from "@/lib/adminProductSpecs";
import {
  categorySlugFromName,
  containsGeorgianCharacters,
  ensureUniqueCategorySlug,
  isCanonicalCategorySlug,
} from "@/lib/categorySlug";
import { canDeleteCategory, planCategoryTreeMove } from "@/lib/categoryTree";
import {
  createSpecWriteCache,
  deleteUnusedSpecificationDefinition,
  deleteUnusedSpecificationValue,
  findOrCreateSpecificationDefinition,
  findOrCreateSpecificationValue,
  renameSpecificationDefinition,
  renameSpecificationValue,
} from "@/server/admin/specifications";
import { scheduleEmail } from "@/server/email/schedule";
import { notifyOrderStatus } from "@/server/email/notify";
import { shouldSendOrderStatusEmail } from "@/server/email/events";
import { applyInventoryEvent } from "@/server/commerce/inventory";
import { applyPromoEvent } from "@/server/commerce/promoRedemption";
import { PRODUCT_IMAGE_MAX_BYTES } from "@/lib/productImageLimits";
import {
  STORAGE_NOT_CONFIGURED,
  createBrandLogoObjectKey,
  createCategoryImageObjectKey,
  createHeroImageObjectKey,
  createPendingProductImageObjectKey,
  createProductImageObjectKey,
  deleteProductImageObject,
  getR2Config,
  isManagedProductImageKey,
  isPendingProductImageKey,
  processProductImage,
  ProductImageValidationError,
  publicUrlForObjectKey,
  putProductImageObject,
} from "@/server/storage";
import { revalidatePath } from "next/cache";
import { normalizeMerchHref } from "@/lib/merchHref";
import { revalidateCatalogue, revalidateHero, revalidateOrders, revalidatePromotions } from "@/server/admin/revalidate";

function uniqueMessage(error: unknown): string | null {
  if (isUniqueConstraintError(error, "sku")) return "ეს SKU უკვე გამოიყენება";
  if (isUniqueConstraintError(error, "slug")) return "ეს slug უკვე გამოიყენება";
  if (isUniqueConstraintError(error, "code")) return "ეს პრომოკოდი უკვე არსებობს";
  if (isUniqueConstraintError(error)) return "ეს ჩანაწერი უკვე არსებობს";
  return null;
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function parseOptionalMoney(raw: string | undefined): Prisma.Decimal | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  return parseMoneyInput(value);
}

function parseOptionalDate(raw: string | undefined): Date | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseOptionalInt(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n)) return null;
  return n;
}

function specNumeric(value: string): Prisma.Decimal | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return new Prisma.Decimal(normalized);
}

async function upsertLocaleCopy(
  tx: Prisma.TransactionClient,
  productId: string,
  locale: "ka" | "en" | "ru",
  copy: {
    name: string;
    shortDescription?: string;
    description?: string;
    seoTitle?: string;
    seoDescription?: string;
    warranty?: string;
    deliveryEstimate?: string;
  },
  required: boolean,
) {
  const name = copy.name.trim();
  if (!name) {
    if (required) return;
    await tx.productTranslation.deleteMany({ where: { productId, locale } });
    return;
  }

  await tx.productTranslation.upsert({
    where: { productId_locale: { productId, locale } },
    create: {
      productId,
      locale,
      name,
      shortDescription: emptyToNull(copy.shortDescription),
      description: emptyToNull(copy.description),
      seoTitle: emptyToNull(copy.seoTitle),
      seoDescription: emptyToNull(copy.seoDescription),
      warranty: emptyToNull(copy.warranty),
      deliveryEstimate: emptyToNull(copy.deliveryEstimate),
    },
    update: {
      name,
      shortDescription: emptyToNull(copy.shortDescription),
      description: emptyToNull(copy.description),
      seoTitle: emptyToNull(copy.seoTitle),
      seoDescription: emptyToNull(copy.seoDescription),
      warranty: emptyToNull(copy.warranty),
      deliveryEstimate: emptyToNull(copy.deliveryEstimate),
    },
  });
}

export async function saveAdminProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;

  const parsed = adminProductSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message, fieldErrors } = firstZodMessage(parsed.error);
    return { ok: false, message, fieldErrors };
  }

  const data = parsed.data;
  const price = parseMoneyInput(data.price);
  const previousPrice = parseOptionalMoney(data.previousPrice);
  const badgeKind = emptyToNull(data.badgeKind);
  const stockStatus = data.isActive ? "in-stock" : "out-of-stock";

  try {
    const [brand, category] = await Promise.all([
      prisma.brand.findUnique({ where: { id: data.brandId }, select: { id: true } }),
      prisma.category.findUnique({ where: { id: data.categoryId }, select: { id: true } }),
    ]);
    if (!brand) return { ok: false, message: "ბრენდი ვერ მოიძებნა", fieldErrors: { brandId: "აირჩიეთ არსებული ბრენდი" } };
    if (!category) {
      return { ok: false, message: "კატეგორია ვერ მოიძებნა", fieldErrors: { categoryId: "აირჩიეთ არსებული კატეგორია" } };
    }

    const specPlan = planProductSpecifications(data.specifications);
    if (!specPlan.ok) return { ok: false, message: specPlan.message };

    const saved = await prisma.$transaction(
      async (tx) => {
      const productData = {
        sku: data.sku,
        slug: data.slug,
        brandId: data.brandId,
        categoryId: data.categoryId,
        price,
        previousPrice,
        stockQuantity: 0,
        stockStatus,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        isNew: data.isNew,
        featuredSort: data.isFeatured ? (data.featuredSort ?? 0) : null,
        newArrivalSort: data.isNew ? (data.newArrivalSort ?? 0) : null,
        badgeKind,
        badgeLabel: badgeKind ? emptyToNull(data.badgeLabel) : null,
        indexable: data.indexable,
        warrantyMonths: data.warrantyMonths ?? null,
        returnDays: data.returnDays ?? null,
      };

      const product = data.id
        ? await tx.product.update({ where: { id: data.id }, data: productData })
        : await tx.product.create({ data: productData });

      await upsertLocaleCopy(tx, product.id, "ka", data.translations.ka, true);
      if (data.translations.en) await upsertLocaleCopy(tx, product.id, "en", data.translations.en, false);
      if (data.translations.ru) await upsertLocaleCopy(tx, product.id, "ru", data.translations.ru, false);

      const incomingImageIds = data.images.map((image) => image.id).filter((id): id is string => Boolean(id));
      const staleImages = await tx.productImage.findMany({
        where: {
          productId: product.id,
          ...(incomingImageIds.length ? { id: { notIn: incomingImageIds } } : {}),
        },
        select: { objectKey: true },
      });
      await tx.productImage.deleteMany({
        where: {
          productId: product.id,
          ...(incomingImageIds.length ? { id: { notIn: incomingImageIds } } : {}),
        },
      });

      for (const [index, image] of data.images.entries()) {
        const sortOrder = image.sortOrder ?? index;
        const alt = image.alt.trim() || data.translations.ka.name;
        if (image.id) {
          const existing = await tx.productImage.findFirst({
            where: { id: image.id, productId: product.id },
            select: { id: true, url: true, objectKey: true },
          });
          if (!existing) continue;
          await tx.productImage.update({
            where: { id: existing.id },
            data: {
              sortOrder,
              url: existing.objectKey ? existing.url : image.url.trim(),
            },
          });
          await tx.productImageTranslation.upsert({
            where: { imageId_locale: { imageId: existing.id, locale: "ka" } },
            create: { imageId: existing.id, locale: "ka", alt },
            update: { alt },
          });
        } else {
          const objectKey =
            image.objectKey && isManagedProductImageKey(image.objectKey) ? image.objectKey : null;
          const created = await tx.productImage.create({
            data: {
              productId: product.id,
              url: image.url.trim(),
              objectKey,
              sortOrder,
              translations: { create: { locale: "ka", alt } },
            },
          });
          incomingImageIds.push(created.id);
        }
      }

      const incomingVariantIds = data.variants.map((variant) => variant.id).filter((id): id is string => Boolean(id));
      await tx.productVariant.deleteMany({
        where: {
          productId: product.id,
          ...(incomingVariantIds.length ? { id: { notIn: incomingVariantIds } } : {}),
        },
      });

      for (const variant of data.variants) {
        const priceOverride = parseOptionalMoney(variant.priceOverride);
        const optionIds = [...new Set(variant.optionIds)];
        if (optionIds.length) {
          const options = await tx.variantAttributeOption.findMany({
            where: { id: { in: optionIds } },
            select: { id: true },
          });
          if (options.length !== optionIds.length) {
            throw new Error("INVALID_VARIANT_OPTION");
          }
        }

        const variantRow = variant.id
          ? await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                sku: variant.sku,
                priceOverride,
                stockQuantity: 0,
                isActive: variant.isActive,
              },
            })
          : await tx.productVariant.create({
              data: {
                productId: product.id,
                sku: variant.sku,
                priceOverride,
                stockQuantity: 0,
                isActive: variant.isActive,
              },
            });

        await tx.productVariantOption.deleteMany({ where: { variantId: variantRow.id } });
        if (optionIds.length) {
          await tx.productVariantOption.createMany({
            data: optionIds.map((optionId) => ({ variantId: variantRow.id, optionId })),
          });
        }
      }

      const resolvedSpecIds: string[] = [];
      const specCache = createSpecWriteCache();
      for (const spec of specPlan.rows) {
        let specificationId = spec.specificationId;
        if (!specificationId) {
          specificationId = (await findOrCreateSpecificationDefinition(tx, spec.specificationName, specCache)).id;
        } else {
          const definition = await tx.specificationDefinition.findUnique({
            where: { id: specificationId },
            select: { id: true },
          });
          if (!definition) {
            throw new Error("INVALID_SPEC_DEFINITION");
          }
        }
        const library = await findOrCreateSpecificationValue(tx, specificationId, spec.value, specCache);
        resolvedSpecIds.push(specificationId);
        await tx.productSpecification.upsert({
          where: {
            productId_specificationId: { productId: product.id, specificationId },
          },
          create: {
            productId: product.id,
            specificationId,
            value: library.name,
            valueId: library.id,
            numericValue: specNumeric(library.name),
          },
          update: {
            value: library.name,
            valueId: library.id,
            numericValue: specNumeric(library.name),
          },
        });
      }

      if (resolvedSpecIds.length) {
        await tx.productSpecification.deleteMany({
          where: { productId: product.id, specificationId: { notIn: resolvedSpecIds } },
        });
      } else if (specPlan.clearAll) {
        await tx.productSpecification.deleteMany({ where: { productId: product.id } });
      }

      return {
        id: product.id,
        staleObjectKeys: staleImages.map((row) => row.objectKey).filter((key): key is string => Boolean(key)),
      };
    },
      { maxWait: 15_000, timeout: 60_000 },
    );

    for (const objectKey of saved.staleObjectKeys) {
      try {
        await deleteProductImageObject(objectKey);
      } catch (error) {
        logError("admin.r2_cleanup_after_save_failed", { error });
      }
    }

    revalidateCatalogue({ productSlug: data.slug });
    return { ok: true, data: { id: saved.id } };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_VARIANT_OPTION") {
      return { ok: false, message: "არჩეული ვარიანტის მნიშვნელობა არასწორია" };
    }
    if (error instanceof Error && error.message === "INVALID_SPEC_DEFINITION") {
      return { ok: false, message: "არჩეული სპეციფიკაცია აღარ არსებობს. აირჩიეთ თავიდან." };
    }
    if (error instanceof Error && (error.message === "INVALID_SPEC_NAME" || error.message === "INVALID_SPEC_VALUE")) {
      return { ok: false, message: "სპეციფიკაციის დასახელება ან მნიშვნელობა არასწორია" };
    }
    const unique = uniqueMessage(error);
    if (unique) return { ok: false, message: unique };
    logError("admin.save_product_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function deactivateAdminProduct(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "პროდუქტი ვერ მოიძებნა" };

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, slug: true },
  });
  if (!product) return { ok: false, message: "პროდუქტი ვერ მოიძებნა" };

  await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
  revalidateCatalogue({ productSlug: product.slug });
  return { ok: true };
}

export async function archiveAdminProduct(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "პროდუქტი ვერ მოიძებნა" };

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, slug: true, deletedAt: true },
  });
  if (!product) return { ok: false, message: "პროდუქტი ვერ მოიძებნა" };
  if (product.deletedAt) return { ok: true };

  await prisma.product.update({
    where: { id: product.id },
    data: productArchiveData(),
  });
  revalidateCatalogue({ productSlug: product.slug });
  return { ok: true };
}

export async function restoreAdminProduct(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "პროდუქტი ვერ მოიძებნა" };

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, slug: true },
  });
  if (!product) return { ok: false, message: "პროდუქტი ვერ მოიძებნა" };

  await prisma.product.update({
    where: { id: product.id },
    data: productRestoreData(),
  });
  revalidateCatalogue({ productSlug: product.slug });
  return { ok: true };
}

export async function createAdminVariantOption(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string; slug: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminVariantOptionCreateSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }
  try {
    const option = await createReusableVariantOption(parsed.data.attributeId, parsed.data.name);
    revalidateCatalogue();
    return { ok: true, data: option };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { ok: false, message: "ატრიბუტი ვერ მოიძებნა" };
    }
    if (error instanceof Error && error.message === "INVALID_OPTION_NAME") {
      return { ok: false, message: "შეიყვანეთ ფერის დასახელება" };
    }
    logError("admin.create_variant_option_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function createAdminSpecification(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminSpecificationCreateSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }
  try {
    const created = await prisma.$transaction((tx) => findOrCreateSpecificationDefinition(tx, parsed.data.name));
    revalidateCatalogue();
    return { ok: true, data: created };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SPEC_NAME") {
      return { ok: false, message: "შეიყვანეთ სპეციფიკაციის დასახელება" };
    }
    logError("admin.create_specification_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function createAdminSpecificationValue(
  input: unknown,
): Promise<ActionResult<{ id: string; name: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminSpecificationValueCreateSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }
  try {
    const definition = await prisma.specificationDefinition.findUnique({
      where: { id: parsed.data.specificationId },
      select: { id: true },
    });
    if (!definition) return { ok: false, message: "სპეციფიკაცია ვერ მოიძებნა" };
    const created = await prisma.$transaction((tx) =>
      findOrCreateSpecificationValue(tx, parsed.data.specificationId, parsed.data.name),
    );
    revalidateCatalogue();
    return { ok: true, data: created };
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_SPEC_VALUE") {
      return { ok: false, message: "შეიყვანეთ მნიშვნელობა" };
    }
    logError("admin.create_specification_value_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function renameAdminSpecification(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminSpecificationRenameSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }
  try {
    await renameSpecificationDefinition(parsed.data.id, parsed.data.name);
    revalidateCatalogue();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return { ok: false, message: "სპეციფიკაცია ვერ მოიძებნა" };
    if (error instanceof Error && error.message === "DUPLICATE") return { ok: false, message: "ასეთი სპეციფიკაცია უკვე არსებობს" };
    if (error instanceof Error && error.message === "INVALID_SPEC_NAME") return { ok: false, message: "შეიყვანეთ დასახელება" };
    logError("admin.rename_specification_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function renameAdminSpecificationValue(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminSpecificationRenameSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }
  try {
    await renameSpecificationValue(parsed.data.id, parsed.data.name);
    revalidateCatalogue();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return { ok: false, message: "მნიშვნელობა ვერ მოიძებნა" };
    if (error instanceof Error && error.message === "DUPLICATE") return { ok: false, message: "ასეთი მნიშვნელობა უკვე არსებობს" };
    if (error instanceof Error && error.message === "INVALID_SPEC_VALUE") return { ok: false, message: "შეიყვანეთ მნიშვნელობა" };
    logError("admin.rename_specification_value_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function deleteAdminSpecificationValue(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "მნიშვნელობა ვერ მოიძებნა" };
  try {
    await deleteUnusedSpecificationValue(parsed.data.id);
    revalidateCatalogue();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return { ok: false, message: "მნიშვნელობა ვერ მოიძებნა" };
    if (error instanceof Error && error.message === "IN_USE") {
      return { ok: false, message: "მნიშვნელობა გამოიყენება პროდუქტზე და ვერ წაიშლება" };
    }
    logError("admin.delete_specification_value_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function deleteAdminSpecification(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "სპეციფიკაცია ვერ მოიძებნა" };
  try {
    await deleteUnusedSpecificationDefinition(parsed.data.id);
    revalidateCatalogue();
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") return { ok: false, message: "სპეციფიკაცია ვერ მოიძებნა" };
    if (error instanceof Error && error.message === "IN_USE") {
      return { ok: false, message: "სპეციფიკაცია გამოიყენება პროდუქტზე და ვერ წაიშლება" };
    }
    logError("admin.delete_specification_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function saveAdminCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminCategorySaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message, fieldErrors } = firstZodMessage(parsed.error);
    return { ok: false, message, fieldErrors };
  }
  const data = parsed.data;
  const parentId = emptyToNull(data.parentId ?? "");

  if (data.id && parentId && (await categoryWouldCycle(data.id, parentId))) {
    return { ok: false, message: "კატეგორია ვერ იქნება საკუთარი მშობელი ან შთამომავალი", fieldErrors: { parentId: "აირჩიეთ სხვა მშობელი კატეგორია" } };
  }
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!parent) return { ok: false, message: "მშობელი კატეგორია ვერ მოიძებნა", fieldErrors: { parentId: "აირჩიეთ არსებული კატეგორია" } };
  }

  let slug = data.slug.trim();
  if (!data.id) {
    // Create: auto-generate Latin slug from Georgian name when admin left slug blank.
    if (!slug) slug = categorySlugFromName(data.translations.ka.name);
    const reserved = new Set(
      (await prisma.category.findMany({ select: { slug: true } })).map((row) => row.slug),
    );
    slug = ensureUniqueCategorySlug(slug, reserved);
  } else if (!slug) {
    return { ok: false, message: "შეიყვანეთ slug", fieldErrors: { slug: "შეიყვანეთ slug" } };
  }
  // Updates keep the submitted slug (stable URLs on rename). Never accept Georgian characters.
  if (containsGeorgianCharacters(slug) || !isCanonicalCategorySlug(slug)) {
    return {
      ok: false,
      message: "Slug უნდა იყოს lowercase Latin kebab-case და არ შეიცავდეს ქართულ ასოებს",
      fieldErrors: { slug: "მაგ: blenderi" },
    };
  }

  const writeTranslations = async (tx: Prisma.TransactionClient, categoryId: string) => {
    await tx.categoryTranslation.upsert({
      where: { categoryId_locale: { categoryId, locale: "ka" } },
      create: {
        categoryId,
        locale: "ka",
        name: data.translations.ka.name,
        description: emptyToNull(data.translations.ka.description),
        seoTitle: emptyToNull(data.translations.ka.seoTitle),
        seoDescription: emptyToNull(data.translations.ka.seoDescription),
      },
      update: {
        name: data.translations.ka.name,
        description: emptyToNull(data.translations.ka.description),
        seoTitle: emptyToNull(data.translations.ka.seoTitle),
        seoDescription: emptyToNull(data.translations.ka.seoDescription),
      },
    });
    for (const locale of ["en", "ru"] as const) {
      const copy = data.translations[locale];
      const name = copy?.name?.trim() ?? "";
      if (!name) {
        await tx.categoryTranslation.deleteMany({ where: { categoryId, locale } });
        continue;
      }
      await tx.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId, locale } },
        create: {
          categoryId,
          locale,
          name,
          description: emptyToNull(copy?.description),
          seoTitle: emptyToNull(copy?.seoTitle),
          seoDescription: emptyToNull(copy?.seoDescription),
        },
        update: {
          name,
          description: emptyToNull(copy?.description),
          seoTitle: emptyToNull(copy?.seoTitle),
          seoDescription: emptyToNull(copy?.seoDescription),
        },
      });
    }
  };

  try {
    const id = await prisma.$transaction(async (tx) => {
      let sortOrder = data.sortOrder;
      if (!data.id) {
        // New categories default to ROOT; append after existing siblings under the chosen parent.
        const parentKey = parentId;
        const max = await tx.category.aggregate({
          where: { parentId: parentKey },
          _max: { sortOrder: true },
        });
        sortOrder = (max._max.sortOrder ?? -1) + 1;
      }
      const payload = {
        slug,
        parentId,
        imageUrl: emptyToNull(data.imageUrl),
        iconKey: emptyToNull(data.iconKey),
        sortOrder,
        isActive: data.isActive,
        indexable: data.indexable,
        showInMainNav: data.showInMainNav,
        navSortOrder: data.navSortOrder,
        showOnHomepage: data.showOnHomepage,
        homepageSortOrder: data.homepageSortOrder,
      };
      const category = data.id
        ? await tx.category.update({ where: { id: data.id }, data: payload })
        : await tx.category.create({ data: payload });
      await writeTranslations(tx, category.id);
      return category.id;
    });
    revalidateCatalogue({ categorySlug: slug });
    return { ok: true, data: { id } };
  } catch (error) {
    const unique = uniqueMessage(error);
    if (unique) return { ok: false, message: unique };
    logError("admin.save_category_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

/**
 * Persist a drag/drop hierarchy change.
 * Updates ONLY parentId + sortOrder. Never changes slug or product assignments.
 */
export async function moveAdminCategoryTree(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminCategoryTreeMoveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "კატეგორიის გადაადგილება ვერ მოხერხდა" };
  }

  const all = await prisma.category.findMany({
    select: { id: true, parentId: true, sortOrder: true, slug: true },
  });
  const plan = planCategoryTreeMove({
    nodes: all,
    categoryId: parsed.data.categoryId,
    newParentId: parsed.data.newParentId,
    indexAmongSiblings: parsed.data.indexAmongSiblings,
  });
  if (!plan.ok) {
    if (plan.code === "UNCHANGED") return { ok: true };
    return { ok: false, message: plan.message };
  }

  // Defense in depth: never write a slug field from this path.
  try {
    await prisma.$transaction(
      plan.updates.map((update) =>
        prisma.category.update({
          where: { id: update.id },
          data: { parentId: update.parentId, sortOrder: update.sortOrder },
        }),
      ),
    );
    const moved = all.find((row) => row.id === parsed.data.categoryId);
    revalidateCatalogue({ categorySlug: moved?.slug });
    return { ok: true };
  } catch (error) {
    logError("admin.move_category_tree_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function deleteAdminCategory(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "კატეგორია ვერ მოიძებნა" };

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      slug: true,
      parentId: true,
      _count: { select: { products: true, children: true } },
    },
  });
  if (!category) return { ok: false, message: "კატეგორია ვერ მოიძებნა" };

  const check = canDeleteCategory({
    childCount: category._count.children,
    productCount: category._count.products,
  });
  if (!check.ok) return { ok: false, message: check.message };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id: category.id } });
      const siblings = await tx.category.findMany({
        where: { parentId: category.parentId },
        select: { id: true },
        orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      });
      await Promise.all(
        siblings.map((row, index) =>
          tx.category.update({ where: { id: row.id }, data: { sortOrder: index } }),
        ),
      );
    });
    revalidateCatalogue({ categorySlug: category.slug });
    return { ok: true };
  } catch (error) {
    logError("admin.delete_category_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function setAdminCategoryActive(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.extend({ isActive: adminCategorySaveSchema.shape.isActive }).safeParse({
    ...(typeof input === "object" && input ? input : {}),
  });
  if (!parsed.success) return { ok: false, message: "კატეგორია ვერ მოიძებნა" };

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, slug: true },
  });
  if (!category) return { ok: false, message: "კატეგორია ვერ მოიძებნა" };
  await prisma.category.update({ where: { id: category.id }, data: { isActive: parsed.data.isActive } });
  revalidateCatalogue({ categorySlug: category.slug });
  return { ok: true };
}

export async function setAdminCategoryMainNav(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.extend({ showInMainNav: adminCategorySaveSchema.shape.showInMainNav }).safeParse({
    ...(typeof input === "object" && input ? input : {}),
  });
  if (!parsed.success) return { ok: false, message: "კატეგორია ვერ მოიძებნა" };

  const category = await prisma.category.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, slug: true, sortOrder: true, navSortOrder: true },
  });
  if (!category) return { ok: false, message: "კატეგორია ვერ მოიძებნა" };
  await prisma.category.update({
    where: { id: category.id },
    data: {
      showInMainNav: parsed.data.showInMainNav,
      ...(parsed.data.showInMainNav && category.navSortOrder === 0 ? { navSortOrder: category.sortOrder } : {}),
    },
  });
  revalidateCatalogue({ categorySlug: category.slug });
  return { ok: true };
}

export async function saveAdminBrand(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminBrandSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message, fieldErrors } = firstZodMessage(parsed.error);
    return { ok: false, message, fieldErrors };
  }
  const data = parsed.data;

  try {
    const id = await prisma.$transaction(async (tx) => {
      const payload = {
        slug: data.slug,
        logoUrl: emptyToNull(data.logoUrl),
        indexable: data.indexable,
        sortOrder: data.sortOrder,
        showOnHomepage: data.showOnHomepage,
        homepageSortOrder: data.homepageSortOrder,
      };
      const brand = data.id
        ? await tx.brand.update({ where: { id: data.id }, data: payload })
        : await tx.brand.create({ data: payload });

      await tx.brandTranslation.upsert({
        where: { brandId_locale: { brandId: brand.id, locale: "ka" } },
        create: {
          brandId: brand.id,
          locale: "ka",
          name: data.translations.ka.name,
          description: emptyToNull(data.translations.ka.description),
          seoTitle: emptyToNull(data.translations.ka.seoTitle),
          seoDescription: emptyToNull(data.translations.ka.seoDescription),
        },
        update: {
          name: data.translations.ka.name,
          description: emptyToNull(data.translations.ka.description),
          seoTitle: emptyToNull(data.translations.ka.seoTitle),
          seoDescription: emptyToNull(data.translations.ka.seoDescription),
        },
      });

      for (const locale of ["en", "ru"] as const) {
        const copy = data.translations[locale];
        const name = copy?.name?.trim() ?? "";
        if (!name) {
          await tx.brandTranslation.deleteMany({ where: { brandId: brand.id, locale } });
          continue;
        }
        await tx.brandTranslation.upsert({
          where: { brandId_locale: { brandId: brand.id, locale } },
          create: {
            brandId: brand.id,
            locale,
            name,
            description: emptyToNull(copy?.description),
            seoTitle: emptyToNull(copy?.seoTitle),
            seoDescription: emptyToNull(copy?.seoDescription),
          },
          update: {
            name,
            description: emptyToNull(copy?.description),
            seoTitle: emptyToNull(copy?.seoTitle),
            seoDescription: emptyToNull(copy?.seoDescription),
          },
        });
      }

      return brand.id;
    });
    revalidateCatalogue({ brandSlug: data.slug });
    return { ok: true, data: { id } };
  } catch (error) {
    const unique = uniqueMessage(error);
    if (unique) return { ok: false, message: unique };
    logError("admin.save_brand_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function deleteAdminBrand(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "ბრენდი ვერ მოიძებნა" };

  const brand = await prisma.brand.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { products: true } } },
  });
  if (!brand) return { ok: false, message: "ბრენდი ვერ მოიძებნა" };
  if (brand._count.products > 0) {
    return {
      ok: false,
      message: `ბრენდის წაშლა შეუძლებელია — მასზე მიბმულია ${brand._count.products} პროდუქტი. შეცვალეთ პროდუქტების ბრენდი ან გამორთეთ პროდუქტები.`,
    };
  }

  try {
    await prisma.brand.delete({ where: { id: brand.id } });
    revalidateCatalogue();
    return { ok: true };
  } catch (error) {
    logError("admin.delete_brand_failed", { error });
    return { ok: false, message: "ბრენდის წაშლა ვერ მოხერხდა, რადგან მას სხვა ჩანაწერები უკავშირდება." };
  }
}

export async function saveAdminPromotion(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminPromotionSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message, fieldErrors } = firstZodMessage(parsed.error);
    return { ok: false, message, fieldErrors };
  }
  const data = parsed.data;
  const code = data.code.trim().toUpperCase();

  try {
    const id = await prisma.$transaction(async (tx) => {
      const payload = {
        code,
        type: data.type,
        value: parseMoneyInput(data.value),
        minOrderAmount: parseOptionalMoney(data.minOrderAmount),
        usageLimit: parseOptionalInt(data.usageLimit ?? null),
        startsAt: parseOptionalDate(data.startsAt),
        endsAt: parseOptionalDate(data.endsAt),
        isActive: data.isActive,
      };
      const promotion = data.id
        ? await tx.promotion.update({ where: { id: data.id }, data: payload })
        : await tx.promotion.create({ data: payload });

      await tx.promotionTranslation.upsert({
        where: { promotionId_locale: { promotionId: promotion.id, locale: "ka" } },
        create: {
          promotionId: promotion.id,
          locale: "ka",
          name: data.name,
          description: emptyToNull(data.description),
        },
        update: {
          name: data.name,
          description: emptyToNull(data.description),
        },
      });
      return promotion.id;
    });
    revalidatePromotions();
    return { ok: true, data: { id } };
  } catch (error) {
    const unique = uniqueMessage(error);
    if (unique) return { ok: false, message: unique };
    logError("admin.save_promotion_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function setAdminPromotionActive(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "აქცია ვერ მოიძებნა" };
  const isActive =
    typeof input === "object" && input && "isActive" in input ? Boolean((input as { isActive: unknown }).isActive) : null;
  if (isActive == null) return { ok: false, message: "არასწორი მოთხოვნა" };

  const promotion = await prisma.promotion.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
  if (!promotion) return { ok: false, message: "აქცია ვერ მოიძებნა" };
  await prisma.promotion.update({ where: { id: promotion.id }, data: { isActive } });
  revalidatePromotions();
  return { ok: true };
}

export async function updateAdminOrderStatus(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "შეკვეთის სტატუსი არასწორია" };
  }

  const order = await prisma.order.findUnique({
    where: { id: parsed.data.orderId },
    select: { id: true, orderStatus: true },
  });
  if (!order) return { ok: false, message: "შეკვეთა ვერ მოიძებნა" };

  if (order.orderStatus === parsed.data.orderStatus) {
    return { ok: true };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { orderStatus: parsed.data.orderStatus },
    });
    if (parsed.data.orderStatus === "cancelled") {
      await applyInventoryEvent(tx, order.id, "unpaid_terminal");
      await applyPromoEvent(tx, order.id, "unpaid_terminal");
    }
  });
  revalidateOrders();
  if (shouldSendOrderStatusEmail(order.orderStatus, parsed.data.orderStatus)) {
    scheduleEmail(() => notifyOrderStatus(order.id, parsed.data.orderStatus));
  }
  return { ok: true };
}

export type AdminUploadedImage = {
  id: string;
  url: string;
  alt: string;
  sortOrder: number;
  objectKey: string | null;
};

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function uploadAdminProductImage(formData: FormData): Promise<ActionResult<AdminUploadedImage>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;

  const config = getR2Config();
  if (!config) return { ok: false, message: STORAGE_NOT_CONFIGURED };

  const productId = String(formData.get("productId") ?? "").trim();
  const altRaw = String(formData.get("alt") ?? "").trim();
  const file = formData.get("file");
  if (!isUploadFile(file)) {
    return { ok: false, message: "ატვირთეთ სურათის ფაილი" };
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, message: "სურათი ძალიან დიდია (მაქსიმუმ 10 MB)" };
  }

  const product = productId
    ? await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          slug: true,
          translations: { where: { locale: "ka" }, select: { name: true } },
        },
      })
    : null;
  if (productId && !product) return { ok: false, message: "პროდუქტი ვერ მოიძებნა" };

  const bytes = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await processProductImage(bytes);
  } catch (error) {
    if (error instanceof ProductImageValidationError) return { ok: false, message: error.message };
    logError("admin.process_image_failed", { error });
    return { ok: false, message: "სურათის დამუშავება ვერ მოხერხდა" };
  }

  let objectKey: string;
  try {
    objectKey = product
      ? createProductImageObjectKey(product.id)
      : createPendingProductImageObjectKey();
  } catch {
    return { ok: false, message: "პროდუქტის იდენტიფიკატორი არასწორია" };
  }

  try {
    await putProductImageObject(objectKey, processed);
  } catch (error) {
    logError("admin.r2_put_failed", { error });
    return { ok: false, message: "სურათის შენახვა საცავში ვერ მოხერხდა" };
  }

  const url = publicUrlForObjectKey(config.publicBaseUrl, objectKey);
  const alt = altRaw || product?.translations[0]?.name || "";

  // New product form: keep the file in R2 only; ProductImage rows are created on save.
  if (!product) {
    return {
      ok: true,
      data: { id: "", url, alt, sortOrder: 0, objectKey },
    };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const maxSort = await tx.productImage.aggregate({
        where: { productId: product.id },
        _max: { sortOrder: true },
      });
      const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
      return tx.productImage.create({
        data: {
          productId: product.id,
          url,
          objectKey,
          sortOrder,
          translations: { create: { locale: "ka", alt } },
        },
      });
    });
    revalidateCatalogue({ productSlug: product.slug });
    return {
      ok: true,
      data: { id: created.id, url: created.url, alt, sortOrder: created.sortOrder, objectKey },
    };
  } catch (error) {
    logError("admin.product_image_insert_failed", { error });
    try {
      await deleteProductImageObject(objectKey);
    } catch (cleanupError) {
      logError("admin.r2_compensation_delete_failed", { error: cleanupError });
    }
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function discardAdminPendingProductImage(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;

  const objectKey =
    input && typeof input === "object" && "objectKey" in input
      ? String((input as { objectKey?: unknown }).objectKey ?? "").trim()
      : "";
  if (!objectKey || !isPendingProductImageKey(objectKey)) {
    return { ok: false, message: "სურათი ვერ მოიძებნა" };
  }

  const linked = await prisma.productImage.findFirst({
    where: { objectKey },
    select: { id: true },
  });
  if (linked) {
    return { ok: false, message: "სურათი უკვე მიბმულია პროდუქტზე" };
  }

  try {
    await deleteProductImageObject(objectKey);
  } catch (error) {
    logError("admin.r2_pending_delete_failed", { error });
    return { ok: false, message: "სურათის წაშლა საცავიდან ვერ მოხერხდა" };
  }
  return { ok: true };
}

export async function deleteAdminProductImage(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "სურათი ვერ მოიძებნა" };

  const image = await prisma.productImage.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, objectKey: true, product: { select: { slug: true } } },
  });
  if (!image) return { ok: false, message: "სურათი ვერ მოიძებნა" };

  await prisma.productImage.delete({ where: { id: image.id } });
  if (image.objectKey) {
    try {
      await deleteProductImageObject(image.objectKey);
    } catch (error) {
      logError("admin.r2_delete_failed", { error });
    }
  }
  revalidateCatalogue({ productSlug: image.product.slug });
  return { ok: true };
}

export async function reorderAdminProductImages(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminProductImageReorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "სურათების რიგი არასწორია" };

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true, slug: true, images: { select: { id: true } } },
  });
  if (!product) return { ok: false, message: "პროდუქტი ვერ მოიძებნა" };

  const existingIds = new Set(product.images.map((row) => row.id));
  if (parsed.data.orderedIds.length !== existingIds.size) {
    return { ok: false, message: "სურათების რიგი არ ემთხვევა არსებულ ჩანაწერებს" };
  }
  if (parsed.data.orderedIds.some((id) => !existingIds.has(id))) {
    return { ok: false, message: "სურათი ამ პროდუქტს არ ეკუთვნის" };
  }

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.productImage.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  // Targeted storefront paths only — full catalogue/admin layout revalidation made
  // each up/down click feel like ~15s while the admin editor waited on the action.
  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/product/[slug]", "page");
  revalidatePath("/");
  revalidatePath("/search");
  return { ok: true };
}

export async function updateAdminProductImageAlt(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminProductImageAltSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Alt ტექსტი არასწორია" };

  const image = await prisma.productImage.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, product: { select: { slug: true, translations: { where: { locale: "ka" }, select: { name: true } } } } },
  });
  if (!image) return { ok: false, message: "სურათი ვერ მოიძებნა" };

  const alt = parsed.data.alt.trim() || image.product.translations[0]?.name || "";
  await prisma.productImageTranslation.upsert({
    where: { imageId_locale: { imageId: image.id, locale: "ka" } },
    create: { imageId: image.id, locale: "ka", alt },
    update: { alt },
  });
  revalidateCatalogue({ productSlug: image.product.slug });
  return { ok: true };
}

export async function saveAdminHeroSlide(input: unknown): Promise<ActionResult<{ id: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminHeroSlideSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message, fieldErrors } = firstZodMessage(parsed.error);
    return { ok: false, message, fieldErrors };
  }
  const data = parsed.data;
  const href = normalizeMerchHref(data.href);
  if (data.href.trim() && !href) {
    return { ok: false, message: "გადამისამართების ბმული არასწორია", fieldErrors: { href: "შეიყვანეთ შიდა გზა ან http(s) ბმული" } };
  }

  try {
    const slide = data.id
      ? await prisma.heroSlide.update({
          where: { id: data.id },
          data: {
            imageUrl: data.imageUrl.trim(),
            ...(data.objectKey !== undefined ? { objectKey: emptyToNull(data.objectKey ?? "") } : {}),
            href,
            sortOrder: data.sortOrder,
            isActive: data.isActive,
          },
        })
      : await prisma.heroSlide.create({
          data: {
            imageUrl: data.imageUrl.trim(),
            objectKey: emptyToNull(data.objectKey ?? ""),
            href,
            sortOrder: data.sortOrder,
            isActive: data.isActive,
          },
        });
    revalidateHero();
    return { ok: true, data: { id: slide.id } };
  } catch (error) {
    logError("admin.save_hero_slide_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function deleteAdminHeroSlide(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "სლაიდი ვერ მოიძებნა" };

  const slide = await prisma.heroSlide.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, objectKey: true },
  });
  if (!slide) return { ok: false, message: "სლაიდი ვერ მოიძებნა" };

  await prisma.heroSlide.delete({ where: { id: slide.id } });
  if (slide.objectKey) {
    try {
      await deleteProductImageObject(slide.objectKey);
    } catch (error) {
      logError("admin.hero_image_delete_failed", { error });
    }
  }
  revalidateHero();
  return { ok: true };
}

export async function reorderAdminHeroSlides(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = adminHeroReorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "რიგი არასწორია" };

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.heroSlide.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidateHero();
  return { ok: true };
}

export async function uploadAdminHeroImage(formData: FormData): Promise<ActionResult<{ url: string; objectKey: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;

  const config = getR2Config();
  if (!config) return { ok: false, message: STORAGE_NOT_CONFIGURED };

  const file = formData.get("file");
  if (!isUploadFile(file)) return { ok: false, message: "ატვირთეთ სურათის ფაილი" };
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, message: "სურათი ძალიან დიდია (მაქსიმუმ 10 MB)" };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await processProductImage(bytes);
  } catch (error) {
    if (error instanceof ProductImageValidationError) return { ok: false, message: error.message };
    logError("admin.process_hero_image_failed", { error });
    return { ok: false, message: "სურათის დამუშავება ვერ მოხერხდა" };
  }

  const objectKey = createHeroImageObjectKey();
  try {
    await putProductImageObject(objectKey, processed);
  } catch (error) {
    logError("admin.r2_hero_put_failed", { error });
    return { ok: false, message: "სურათის შენახვა საცავში ვერ მოხერხდა" };
  }

  return {
    ok: true,
    data: { url: publicUrlForObjectKey(config.publicBaseUrl, objectKey), objectKey },
  };
}

export async function uploadAdminBrandLogo(formData: FormData): Promise<ActionResult<{ url: string; objectKey: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;

  const config = getR2Config();
  if (!config) return { ok: false, message: STORAGE_NOT_CONFIGURED };

  const brandId = String(formData.get("brandId") ?? "").trim();
  const file = formData.get("file");
  if (!brandId || !isUploadFile(file)) return { ok: false, message: "ატვირთეთ სურათის ფაილი" };
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, message: "სურათი ძალიან დიდია (მაქსიმუმ 10 MB)" };
  }

  const brand = await prisma.brand.findUnique({ where: { id: brandId }, select: { id: true, logoObjectKey: true, slug: true } });
  if (!brand) return { ok: false, message: "ბრენდი ვერ მოიძებნა" };

  const bytes = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await processProductImage(bytes);
  } catch (error) {
    if (error instanceof ProductImageValidationError) return { ok: false, message: error.message };
    return { ok: false, message: "სურათის დამუშავება ვერ მოხერხდა" };
  }

  let objectKey: string;
  try {
    objectKey = createBrandLogoObjectKey(brand.id);
  } catch {
    return { ok: false, message: "ბრენდის იდენტიფიკატორი არასწორია" };
  }

  try {
    await putProductImageObject(objectKey, processed);
  } catch (error) {
    logError("admin.r2_brand_put_failed", { error });
    return { ok: false, message: "სურათის შენახვა საცავში ვერ მოხერხდა" };
  }

  const url = publicUrlForObjectKey(config.publicBaseUrl, objectKey);
  await prisma.brand.update({
    where: { id: brand.id },
    data: { logoUrl: url, logoObjectKey: objectKey },
  });
  if (brand.logoObjectKey && brand.logoObjectKey !== objectKey) {
    try {
      await deleteProductImageObject(brand.logoObjectKey);
    } catch (error) {
      logError("admin.brand_logo_cleanup_failed", { error });
    }
  }
  revalidateCatalogue({ brandSlug: brand.slug });
  return { ok: true, data: { url, objectKey } };
}

export async function uploadAdminCategoryImage(formData: FormData): Promise<ActionResult<{ url: string; objectKey: string }>> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;

  const config = getR2Config();
  if (!config) return { ok: false, message: STORAGE_NOT_CONFIGURED };

  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const file = formData.get("file");
  if (!categoryId || !isUploadFile(file)) return { ok: false, message: "ატვირთეთ სურათის ფაილი" };
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return { ok: false, message: "სურათი ძალიან დიდია (მაქსიმუმ 10 MB)" };
  }

  const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true, slug: true } });
  if (!category) return { ok: false, message: "კატეგორია ვერ მოიძებნა" };

  const bytes = Buffer.from(await file.arrayBuffer());
  let processed: Buffer;
  try {
    processed = await processProductImage(bytes);
  } catch (error) {
    if (error instanceof ProductImageValidationError) return { ok: false, message: error.message };
    return { ok: false, message: "სურათის დამუშავება ვერ მოხერხდა" };
  }

  let objectKey: string;
  try {
    objectKey = createCategoryImageObjectKey(category.id);
  } catch {
    return { ok: false, message: "კატეგორიის იდენტიფიკატორი არასწორია" };
  }

  try {
    await putProductImageObject(objectKey, processed);
  } catch (error) {
    logError("admin.r2_category_put_failed", { error });
    return { ok: false, message: "სურათის შენახვა საცავში ვერ მოხერხდა" };
  }

  const url = publicUrlForObjectKey(config.publicBaseUrl, objectKey);
  await prisma.category.update({ where: { id: category.id }, data: { imageUrl: url } });
  revalidateCatalogue({ categorySlug: category.slug });
  return { ok: true, data: { url, objectKey } };
}

export async function adminSignOut() {
  const { signOut } = await import("@/auth");
  await signOut({ redirectTo: "/login" });
}
