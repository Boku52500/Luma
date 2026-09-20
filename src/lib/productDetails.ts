import type {
  Product,
  ProductDelivery,
  ProductImageData,
  ProductInstallment,
  ProductSpecGroup,
  ProductVariantGroup,
} from "@/types/product";

/**
 * Product-detail-page (PDP) derivation helpers.
 *
 * Most PDP fields on `Product` are optional so the whole catalogue keeps
 * working — every function here returns the product's explicit data when
 * set, otherwise derives a sensible, deterministic fallback. Nothing here
 * uses `Math.random()` / `Date.now()` so server and client render
 * identically (see the formatPrice comment in lib/utils.ts for why that
 * matters in this app).
 */

export function getSku(product: Product): string {
  return product.sku ?? `LUMA-${product.id.toUpperCase()}`;
}

/** Deterministic PDP gallery — falls back to visual/secondaryVisual + tone variations. */
export function getGalleryImages(product: Product): ProductImageData[] {
  if (product.images?.length) return product.images;

  const images: ProductImageData[] = [{ visual: product.visual, tone: product.tone }];
  if (product.secondaryVisual) {
    images.push({ visual: product.secondaryVisual, tone: product.tone });
  }
  const altTone1 = (((product.tone + 1) % 5) + 1) as 1 | 2 | 3 | 4 | 5;
  images.push({ visual: product.visual, tone: altTone1 });
  if (images.length < 3) {
    const altTone2 = (((product.tone + 3) % 5) + 1) as 1 | 2 | 3 | 4 | 5;
    images.push({ visual: product.visual, tone: altTone2 });
  }
  return images;
}

export function getInstallmentOptions(product: Product): ProductInstallment[] {
  if (product.installmentOptions?.length) return product.installmentOptions;
  if (product.installment) return [product.installment];
  return [];
}

const categoryWarranty: Partial<Record<string, string>> = {
  phones: "24 თვე ოფიციალური გარანტია",
  laptops: "24 თვე ოფიციალური გარანტია",
  tablets: "24 თვე ოფიციალური გარანტია",
  tv: "36 თვე ოფიციალური გარანტია",
  monitors: "36 თვე ოფიციალური გარანტია",
  gaming: "24 თვე ოფიციალური გარანტია",
  components: "36 თვე ოფიციალური გარანტია",
  audio: "12 თვე ოფიციალური გარანტია",
  "smart-home": "12 თვე ოფიციალური გარანტია",
  network: "24 თვე ოფიციალური გარანტია",
  accessories: "12 თვე ოფიციალური გარანტია",
};

export function getWarranty(product: Product): string {
  return product.warranty ?? categoryWarranty[product.category] ?? "12 თვე ოფიციალური გარანტია";
}

export function getDelivery(product: Product): ProductDelivery {
  return (
    product.delivery ?? {
      estimate: "თბილისში — 1 დღეში, რეგიონებში — 1-დან 3 დღემდე",
      returnDays: 14,
    }
  );
}

const categoryWhatsIncluded: Partial<Record<string, string[]>> = {
  phones: ["მოწყობილობა", "USB-C დამტენი კაბელი", "SIM ამომღები ხელსაწყო", "დოკუმენტაცია"],
  laptops: ["ლეპტოპი", "დამტენი ადაპტერი", "დოკუმენტაცია"],
  tablets: ["ტაბლეტი", "USB-C დამტენი კაბელი", "დოკუმენტაცია"],
  tv: ["ტელევიზორი", "დისტანციური მართვის პულტი", "სამაგრი ფეხები", "დოკუმენტაცია"],
  monitors: ["მონიტორი", "კვების კაბელი", "დოკუმენტაცია"],
  gaming: ["მოწყობილობა", "დამტენი/კვების კაბელი", "დოკუმენტაცია"],
  audio: ["მოწყობილობა", "USB-C დამტენი კაბელი", "სახელმძღვანელო"],
  components: ["მოწყობილობა", "სამონტაჟო ხრახნები", "დოკუმენტაცია"],
  "smart-home": ["მოწყობილობა", "სამაგრი აქსესუარები", "სახელმძღვანელო"],
  network: ["მოწყობილობა", "კვების ადაპტერი", "Ethernet კაბელი", "სახელმძღვანელო"],
  accessories: ["მოწყობილობა", "USB კაბელი", "სახელმძღვანელო"],
};

export function getWhatsIncluded(product: Product): string[] {
  return (
    product.whatsIncluded ??
    categoryWhatsIncluded[product.category] ?? ["მოწყობილობა", "სახელმძღვანელო", "საგარანტიო ბარათი"]
  );
}

export function getDescription(product: Product): string {
  if (product.description) return product.description;
  return `${product.brand} ${product.name} — საიმედო არჩევანი, რომელიც აერთიანებს ხარისხს, თანამედროვე დიზაინსა და გამძლეობას. შესანიშნავი გადაწყვეტილება ყოველდღიური გამოყენებისთვის, ხოლო ოფიციალური გარანტია დამატებით სიმშვიდეს გაძლევთ შენაძენის შემდეგ.`;
}

export function getKeyFeatures(product: Product): string[] {
  if (product.keyFeatures?.length) return product.keyFeatures;

  const features: string[] = [];
  if (product.badge?.label) features.push(product.badge.label);
  if (product.storage) features.push(`${product.storage} შიდა მეხსიერება`);
  if (product.ram) features.push(`${product.ram} ოპერატიული მეხსიერება`);
  if (getInstallmentOptions(product).length) features.push("ხელმისაწვდომია განვადებით, საკომისიოს გარეშე");
  if (product.isNew) features.push("ახალი მოდელი — უახლესი ტექნოლოგიებით");
  features.push("ორიგინალი პროდუქცია ოფიციალური გარანტიით");

  return Array.from(new Set(features)).slice(0, 6);
}

export function getSpecGroups(product: Product): ProductSpecGroup[] {
  if (product.specs?.length) return product.specs;

  const items = [
    { label: "ბრენდი", value: product.brand },
    { label: "მოდელი", value: getSku(product) },
    ...(product.storage ? [{ label: "მეხსიერება", value: product.storage }] : []),
    ...(product.ram ? [{ label: "ოპერატიული მეხსიერება", value: product.ram }] : []),
  ];
  return [{ group: "ზოგადი", items }];
}

export function getVariantGroups(product: Product): ProductVariantGroup[] {
  return product.variants ?? [];
}

export function getRelatedProducts(product: Product, pool: Product[], limit = 8): Product[] {
  if (product.relatedIds?.length) {
    const byId = new Map(pool.map((p) => [p.id, p]));
    const explicit = product.relatedIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
    if (explicit.length) return explicit.slice(0, limit);
  }
  return pool.filter((p) => p.id !== product.id && p.category === product.category).slice(0, limit);
}

/** Cross-category "შეიძლება დაგაინტერესოთ" pool — popular items outside what's already shown. */
export function getYouMightLikeProducts(product: Product, pool: Product[], exclude: Product[], limit = 8): Product[] {
  const excludeIds = new Set([product.id, ...exclude.map((p) => p.id)]);
  return [...pool]
    .filter((p) => !excludeIds.has(p.id))
    .sort((a, b) => Number(b.isNew) - Number(a.isNew) || a.name.localeCompare(b.name, "ka"))
    .slice(0, limit);
}
