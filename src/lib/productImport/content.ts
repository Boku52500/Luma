import { SEO_TITLE_SUFFIX } from "./constants";

export type ProductContentInput = {
  sku: string;
  name: string;
  brand: string;
  category: string;
};

/** Stable hash for deterministic template selection (no Math.random). */
export function contentSeed(input: ProductContentInput): number {
  const key = `${input.sku}|${input.name}|${input.brand}|${input.category}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickIndex(seed: number, count: number): number {
  return count > 0 ? seed % count : 0;
}

/** Preserve raw category label without Georgian declension. */
export function quotedCategory(category: string): string {
  return `„${category}"`;
}

function categoryInCatalog(category: string): string {
  return `კატეგორიაში ${quotedCategory(category)}`;
}

function categoryFromCatalog(category: string): string {
  return `კატეგორიიდან ${quotedCategory(category)}`;
}

export function cleanGeneratedText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function nameWithOptionalBrand(input: ProductContentInput): string {
  const nameLower = input.name.toLocaleLowerCase("ka");
  const brandLower = input.brand.toLocaleLowerCase("ka");
  if (nameLower.startsWith(brandLower)) return input.name;
  return `${input.brand} ${input.name}`;
}

const SHORT_TEMPLATES: Array<(input: ProductContentInput) => string> = [
  (input) =>
    `${input.name} არის ${input.brand}-ის პროდუქტი ${categoryFromCatalog(input.category)}. მოდელი ხელმისაწვდომია Luma-ში.`,
  (input) =>
    `აღმოაჩინე ${input.name} — ${input.brand}-ის მოდელი ${categoryInCatalog(input.category)} Luma-ს ონლაინ მაღაზიაში.`,
  (input) =>
    `${nameWithOptionalBrand(input)} წარმოდგენილია Luma-ს კატალოგში, ${categoryInCatalog(input.category)}.`,
  (input) =>
    `${input.name} (${input.brand}) განთავსებულია ${categoryInCatalog(input.category)} Luma-ში შესაძენად.`,
];

const FULL_TEMPLATES: Array<(input: ProductContentInput) => string[]> = [
  (input) => [
    `${input.name} წარმოადგენს ${input.brand}-ის პროდუქტს ${categoryInCatalog(input.category)}.`,
    `${input.brand} კატალოგის ეს მოდელი Luma-ში ონლაინ შესაძენადაა ხელმისაწვდომი.`,
    `დაათვალიერეთ ${input.name}, გაეცანით ფასს და დეტალებს Luma-ს ვებგვერდზე.`,
  ],
  (input) => [
    `${input.name} — ${input.brand}-ის არჩევანი ${categoryFromCatalog(input.category)}.`,
    `Luma-ს კატალოგში ეს მოდელი განთავსებულია ${categoryInCatalog(input.category)}, რათა მარტივად იპოვოთ საჭირო პროდუქტი.`,
    `შეიძინეთ ${input.name} ონლაინ და გაეცანით სრულ ინფორმაციას პროდუქტის გვერდზე.`,
  ],
  (input) => [
    `${nameWithOptionalBrand(input)} Luma-ს ${categoryInCatalog(input.category)} განყოფილებაშია წარმოდგენილი.`,
    `${input.name} შეგიძლიათ დაათვალიეროთ Luma-ში — ფასი, აღწერა და შეძენის პირობები ხელმისაწვდომია ონლაინ.`,
  ],
];

const SEO_DESC_TEMPLATES: Array<(input: ProductContentInput) => string> = [
  (input) =>
    `${input.name} — ${input.brand}, ${quotedCategory(input.category)} Luma-ში. გაეცანით ფასსა და დეტალებს ონლაინ.`,
  (input) =>
    `${input.name} (${input.brand}) ${categoryInCatalog(input.category)} Luma-ს მაღაზიაში. დაათვალიერეთ და შეიძინეთ ონლაინ.`,
  (input) =>
    `Luma-ში: ${input.name}, ${input.brand}, ${quotedCategory(input.category)}. იხილეთ პროდუქტი და მისი ფასი.`,
  (input) =>
    `${nameWithOptionalBrand(input)} — ${quotedCategory(input.category)} კატეგორია Luma-ში. დეტალური ინფორმაცია ონლაინ.`,
];

function toContentInput(sku: string, name: string, brand: string, category: string): ProductContentInput {
  return { sku, name, brand, category };
}

/** Concise Georgian short description with deterministic template variation. */
export function generateShortDescription(sku: string, name: string, brand: string, category: string): string {
  const input = toContentInput(sku, name, brand, category);
  const template = SHORT_TEMPLATES[pickIndex(contentSeed(input), SHORT_TEMPLATES.length)]!;
  return cleanGeneratedText(template(input));
}

/** SEO-rich Georgian full description without invented technical specs. */
export function generateFullDescription(sku: string, name: string, brand: string, category: string): string {
  const input = toContentInput(sku, name, brand, category);
  const paragraphs = FULL_TEMPLATES[pickIndex(contentSeed(input), FULL_TEMPLATES.length)]!(input);
  return paragraphs.map(cleanGeneratedText).join("\n\n");
}

/** SEO title following Luma convention: [Product Name] | Luma */
export function generateSeoTitle(name: string): string {
  const title = `${name}${SEO_TITLE_SUFFIX}`;
  return title.length <= 255 ? title : `${name.slice(0, 255 - SEO_TITLE_SUFFIX.length)}${SEO_TITLE_SUFFIX}`;
}

/** Georgian SEO meta description with deterministic template variation. */
export function generateSeoDescription(sku: string, name: string, brand: string, category: string): string {
  const input = toContentInput(sku, name, brand, category);
  const template = SEO_DESC_TEMPLATES[pickIndex(contentSeed(input), SEO_DESC_TEMPLATES.length)]!;
  const base = cleanGeneratedText(template(input));
  if (base.length <= 500) return base;
  return `${base.slice(0, 497)}...`;
}

/** Generate all content fields for preview/testing. */
export function generateProductContent(sku: string, name: string, brand: string, category: string) {
  return {
    shortDescription: generateShortDescription(sku, name, brand, category),
    fullDescription: generateFullDescription(sku, name, brand, category),
    seoTitle: generateSeoTitle(name),
    seoDescription: generateSeoDescription(sku, name, brand, category),
    templateIndex: {
      short: pickIndex(contentSeed(toContentInput(sku, name, brand, category)), SHORT_TEMPLATES.length),
      full: pickIndex(contentSeed(toContentInput(sku, name, brand, category)), FULL_TEMPLATES.length),
      seo: pickIndex(contentSeed(toContentInput(sku, name, brand, category)), SEO_DESC_TEMPLATES.length),
    },
  };
}
