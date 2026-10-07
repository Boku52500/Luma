import "server-only";

import { randomUUID } from "node:crypto";

const PRODUCT_ID = /^[a-zA-Z0-9_-]{1,64}$/;
const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PRODUCT_OBJECT_KEY = new RegExp(`^products/(?:pending|[a-zA-Z0-9_-]{1,64})/${UUID}\\.webp$`, "i");
const PENDING_PRODUCT_OBJECT_KEY = new RegExp(`^products/pending/${UUID}\\.webp$`, "i");
const HERO_OBJECT_KEY = new RegExp(`^hero/${UUID}\\.webp$`, "i");
const BRAND_OBJECT_KEY = new RegExp(`^brands/[a-zA-Z0-9_-]{1,64}/${UUID}\\.webp$`, "i");
const CATEGORY_OBJECT_KEY = new RegExp(`^categories/[a-zA-Z0-9_-]{1,64}/${UUID}\\.webp$`, "i");
const HOMEPAGE_OBJECT_KEY = new RegExp(`^homepage/${UUID}\\.webp$`, "i");

export function createProductImageObjectKey(productId: string): string {
  if (!PRODUCT_ID.test(productId)) {
    throw new Error("INVALID_PRODUCT_ID");
  }
  return `products/${productId}/${randomUUID()}.webp`;
}

/** R2 key for uploads on the new-product form before a product row exists. */
export function createPendingProductImageObjectKey(): string {
  return `products/pending/${randomUUID()}.webp`;
}

export function createHeroImageObjectKey(): string {
  return `hero/${randomUUID()}.webp`;
}

export function createBrandLogoObjectKey(brandId: string): string {
  if (!PRODUCT_ID.test(brandId)) {
    throw new Error("INVALID_BRAND_ID");
  }
  return `brands/${brandId}/${randomUUID()}.webp`;
}

export function createCategoryImageObjectKey(categoryId: string): string {
  if (!PRODUCT_ID.test(categoryId)) {
    throw new Error("INVALID_CATEGORY_ID");
  }
  return `categories/${categoryId}/${randomUUID()}.webp`;
}

export function createHomepageImageObjectKey(): string {
  return `homepage/${randomUUID()}.webp`;
}

export function isManagedProductImageKey(objectKey: string): boolean {
  return PRODUCT_OBJECT_KEY.test(objectKey);
}

export function isPendingProductImageKey(objectKey: string): boolean {
  return PENDING_PRODUCT_OBJECT_KEY.test(objectKey);
}

export function isManagedMerchImageKey(objectKey: string): boolean {
  return (
    PRODUCT_OBJECT_KEY.test(objectKey) ||
    HERO_OBJECT_KEY.test(objectKey) ||
    BRAND_OBJECT_KEY.test(objectKey) ||
    CATEGORY_OBJECT_KEY.test(objectKey) ||
    HOMEPAGE_OBJECT_KEY.test(objectKey)
  );
}

export function publicUrlForObjectKey(publicBaseUrl: string, objectKey: string): string {
  return `${publicBaseUrl.replace(/\/+$/, "")}/${objectKey}`;
}
