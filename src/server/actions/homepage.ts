"use server";

import { requireAdminAction } from "@/server/auth/admin";
import { logError } from "@/server/log";
import { firstZodMessage } from "@/server/actions/helpers";
import { GENERIC_SERVER_ERROR, type ActionResult } from "@/server/actions/result";
import {
  homepageCategoryReelSaveSchema,
  homepageFeatureBannerSaveSchema,
  homepageBrandReelSaveSchema,
  homepageMoveSectionSchema,
  homepageSectionMetaSchema,
  homepageSetEnabledSchema,
  homepageSplitBannersSaveSchema,
  homepageVisualTilesSaveSchema,
} from "@/server/validation/homepage";
import {
  moveHomepageSectionData,
  saveHomepageBrandReelData,
  saveHomepageCategoryReelData,
  saveHomepageFeatureBannerData,
  saveHomepageSectionMetaData,
  saveHomepageSplitBannersData,
  saveHomepageVisualTilesData,
  searchHomepageProducts,
  setHomepageSectionEnabledData,
  type AdminHomepageProductOption,
} from "@/server/homepage/admin";
import { revalidateHomepage } from "@/server/admin/revalidate";
import {
  STORAGE_NOT_CONFIGURED,
  createHomepageImageObjectKey,
  deleteProductImageObject,
  getR2Config,
  processProductImage,
  ProductImageValidationError,
  publicUrlForObjectKey,
  putProductImageObject,
} from "@/server/storage";
import { PRODUCT_IMAGE_MAX_BYTES } from "@/lib/productImageLimits";

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export async function moveHomepageSection(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = homepageMoveSectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "სექცია ვერ მოიძებნა" };

  const result = await moveHomepageSectionData(parsed.data.id, parsed.data.direction);
  if (!result.ok) return { ok: false, message: result.message };
  revalidateHomepage();
  return { ok: true };
}

export async function setHomepageSectionEnabled(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = homepageSetEnabledSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "სექცია ვერ მოიძებნა" };

  const ok = await setHomepageSectionEnabledData(parsed.data.id, parsed.data.enabled);
  if (!ok) return { ok: false, message: "სექცია ვერ მოიძებნა" };
  revalidateHomepage();
  return { ok: true };
}

export async function saveHomepageSectionMeta(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = homepageSectionMetaSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }

  const ok = await saveHomepageSectionMetaData(parsed.data.id, parsed.data.title);
  if (!ok) return { ok: false, message: "სექცია ვერ მოიძებნა" };
  revalidateHomepage();
  return { ok: true };
}

export async function saveHomepageSplitBanners(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = homepageSplitBannersSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }

  try {
    const ok = await saveHomepageSplitBannersData(parsed.data.sectionId, parsed.data.banners);
    if (!ok) return { ok: false, message: "სექცია ვერ მოიძებნა" };
    revalidateHomepage();
    return { ok: true };
  } catch (error) {
    logError("admin.save_homepage_split_banners_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function saveHomepageFeatureBanner(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = homepageFeatureBannerSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }

  try {
    const ok = await saveHomepageFeatureBannerData(parsed.data.sectionId, parsed.data.banner);
    if (!ok) return { ok: false, message: "სექცია ვერ მოიძებნა" };
    revalidateHomepage();
    return { ok: true };
  } catch (error) {
    logError("admin.save_homepage_feature_banner_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function saveHomepageBrandReel(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = homepageBrandReelSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }

  const ok = await saveHomepageBrandReelData(parsed.data.sectionId, parsed.data.brandIds);
  if (!ok) return { ok: false, message: "სექცია ვერ მოიძებნა" };
  revalidateHomepage();
  return { ok: true };
}

export async function saveHomepageCategoryReel(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = homepageCategoryReelSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }

  const ok = await saveHomepageCategoryReelData(
    parsed.data.sectionId,
    parsed.data.title,
    {
      categoryId: parsed.data.categoryId ?? null,
      productSource: parsed.data.productSource,
      limit: parsed.data.limit,
      viewAllHref: parsed.data.viewAllHref ?? null,
    },
    parsed.data.manualProductIds,
  );
  if (!ok) return { ok: false, message: "სექცია ვერ მოიძებნა" };
  revalidateHomepage();
  return { ok: true };
}

export async function saveHomepageVisualTiles(input: unknown): Promise<ActionResult> {
  const gate = await requireAdminAction();
  if (!gate.ok) return gate;
  const parsed = homepageVisualTilesSaveSchema.safeParse(input);
  if (!parsed.success) {
    const { message } = firstZodMessage(parsed.error);
    return { ok: false, message };
  }

  try {
    const ok = await saveHomepageVisualTilesData(parsed.data.sectionId, parsed.data.tiles);
    if (!ok) return { ok: false, message: "სექცია ვერ მოიძებნა" };
    revalidateHomepage();
    return { ok: true };
  } catch (error) {
    logError("admin.save_homepage_visual_tiles_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}

export async function uploadAdminHomepageImage(formData: FormData): Promise<ActionResult<{ url: string; objectKey: string }>> {
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
    logError("admin.process_homepage_image_failed", { error });
    return { ok: false, message: "სურათის დამუშავება ვერ მოხერხდა" };
  }

  const objectKey = createHomepageImageObjectKey();
  try {
    await putProductImageObject(objectKey, processed);
  } catch (error) {
    logError("admin.r2_homepage_put_failed", { error });
    return { ok: false, message: "სურათის შენახვა საცავში ვერ მოხერხდა" };
  }

  return { ok: true, data: { url: publicUrlForObjectKey(config.publicBaseUrl, objectKey), objectKey } };
}

export async function searchHomepageProductOptions(query: string): Promise<AdminHomepageProductOption[]> {
  const gate = await requireAdminAction();
  if (!gate.ok) return [];
  return searchHomepageProducts(query, 20);
}

export async function discardAdminHomepageImage(objectKey: string): Promise<void> {
  try {
    await deleteProductImageObject(objectKey);
  } catch (error) {
    logError("admin.r2_homepage_discard_failed", { error });
  }
}
