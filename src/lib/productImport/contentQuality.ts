import { OLD_BOILERPLATE_PATTERNS } from "./composeProductContent";

export type SeoManifestEntry = {
  sku: string;
  productName: string;
  brand: string;
  category: string;
  currentSlug: string | null;
  proposedSlug: string;
  proposedShortDescription: string;
  proposedFullDescription: string;
  proposedSeoTitle: string;
  proposedSeoDescription: string;
};

export type ContentQualityFlag = {
  sku: string;
  code: string;
  message: string;
};

export type PhraseRepetitionStat = {
  phrase: string;
  count: number;
  percent: number;
};

export type ContentQualityReport = {
  total: number;
  flags: ContentQualityFlag[];
  duplicateShortDescriptions: string[];
  duplicateFullDescriptions: string[];
  duplicateSeoTitles: string[];
  duplicateSeoDescriptions: string[];
  duplicateProposedSlugs: string[];
  phraseRepetition: PhraseRepetitionStat[];
  seoTitleLength: { min: number; max: number; avg: number; over60: number };
  metaDescriptionLength: { min: number; max: number; avg: number; over160: number };
  slugLength: { oldAvg: number; newAvg: number; longest: string; longestLen: number };
  keywordCounts: {
    gavadeba: number;
    gavadebit: number;
    fasi: number;
    sheidzine: number;
    luma: number;
  };
};

const MIN_SHORT_LEN = 40;
const MIN_FULL_LEN = 80;

function countPhrase(texts: string[], phrase: string): number {
  const lower = phrase.toLocaleLowerCase("ka");
  return texts.filter((t) => t.toLocaleLowerCase("ka").includes(lower)).length;
}

function findDuplicates(values: string[]): string[] {
  const map = new Map<string, number>();
  for (const v of values) {
    const key = v.trim();
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].filter(([, c]) => c > 1).map(([v]) => v.slice(0, 120));
}

function openingPhrase(text: string): string {
  return text.trim().slice(0, Math.min(40, text.length));
}

function forbiddenInGenerated(text: string, productName: string): boolean {
  if (/საქართველოში/i.test(text)) return true;
  const specClaims = /\b(?:240Hz|0\.03ms|HDMI\s*2\.1)\b/i;
  if (specClaims.test(text) && !specClaims.test(productName)) return true;
  const oled = /\bOLED\b/i;
  if (oled.test(text) && !oled.test(productName)) return true;
  return false;
}

export function analyzeContentQuality(entries: SeoManifestEntry[]): ContentQualityReport {
  const flags: ContentQualityFlag[] = [];
  const shorts = entries.map((e) => e.proposedShortDescription);
  const fulls = entries.map((e) => e.proposedFullDescription);
  const titles = entries.map((e) => e.proposedSeoTitle);
  const metas = entries.map((e) => e.proposedSeoDescription);
  const slugs = entries.map((e) => e.proposedSlug);

  for (const entry of entries) {
    for (const pattern of OLD_BOILERPLATE_PATTERNS) {
      if (pattern.test(entry.proposedShortDescription) || pattern.test(entry.proposedFullDescription)) {
        flags.push({ sku: entry.sku, code: "OLD_BOILERPLATE", message: "Contains deprecated template phrasing" });
        break;
      }
    }
    if (forbiddenInGenerated(entry.proposedShortDescription + entry.proposedFullDescription, entry.productName)) {
      flags.push({ sku: entry.sku, code: "FORBIDDEN_CLAIM", message: "Unsupported or forbidden claim detected" });
    }
    if (entry.proposedShortDescription.length < MIN_SHORT_LEN) {
      flags.push({ sku: entry.sku, code: "SHORT_TOO_BRIEF", message: "Short description below minimum useful length" });
    }
    if (entry.proposedFullDescription.length < MIN_FULL_LEN && entry.proposedShortDescription.length < 80) {
      flags.push({ sku: entry.sku, code: "FULL_TOO_BRIEF", message: "Full description sparse for available data" });
    }
    if (entry.proposedSeoTitle.length > 70) {
      flags.push({ sku: entry.sku, code: "SEO_TITLE_LONG", message: "SEO title exceeds recommended length" });
    }
    if (entry.proposedSeoDescription.length > 165) {
      flags.push({ sku: entry.sku, code: "META_LONG", message: "Meta description exceeds recommended length" });
    }
    if (entry.proposedSlug.length > 72) {
      flags.push({ sku: entry.sku, code: "SLUG_LONG", message: "Proposed slug is very long" });
    }
    // Require a trailing word boundary on the backreference so model tokens like
    // "Ryzen 7 7800X3D" or "NB907GO-MC McLaren" do not false-positive as "7 7" / "MC Mc".
    if (/(\b\w+\b)\s+\1\b/i.test(entry.proposedShortDescription)) {
      flags.push({ sku: entry.sku, code: "DUPLICATE_BRAND", message: "Possible duplicated brand/token in short description" });
    }
  }

  const openings = shorts.map(openingPhrase);
  const openingCounts = new Map<string, number>();
  for (const o of openings) openingCounts.set(o, (openingCounts.get(o) ?? 0) + 1);
  for (const [phrase, count] of openingCounts.entries()) {
    if (count > 3 && phrase.length > 15) {
      flags.push({
        sku: "*",
        code: "REPETITIVE_OPENING",
        message: `Opening "${phrase}..." repeated ${count} times`,
      });
    }
  }

  const phraseCandidates = [
    "შეიძინე",
    "განვადებით",
    "გაეცანი ფასს",
    "Luma-ში",
    "Luma-ს",
    "იდეალურია",
    "გამოირჩევა",
  ];

  const phraseRepetition: PhraseRepetitionStat[] = phraseCandidates.map((phrase) => {
    const combined = [...shorts, ...fulls, ...metas];
    const count = countPhrase(combined, phrase);
    return { phrase, count, percent: Math.round((count / entries.length) * 100) };
  });

  const titleLens = titles.map((t) => t.length);
  const metaLens = metas.map((t) => t.length);
  const oldSlugs = entries.map((e) => e.currentSlug ?? "").filter(Boolean);
  const newSlugs = slugs;

  const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);
  const longest = newSlugs.reduce((a, b) => (b.length > a.length ? b : a), "");

  return {
    total: entries.length,
    flags,
    duplicateShortDescriptions: findDuplicates(shorts),
    duplicateFullDescriptions: findDuplicates(fulls),
    duplicateSeoTitles: findDuplicates(titles),
    duplicateSeoDescriptions: findDuplicates(metas),
    duplicateProposedSlugs: findDuplicates(slugs),
    phraseRepetition: phraseRepetition.sort((a, b) => b.percent - a.percent),
    seoTitleLength: {
      min: Math.min(...titleLens),
      max: Math.max(...titleLens),
      avg: Math.round(avg(titleLens)),
      over60: titleLens.filter((l) => l > 60).length,
    },
    metaDescriptionLength: {
      min: Math.min(...metaLens),
      max: Math.max(...metaLens),
      avg: Math.round(avg(metaLens)),
      over160: metaLens.filter((l) => l > 160).length,
    },
    slugLength: {
      oldAvg: Math.round(avg(oldSlugs.map((s) => s.length))),
      newAvg: Math.round(avg(newSlugs.map((s) => s.length))),
      longest,
      longestLen: longest.length,
    },
    keywordCounts: {
      gavadeba: countPhrase([...fulls, ...metas], "განვადება"),
      gavadebit: countPhrase([...fulls, ...metas], "განვადებით"),
      fasi: countPhrase([...fulls, ...metas], "ფას"),
      sheidzine: countPhrase([...fulls, ...metas, ...shorts], "შეიძინ"),
      luma: countPhrase([...fulls, ...metas, ...titles], "Luma"),
    },
  };
}
