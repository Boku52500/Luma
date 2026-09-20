import { SEO_TITLE_SUFFIX } from "./constants";
import { cleanGeneratedText } from "./content";
import { parseProductFacts, type ProductFacts } from "./parseProductFacts";

export type ComposedProductContent = {
  shortDescription: string;
  fullDescription: string;
  seoTitle: string;
  seoDescription: string;
  facts: ProductFacts;
};

export const OLD_BOILERPLATE_PATTERNS = [
  /წარმოდგენილია\s+Luma-ს\s+კატალოგში/i,
  /არის\s+[\w-]+-ის\s+პროდუქტი\s+კატეგორიიდან/i,
  /განთავსებულია\s+კატეგორიაში/i,
  /აღმოაჩინე\s+.+\s+—\s+[\w-]+-ის\s+მოდელი\s+კატეგორიაში/i,
];

function skuSeed(sku: string): number {
  let h = 0;
  for (let i = 0; i < sku.length; i += 1) h = (h * 31 + sku.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function inchText(inches: number, raw: string | null): string {
  return raw?.replace(/['′]/g, '"') ?? `${inches}"`;
}

function resLabel(res: string): string {
  const m: Record<string, string> = {
    "4K": "4K UHD",
    "8K": "8K",
    QHD: "QHD",
    DQHD: "DQHD",
    FHD: "Full HD",
    HD: "HD",
  };
  return m[res] ?? res;
}

function listAttrs(items: string[]): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0]!;
  if (clean.length === 2) return `${clean[0]} და ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} და ${clean.at(-1)}`;
}

function keyAttributes(facts: ProductFacts): string[] {
  const a: string[] = [];
  if ((facts.categoryKind === "monitor" || facts.categoryKind === "tv") && facts.screenInches) {
    a.push(`${inchText(facts.screenInches, facts.screenInchesRaw)} ეკრანი`);
  }
  if (facts.resolution && ["monitor", "tv", "laptop"].includes(facts.categoryKind)) {
    a.push(`${resLabel(facts.resolution)} გამოსახულება`);
  }
  if (facts.cpuModel) a.push(facts.cpuModel);
  if (facts.gpuModel) a.push(facts.gpuModel);
  if (facts.phoneModel) a.push(facts.phoneModel);
  if (facts.primaryStorage) a.push(`${facts.primaryStorage.value}${facts.primaryStorage.unit} მოცულობა`);
  if (facts.primaryMemory) a.push(`${facts.primaryMemory.value}${facts.primaryMemory.unit} RAM`);
  if (facts.wifiGeneration && facts.categoryKind === "router") a.push(facts.wifiGeneration);
  if (facts.formFactor === "M.2") a.push("M.2");
  if (facts.series[0] && facts.series[0].length < 40) a.push(facts.series[0]);
  return a;
}

function gamingHint(facts: ProductFacts): boolean {
  return /rog|gaming|legion|odyssey|predator|nitro|tuf|geforce|radeon|rtx|\brx\s/i.test(facts.name);
}

function productUseCase(facts: ProductFacts): string {
  switch (facts.categoryKind) {
    case "monitor":
      if (facts.resolution === "4K" || facts.resolution === "8K" || gamingHint(facts)) {
        return "გეიმინგისა და დეტალური სამუშაოსთვის";
      }
      if (facts.screenInches && facts.screenInches >= 34) return "ფართო სამუშაო გარემოსთვის";
      return "სამუშაო, სწავლისა და მულტიმედიისთვის";
    case "cpu":
      return /x3d|\bk\b|\bkf\b|\bx\b/i.test(facts.name)
        ? "მაღალი წარმადობის სისტემებისა და გეიმინგისთვის"
        : "კომპიუტერის აწყობისა და ყოველდღიური გამოყენებისთვის";
    case "gpu":
      return "გრაფიკული დატვირთვის, გეიმინგისა და ვიზუალური კონტენტისთვის";
    case "storage":
      return facts.primaryStorage?.unit === "TB"
        ? "დიდი მოცულობის ფაილებისა და სწრაფი სისტემისთვის"
        : "ფაილების შენახვისა და სისტემისთვის";
    case "laptop":
      if (gamingHint(facts) || facts.gpuModel) return "მობილური გეიმინგისა და მოთხოვნადი ამოცანებისთვის";
      if (/macbook|ultrabook|x1|zenbook/i.test(facts.name)) return "მობილური პროდუქტიული სამუშაოსთვის";
      return "სამუშაო, სწავლისა და მულტიმედიისთვის";
    case "phone":
      return "ყოველდღიური გამოყენების, კომუნიკაციისა და მულტიმედიისთვის";
    case "tv":
      return facts.screenInches && facts.screenInches >= 55
        ? "ფართო სახლის კინოთეატრისთვის"
        : "სახლის გართობისა და მულტიმედიისთვის";
    case "router":
      return "სტაბილური სახლის ან ოფისის ინტერნეტისთვის";
    case "headphones":
      return /wh-|xm|studio|pro/i.test(facts.name)
        ? "ხმის ხარისხიანი მოსმენისთვის"
        : "მუსიკის, ზარებისა და მულტიმედიისთვის";
    case "case":
      return "PC კორპუსის აწყობისა და კომპონენტების დაცვისთვის";
    case "cooler":
      return "პროცესორის გაგრილებისა და სისტემის სტაბილური მუშაობისთვის";
    case "motherboard":
      return "კომპიუტერის აწყობისა და გაფართოებისთვის";
    case "appliance":
      return "სახლის ყოველდღიური გამოყენებისთვის";
    default:
      return "ყოველდღიური გამოყენებისთვის";
  }
}

function commercialParagraph(facts: ProductFacts): string | null {
  const seed = skuSeed(facts.sku);
  if (seed % 5 === 0) return null;
  const options = [
    `შეიძინე ${facts.name} Luma-ში და ისარგებლე განვადებით შეძენის შესაძლებლობით.`,
    `${facts.brand}-ის ეს მოდელი ხელმისაწვდომია Luma-ს ონლაინ მაღაზიაში — გაეცანი ფასს და შეიძინე ონლაინ.`,
    `Luma-ში ${facts.name} შეგიძლიათ შეიძინოთ ონლაინ; გაეცანი ფასს და შეძენის პირობებს.`,
    `იხილე ${facts.name} Luma-ში და შეიძინე განვადებით, სადაც ეს შესაძლებელია.`,
  ];
  return options[seed % options.length]!;
}

function composeShortDescription(facts: ProductFacts): string {
  const use = productUseCase(facts);
  const name = facts.name;

  if (facts.categoryKind === "monitor") {
    const parts: string[] = [];
    if (facts.screenInches) parts.push(`${inchText(facts.screenInches, facts.screenInchesRaw)} ეკრანით`);
    if (facts.resolution) parts.push(`${resLabel(facts.resolution)} გამოსახულებით`);
    const detail = parts.join(", ");
    const gaming = gamingHint(facts) ? "გეიმინგ " : "";
    if (detail) {
      return cleanGeneratedText(
        `${name} — ${facts.brand}-ის ${gaming}მონიტორი ${detail}, იდეალურია ${use}.`,
      );
    }
  }

  if (facts.categoryKind === "cpu" && facts.cpuModel) {
    return cleanGeneratedText(
      `${facts.cpuModel} — ${facts.brand}-ის პროცესორი, ${use}.`,
    );
  }

  if (facts.categoryKind === "gpu") {
    const gpuPart = facts.gpuModel ? ` ${facts.gpuModel}-ით` : "";
    return cleanGeneratedText(`${name} — ${facts.brand}-ის ვიდეობარათი${gpuPart}, ${use}.`);
  }

  if (facts.categoryKind === "storage") {
    const cap = facts.primaryStorage ? ` ${facts.primaryStorage.value}${facts.primaryStorage.unit}` : "";
    const form = facts.formFactor === "M.2" ? " M.2" : "";
    return cleanGeneratedText(`${name} — ${facts.brand}-ის${form} მეხსიერება${cap}-ით, ${use}.`);
  }

  if (facts.categoryKind === "phone") {
    const model = facts.phoneModel ?? name;
    const storage = facts.primaryStorage ? ` ${facts.primaryStorage.value}${facts.primaryStorage.unit}` : "";
    return cleanGeneratedText(`${model}${storage} — ${facts.brand}-ის სმარტფონი, ${use}.`);
  }

  if (facts.categoryKind === "tv") {
    const size = facts.screenInches ? `${inchText(facts.screenInches, facts.screenInchesRaw)} ` : "";
    const res = facts.resolution ? `${resLabel(facts.resolution)} ` : "";
    return cleanGeneratedText(`${name} — ${size}${res}ტელევიზორი ${facts.brand}-ისგან, ${use}.`);
  }

  if (facts.categoryKind === "laptop") {
    const attrs = listAttrs(keyAttributes(facts));
    if (attrs) {
      return cleanGeneratedText(`${name} — ${facts.brand}-ის ლეპტოპი ${attrs}-ით, ${use}.`);
    }
  }

  const attrs = listAttrs(keyAttributes(facts));
  if (attrs) {
    return cleanGeneratedText(`${name} — ${facts.brand}-ის ${facts.productTypeKa}, ${attrs}, ${use}.`);
  }

  return cleanGeneratedText(`${name} — ${facts.brand}-ის ${facts.productTypeKa}, ${use}.`);
}

function composeFullDescription(facts: ProductFacts): string {
  const use = productUseCase(facts);
  const attrs = listAttrs(keyAttributes(facts));
  const p1 = cleanGeneratedText(
    `${facts.name} არის ${facts.brand}-ის ${facts.productTypeKa}${attrs ? `, რომელიც ${attrs}-ით გამოირჩევა` : ""}. ${use} შესაფერისი არჩევანია.`,
  );

  const p2 = cleanGeneratedText(
    attrs
      ? `ეს მოდელი ${use} შესაფერისია და Luma-ს კატალოგში ${facts.category} კატეგორიაშია წარმოდგენილი.`
      : `${facts.productTypeKa} ${use} გამოიყენება და Luma-ს კატალოგში ${facts.category} კატეგორიაშია წარმოდგენილი.`,
  );

  const commercial = commercialParagraph(facts);
  const paragraphs = [p1, p2];
  if (commercial) paragraphs.push(cleanGeneratedText(commercial));
  return paragraphs.join("\n\n");
}

function seoModelLabel(facts: ProductFacts): string {
  if (facts.phoneModel) return facts.phoneModel;
  if (facts.cpuModel) return facts.cpuModel;
  if (facts.gpuModel) return facts.gpuModel;
  if (facts.series[0] && facts.series[0].length < 40) return facts.series[0];
  let label = facts.modelLabel;
  const brandRe = new RegExp(`^${facts.brand}\\s+`, "i");
  label = label.replace(brandRe, "").trim();
  const words = label.split(/\s+/).slice(0, 5);
  return words.join(" ") || facts.modelLabel;
}

function composeSeoTitle(facts: ProductFacts): string {
  const model = seoModelLabel(facts);
  const brandLower = facts.brand.toLocaleLowerCase("ka");
  const modelLower = model.toLocaleLowerCase("ka");
  const brandPrefix = modelLower.startsWith(brandLower) ? "" : `${facts.brand} `;
  const extras: string[] = [];
  if (facts.primaryStorage && ["phone", "storage", "laptop"].includes(facts.categoryKind)) {
    extras.push(`${facts.primaryStorage.value}${facts.primaryStorage.unit}`);
  }
  if (facts.resolution && ["monitor", "tv"].includes(facts.categoryKind)) {
    extras.push(facts.resolution);
  }
  const type =
    facts.categoryKind === "monitor"
      ? "მონიტორი"
      : facts.categoryKind === "cpu"
        ? "პროცესორი"
        : facts.categoryKind === "gpu"
          ? "ვიდეობარათი"
          : facts.categoryKind === "phone"
            ? ""
            : facts.productTypeKa;

  const core = [brandPrefix + model, ...extras, type].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const title = `${core}${SEO_TITLE_SUFFIX}`;
  if (title.length <= 70) return title;
  const trimmed = `${facts.brand} ${model}${type ? ` ${type}` : ""}${SEO_TITLE_SUFFIX}`;
  return trimmed.length <= 70 ? trimmed : `${trimmed.slice(0, 67 - SEO_TITLE_SUFFIX.length)}${SEO_TITLE_SUFFIX}`;
}

function composeSeoDescription(facts: ProductFacts): string {
  const seed = skuSeed(facts.sku);
  const model = seoModelLabel(facts);
  const attr = keyAttributes(facts)[0];
  const attrPart = attr ? ` ${attr}-ით` : "";
  const openings = [
    `შეიძინე ${facts.brand} ${model}${attrPart} Luma-ში. გაეცანი ფასს და ისარგებლე განვადებით შეძენის შესაძლებლობით.`,
    `${facts.brand} ${model} — ${facts.productTypeKa}${attrPart}. იხილე ფასი და შეიძინე ონლაინ Luma-ში.`,
    `${model} (${facts.brand}) Luma-ს მაღაზიაში. გაეცანი ფასს და შეიძინე ონლაინ.`,
    `Luma-ში: ${facts.brand} ${model}${attrPart}. შეიძინე ონლაინ ან განვადებით.`,
  ];
  let text = cleanGeneratedText(openings[seed % openings.length]!);
  if (text.length > 165) text = `${text.slice(0, 162)}...`;
  return text;
}

/** Compose fact-driven SEO content for one product (not template rotation). */
export function composeProductContent(input: {
  sku: string;
  name: string;
  brand: string;
  category: string;
}): ComposedProductContent {
  const facts = parseProductFacts(input);
  return {
    shortDescription: composeShortDescription(facts),
    fullDescription: composeFullDescription(facts),
    seoTitle: composeSeoTitle(facts),
    seoDescription: composeSeoDescription(facts),
    facts,
  };
}
