import type { HomepageLinkType } from "@/generated/prisma/client";
import { normalizeMerchHref } from "@/lib/merchHref";

export type HomepageLinkTarget = {
  linkType: HomepageLinkType;
  href?: string | null;
  categorySlug?: string | null;
  productSlug?: string | null;
  brandSlug?: string | null;
};

/**
 * Resolve a HomepageLinkType + attached slugs to a storefront href.
 * Mirrors existing `/category/`, `/product/`, `/brand/` route patterns.
 */
export function resolveHomepageLink(target: HomepageLinkTarget): string | null {
  switch (target.linkType) {
    case "CATEGORY":
      return target.categorySlug ? `/category/${target.categorySlug}` : null;
    case "PRODUCT":
      return target.productSlug ? `/product/${target.productSlug}` : null;
    case "BRAND":
      return target.brandSlug ? `/brand/${target.brandSlug}` : null;
    case "CUSTOM":
      return normalizeMerchHref(target.href);
    case "NONE":
    default:
      return null;
  }
}
