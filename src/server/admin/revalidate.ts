import "server-only";

import { revalidatePath, updateTag } from "next/cache";
import { STOREFRONT_NAV_CACHE_TAG } from "@/server/catalog/nav";
import {
  STOREFRONT_BRANDS_CACHE_TAG,
  STOREFRONT_HERO_CACHE_TAG,
  STOREFRONT_HOMEPAGE_CATEGORIES_CACHE_TAG,
} from "@/server/catalog/merchTags";

/** Invalidate storefront + admin catalogue views after a mutation. */
export function revalidateCatalogue(opts?: { productSlug?: string; categorySlug?: string; brandSlug?: string }) {
  updateTag(STOREFRONT_NAV_CACHE_TAG);
  updateTag(STOREFRONT_HERO_CACHE_TAG);
  updateTag(STOREFRONT_BRANDS_CACHE_TAG);
  updateTag(STOREFRONT_HOMEPAGE_CATEGORIES_CACHE_TAG);
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/search");
  revalidatePath("/product/[slug]", "page");
  revalidatePath("/category/[slug]", "page");
  revalidatePath("/brand/[slug]", "page");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/products", "layout");
  revalidatePath("/admin/categories", "layout");
  if (opts?.productSlug) revalidatePath(`/product/${opts.productSlug}`);
  if (opts?.categorySlug) revalidatePath(`/category/${opts.categorySlug}`);
  if (opts?.brandSlug) {
    revalidatePath(`/brand/${opts.brandSlug}`);
    revalidatePath(`/category/${opts.brandSlug}`);
  }
}

export function revalidateHero() {
  updateTag(STOREFRONT_HERO_CACHE_TAG);
  revalidatePath("/");
  revalidatePath("/admin/hero");
}

export function revalidateOrders() {
  revalidatePath("/admin/orders", "page");
  revalidatePath("/admin/orders/[id]", "page");
  revalidatePath("/account/orders", "page");
  revalidatePath("/account/orders/[id]", "page");
  revalidatePath("/admin", "page");
}

export function revalidatePromotions() {
  revalidatePath("/admin/promotions", "layout");
  revalidatePath("/checkout");
}
