import type {
  Product,
  ProductAvailability,
  ProductBadgeData,
  ProductBadgeKind,
  ProductInstallment,
  ProductVariantGroup,
  ProductVisual,
} from "@/types/product";
import { formatSelectedVariants, getDefaultVariants } from "@/lib/cart";

export const CART_STORAGE_VERSION = 2;
export const WISHLIST_STORAGE_VERSION = 2;

const PRODUCT_VISUALS: readonly ProductVisual[] = [
  "phone",
  "laptop",
  "tablet",
  "tv",
  "monitor",
  "gaming",
  "keyboard",
  "components",
  "accessory",
  "audio",
  "smart-home",
  "network",
];

const AVAILABILITY: readonly ProductAvailability[] = ["in-stock", "low-stock", "out-of-stock"];
const BADGE_KINDS: readonly ProductBadgeKind[] = ["bestseller", "top-seller", "limited", "custom"];

export type CartVariantLabel = { groupLabel: string; optionLabel: string };

/**
 * Minimal catalogue fields persisted on a cart line.
 * `unitPrice` is the displayed price at add time — not payment-authoritative.
 * A future server checkout must revalidate against PostgreSQL before charging.
 */
export type CartProductSnapshot = {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  visual: ProductVisual;
  tone: 1 | 2 | 3 | 4 | 5;
  /** Primary product photo URL (R2/public). Optional for legacy localStorage carts. */
  imageSrc?: string;
  imageAlt?: string;
  unitPrice: number;
  previousPrice?: number;
  availability: ProductAvailability;
};

export type CartLineItem = {
  id: string;
  productId: string;
  quantity: number;
  variants: Record<string, string>;
  variantLabels: CartVariantLabel[];
  snapshot: CartProductSnapshot;
  addedAt: number;
};

export type WishlistSnapshot = {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  visual: ProductVisual;
  tone: 1 | 2 | 3 | 4 | 5;
  secondaryVisual?: ProductVisual;
  price: number;
  previousPrice?: number;
  rating: number;
  reviewCount: number;
  availability: ProductAvailability;
  isNew?: boolean;
  badge?: ProductBadgeData;
  installment?: ProductInstallment;
  variants?: ProductVariantGroup[];
};

function isProductVisual(value: unknown): value is ProductVisual {
  return typeof value === "string" && (PRODUCT_VISUALS as readonly string[]).includes(value);
}

function asVisual(value: unknown): ProductVisual {
  return isProductVisual(value) ? value : "accessory";
}

function asTone(value: unknown): 1 | 2 | 3 | 4 | 5 {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  return 1;
}

function asAvailability(value: unknown): ProductAvailability {
  if (typeof value === "string" && (AVAILABILITY as readonly string[]).includes(value)) {
    return value as ProductAvailability;
  }
  return "in-stock";
}

function asMoney(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function asPositiveInt(value: unknown, fallback = 1, max = 99): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 240) : null;
}

export function isPlainVariantMap(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((entry) => typeof entry === "string");
}

export function normalizeVariants(variants: Record<string, string> = {}): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(variants)) {
    if (typeof key === "string" && key && typeof value === "string" && value) {
      next[key] = value;
    }
  }
  return next;
}

/** Same product + same variant selection → one line; a different selection is always a separate line. */
export function buildLineId(productId: string, variants: Record<string, string>): string {
  const variantKey = Object.entries(normalizeVariants(variants))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupId, value]) => `${groupId}=${value}`)
    .join("&");
  return variantKey ? `${productId}::${variantKey}` : productId;
}

function parseVariantLabels(value: unknown): CartVariantLabel[] {
  if (!Array.isArray(value)) return [];
  const labels: CartVariantLabel[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const groupLabel = asNonEmptyString(record.groupLabel);
    const optionLabel = asNonEmptyString(record.optionLabel);
    if (groupLabel && optionLabel) labels.push({ groupLabel, optionLabel });
  }
  return labels;
}

export function primaryProductImage(product: Product): { src?: string; alt?: string } {
  const photo = product.images?.find((image) => typeof image.src === "string" && image.src.trim());
  if (!photo?.src) return {};
  const alt = asNonEmptyString(photo.alt) ?? product.name;
  return { src: photo.src.trim(), alt };
}

export function toCartProductSnapshot(product: Product): CartProductSnapshot {
  const unitPrice = asMoney(product.price) ?? 0;
  const previousPrice = product.previousPrice == null ? undefined : (asMoney(product.previousPrice) ?? undefined);
  const image = primaryProductImage(product);
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    visual: asVisual(product.visual),
    tone: asTone(product.tone),
    imageSrc: image.src,
    imageAlt: image.alt,
    unitPrice,
    previousPrice,
    availability: asAvailability(product.availability),
  };
}

export function parseCartProductSnapshot(value: unknown): CartProductSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const productId = asNonEmptyString(record.productId);
  const slug = asNonEmptyString(record.slug);
  const name = asNonEmptyString(record.name);
  const brand = asNonEmptyString(record.brand);
  const unitPrice = asMoney(record.unitPrice);
  if (!productId || !slug || !name || !brand || unitPrice == null) return null;
  const previousPrice = record.previousPrice == null ? undefined : (asMoney(record.previousPrice) ?? undefined);
  const imageSrc = asNonEmptyString(record.imageSrc) ?? undefined;
  const imageAlt = asNonEmptyString(record.imageAlt) ?? undefined;
  return {
    productId,
    slug,
    name,
    brand,
    visual: asVisual(record.visual),
    tone: asTone(record.tone),
    imageSrc,
    imageAlt,
    unitPrice,
    previousPrice,
    availability: asAvailability(record.availability),
  };
}

export function parseCartLineItem(value: unknown): CartLineItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const snapshot = parseCartProductSnapshot(record.snapshot);
  if (!snapshot) return null;
  if (!isPlainVariantMap(record.variants)) return null;
  const productId = asNonEmptyString(record.productId) ?? snapshot.productId;
  const variants = normalizeVariants(record.variants);
  const id = asNonEmptyString(record.id) ?? buildLineId(productId, variants);
  const addedAt = typeof record.addedAt === "number" && Number.isFinite(record.addedAt) ? record.addedAt : Date.now();
  return {
    id,
    productId,
    quantity: asPositiveInt(record.quantity),
    variants,
    variantLabels: parseVariantLabels(record.variantLabels),
    snapshot,
    addedAt,
  };
}

function parseBadge(value: unknown): ProductBadgeData | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.kind !== "string" || !(BADGE_KINDS as readonly string[]).includes(record.kind)) {
    return undefined;
  }
  const label = typeof record.label === "string" ? record.label.slice(0, 80) : undefined;
  return { kind: record.kind as ProductBadgeKind, label };
}

function parseInstallment(value: unknown): ProductInstallment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.months !== "number" || typeof record.monthlyPrice !== "number") return undefined;
  if (!Number.isFinite(record.months) || !Number.isFinite(record.monthlyPrice)) return undefined;
  if (record.months <= 0 || record.monthlyPrice < 0) return undefined;
  return { months: Math.floor(record.months), monthlyPrice: Math.round(record.monthlyPrice * 100) / 100 };
}

function parseVariantGroups(value: unknown): ProductVariantGroup[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const groups: ProductVariantGroup[] = [];
  for (const group of value) {
    if (!group || typeof group !== "object") continue;
    const record = group as Record<string, unknown>;
    const id = asNonEmptyString(record.id);
    const label = asNonEmptyString(record.label);
    if (!id || !label || !Array.isArray(record.options)) continue;
    const options = record.options
      .map((option) => {
        if (!option || typeof option !== "object") return null;
        const opt = option as Record<string, unknown>;
        const valueId = asNonEmptyString(opt.value);
        const optionLabel = asNonEmptyString(opt.label);
        if (!valueId || !optionLabel) return null;
        const swatch = typeof opt.swatch === "string" ? opt.swatch : undefined;
        return { value: valueId, label: optionLabel, swatch };
      })
      .filter((option): option is NonNullable<typeof option> => option !== null);
    if (options.length) groups.push({ id, label, options });
  }
  return groups.length ? groups : undefined;
}

export function toWishlistSnapshot(product: Product): WishlistSnapshot {
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    visual: asVisual(product.visual),
    tone: asTone(product.tone),
    secondaryVisual: product.secondaryVisual && isProductVisual(product.secondaryVisual) ? product.secondaryVisual : undefined,
    price: asMoney(product.price) ?? 0,
    previousPrice: product.previousPrice == null ? undefined : (asMoney(product.previousPrice) ?? undefined),
    rating: typeof product.rating === "number" && Number.isFinite(product.rating) ? product.rating : 0,
    reviewCount: Math.max(0, Math.floor(typeof product.reviewCount === "number" ? product.reviewCount : 0)),
    availability: asAvailability(product.availability),
    isNew: product.isNew || undefined,
    badge: product.badge,
    installment: product.installment,
    variants: product.variants,
  };
}

export function parseWishlistSnapshot(value: unknown): WishlistSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const productId = asNonEmptyString(record.productId);
  const slug = asNonEmptyString(record.slug);
  const name = asNonEmptyString(record.name);
  const brand = asNonEmptyString(record.brand);
  const price = asMoney(record.price);
  if (!productId || !slug || !name || !brand || price == null) return null;
  return {
    productId,
    slug,
    name,
    brand,
    visual: asVisual(record.visual),
    tone: asTone(record.tone),
    secondaryVisual: isProductVisual(record.secondaryVisual) ? record.secondaryVisual : undefined,
    price,
    previousPrice: record.previousPrice == null ? undefined : (asMoney(record.previousPrice) ?? undefined),
    rating: typeof record.rating === "number" && Number.isFinite(record.rating) ? record.rating : 0,
    reviewCount: Math.max(0, Math.floor(typeof record.reviewCount === "number" ? record.reviewCount : 0)),
    availability: asAvailability(record.availability),
    isNew: record.isNew === true ? true : undefined,
    badge: parseBadge(record.badge),
    installment: parseInstallment(record.installment),
    variants: parseVariantGroups(record.variants),
  };
}

/** Single mapper so the wishlist page can reuse ProductCard without ad-hoc Product stubs. */
export function wishlistSnapshotToProduct(item: WishlistSnapshot): Product {
  return {
    id: item.productId,
    slug: item.slug,
    brand: item.brand,
    name: item.name,
    category: "",
    visual: item.visual,
    tone: item.tone,
    secondaryVisual: item.secondaryVisual,
    rating: item.rating,
    reviewCount: item.reviewCount,
    price: item.price,
    previousPrice: item.previousPrice,
    installment: item.installment,
    availability: item.availability,
    isNew: item.isNew,
    badge: item.badge,
    variants: item.variants,
  };
}

export function cartSnapshotFromProduct(product: Product, variants?: Record<string, string>): Pick<CartLineItem, "productId" | "variants" | "variantLabels" | "snapshot"> {
  const normalized = normalizeVariants(variants && Object.keys(variants).length ? variants : getDefaultVariants(product));
  return {
    productId: product.id,
    variants: normalized,
    variantLabels: formatSelectedVariants(product, normalized),
    snapshot: toCartProductSnapshot(product),
  };
}
