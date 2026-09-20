import type { AiSeoManifestEntry } from "./aiSeoManifest";
import { analyzeContentQuality, type SeoManifestEntry } from "./contentQuality";
import {
  analyzeCommercialRepetition,
  COMMERCIAL_KEYWORD_COUNT_LABELS,
  findMixedScriptTokensInText,
} from "./validateAiClaims";

export type KeywordAuditRow = {
  label: string;
  totalOccurrences: number;
  distinctProducts: number;
};

export type LengthStats = {
  min: number;
  max: number;
  avg: number;
  median: number;
};

export type AiManifestAuditReport = {
  keywordAudit: KeywordAuditRow[];
  repetition: ReturnType<typeof analyzeContentQuality>;
  commercialRepetition: ReturnType<typeof analyzeCommercialRepetition>;
  topCommercialSentences: Array<{ sentence: string; count: number; skus: string[] }>;
  topCommercialStructures: Array<{ pattern: string; count: number; skus: string[] }>;
  mixedScript: {
    totalViolations: number;
    affectedSkus: Array<{ sku: string; tokens: string[] }>;
  };
  factualSafety: {
    retriedSkus: string[];
    unresolvedBlockingFlags: Array<{ sku: string; code: string; message: string }>;
  };
  lengths: {
    shortDescriptionWords: LengthStats;
    fullDescriptionWords: LengthStats;
    seoTitleChars: LengthStats;
    seoDescriptionChars: LengthStats;
    slugChars: LengthStats;
    seoTitlesOver60: string[];
    seoDescriptionsOver160: string[];
    fullDescriptionsUnder80Words: string[];
    fullDescriptionsOver180Words: string[];
  };
  slugAudit: {
    duplicateFinalSlugs: string[];
    slugsOver60Chars: Array<{ sku: string; slug: string; len: number }>;
    suspiciousSlugs: Array<{ sku: string; slug: string; reasons: string[] }>;
  };
  categorySample: AiSeoManifestEntry[];
};

const BLOCKING_CODES = new Set([
  "FORBIDDEN_CLAIM",
  "FORBIDDEN_GEORGIA_IN",
  "WEAK_SEO_META",
  "INVENTED_SPEC",
  "OLD_BOILERPLATE",
  "DUPLICATE_BRAND",
  "KEYWORD_STUFFING",
  "MIXED_SCRIPT_GEORGIAN",
  "GENERATION_FAILED",
]);

const GENERIC_SLUG_SUFFIXES = [
  "processor",
  "tv",
  "air-conditioner",
  "gaming-router",
  "video-card",
  "graphics-card",
];

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function lengthStats(values: number[]): LengthStats {
  if (!values.length) return { min: 0, max: 0, avg: 0, median: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
  return {
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    avg: Math.round((sum / sorted.length) * 10) / 10,
    median,
  };
}

function countKeywordInProducts(
  entries: AiSeoManifestEntry[],
  pattern: RegExp,
): { total: number; products: number } {
  let total = 0;
  let products = 0;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  for (const entry of entries) {
    if (entry.generationStatus === "failed") continue;
    const combined = [entry.aiShortDescription, entry.aiFullDescription, entry.aiSeoTitle, entry.aiSeoDescription].join(
      "\n",
    );
    const matches = combined.match(re);
    if (matches?.length) {
      total += matches.length;
      products += 1;
    }
  }
  return { total, products };
}

function supplierJunkInSlug(slug: string): boolean {
  return /\b(?:90ig|mu20|ct\d|va\d|b7jm|nggf)\b/i.test(slug) || /\b[a-z]{2}\d{5,}[a-z0-9]*\b/i.test(slug);
}

function duplicatedTokensInSlug(slug: string): boolean {
  const parts = slug.split("-").filter(Boolean);
  const seen = new Set<string>();
  for (const p of parts) {
    if (p.length < 2) continue;
    if (seen.has(p)) return true;
    seen.add(p);
  }
  return false;
}

function selectCategorySample(entries: AiSeoManifestEntry[]): AiSeoManifestEntry[] {
  const ok = entries.filter((e) => e.generationStatus !== "failed");
  const slots: Array<{ match: (e: AiSeoManifestEntry) => boolean; label: string }> = [
    { label: "cpu", match: (e) => /პროცესორი/i.test(e.category) },
    { label: "gpu", match: (e) => /ვიდეო/i.test(e.category) },
    { label: "ssd", match: (e) => /SSD|HDD|მეხსიერებ/i.test(e.category) },
    { label: "laptop", match: (e) => /ლეპტოპ/i.test(e.category) },
    { label: "monitor", match: (e) => /მონიტორ/i.test(e.category) },
    { label: "phone", match: (e) => /ტელეფონ|სმარტ/i.test(e.category) },
    { label: "tv", match: (e) => /ტელევიზ/i.test(e.category) },
    { label: "case", match: (e) => /ქეის/i.test(e.category) },
    { label: "router", match: (e) => /როუტ/i.test(e.category) },
    { label: "ac", match: (e) => /კონდინც/i.test(e.category) },
    { label: "appliance", match: (e) => /ტექნიკ|სარეცხ|მაცივ|ჭურჭ|ჩაიდან|პლიტ/i.test(e.category) },
  ];

  const picked: AiSeoManifestEntry[] = [];
  const used = new Set<string>();

  for (const slot of slots) {
    const found = ok.find((e) => slot.match(e) && !used.has(e.sku));
    if (found) {
      picked.push(found);
      used.add(found.sku);
    }
  }

  for (const entry of ok) {
    if (picked.length >= 30) break;
    if (used.has(entry.sku)) continue;
    picked.push(entry);
    used.add(entry.sku);
  }

  return picked;
}

export function auditAiManifest(entries: AiSeoManifestEntry[], retriedSkus: string[]): AiManifestAuditReport {
  const okEntries = entries.filter((e) => e.generationStatus !== "failed");
  const qualityInput: SeoManifestEntry[] = okEntries.map((e) => ({
    sku: e.sku,
    productName: e.productName,
    brand: e.brand,
    category: e.category,
    currentSlug: e.currentSlug,
    proposedSlug: e.finalValidatedSlug,
    proposedShortDescription: e.aiShortDescription,
    proposedFullDescription: e.aiFullDescription,
    proposedSeoTitle: e.aiSeoTitle,
    proposedSeoDescription: e.aiSeoDescription,
  }));

  const keywordAudit: KeywordAuditRow[] = COMMERCIAL_KEYWORD_COUNT_LABELS.map(({ label, pattern }) => {
    const { total, products } = countKeywordInProducts(entries, pattern);
    return { label, totalOccurrences: total, distinctProducts: products };
  });

  const commercialRepetition = analyzeCommercialRepetition(
    okEntries.map((e) => ({
      sku: e.sku,
      seoDescription: e.aiSeoDescription,
      fullDescription: e.aiFullDescription,
    })),
  );

  const sentenceCounts = new Map<string, { count: number; skus: string[] }>();
  for (const item of commercialRepetition.exactSentences) {
    sentenceCounts.set(item.sentence, { count: item.skus.length, skus: item.skus });
  }
  for (const entry of okEntries) {
    const last = entry.aiFullDescription.split(/(?<=[.!?])\s+/).pop()?.trim() ?? "";
    if (last.length >= 20 && /(?:ფას|შეიძინ|იყიდ|განვად|Luma)/i.test(last)) {
      const key = last.toLowerCase();
      const existing = sentenceCounts.get(key);
      if (existing) {
        if (!existing.skus.includes(entry.sku)) {
          existing.count += 1;
          existing.skus.push(entry.sku);
        }
      } else {
        sentenceCounts.set(key, { count: 1, skus: [entry.sku] });
      }
    }
  }

  const topCommercialSentences = [...sentenceCounts.entries()]
    .map(([sentence, { count, skus }]) => ({ sentence, count, skus }))
    .filter((x) => x.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topCommercialStructures = commercialRepetition.structurePatterns
    .map((item) => ({ pattern: item.pattern, count: item.skus.length, skus: item.skus }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const mixedScriptMap = new Map<string, Set<string>>();
  for (const entry of okEntries) {
    const texts = [entry.aiShortDescription, entry.aiFullDescription, entry.aiSeoTitle, entry.aiSeoDescription];
    const tokens = new Set<string>();
    for (const t of texts) {
      for (const token of findMixedScriptTokensInText(t)) tokens.add(token);
    }
    if (tokens.size) mixedScriptMap.set(entry.sku, tokens);
  }

  const unresolvedBlockingFlags: Array<{ sku: string; code: string; message: string }> = [];
  for (const entry of entries) {
    for (const flag of entry.qualityFlags) {
      if (BLOCKING_CODES.has(flag.code)) {
        unresolvedBlockingFlags.push({ sku: entry.sku, code: flag.code, message: flag.message });
      }
    }
  }

  const shortWords = okEntries.map((e) => wordCount(e.aiShortDescription));
  const fullWords = okEntries.map((e) => wordCount(e.aiFullDescription));
  const titleChars = okEntries.map((e) => e.aiSeoTitle.length);
  const metaChars = okEntries.map((e) => e.aiSeoDescription.length);
  const slugChars = okEntries.map((e) => e.finalValidatedSlug.length);

  const slugMap = new Map<string, string[]>();
  for (const e of okEntries) {
    const list = slugMap.get(e.finalValidatedSlug) ?? [];
    list.push(e.sku);
    slugMap.set(e.finalValidatedSlug, list);
  }

  const suspiciousSlugs: Array<{ sku: string; slug: string; reasons: string[] }> = [];
  for (const e of okEntries) {
    const reasons: string[] = [];
    const slug = e.finalValidatedSlug;
    if (slug.length > 60) reasons.push("length>60");
    if (supplierJunkInSlug(slug)) reasons.push("supplier-code");
    if (duplicatedTokensInSlug(slug)) reasons.push("duplicated-token");
    for (const suffix of GENERIC_SLUG_SUFFIXES) {
      if (slug.endsWith(`-${suffix}`) || slug.includes(`-${suffix}-`)) {
        reasons.push(`generic-suffix:${suffix}`);
      }
    }
    if (reasons.length) suspiciousSlugs.push({ sku: e.sku, slug, reasons });
  }

  return {
    keywordAudit,
    repetition: analyzeContentQuality(qualityInput),
    commercialRepetition,
    topCommercialSentences,
    topCommercialStructures,
    mixedScript: {
      totalViolations: [...mixedScriptMap.values()].reduce((s, set) => s + set.size, 0),
      affectedSkus: [...mixedScriptMap.entries()].map(([sku, tokens]) => ({
        sku,
        tokens: [...tokens],
      })),
    },
    factualSafety: {
      retriedSkus: [...new Set(retriedSkus)],
      unresolvedBlockingFlags,
    },
    lengths: {
      shortDescriptionWords: lengthStats(shortWords),
      fullDescriptionWords: lengthStats(fullWords),
      seoTitleChars: lengthStats(titleChars),
      seoDescriptionChars: lengthStats(metaChars),
      slugChars: lengthStats(slugChars),
      seoTitlesOver60: okEntries.filter((e) => e.aiSeoTitle.length > 60).map((e) => `${e.sku}: ${e.aiSeoTitle}`),
      seoDescriptionsOver160: okEntries
        .filter((e) => e.aiSeoDescription.length > 160)
        .map((e) => `${e.sku}: ${e.aiSeoDescription}`),
      fullDescriptionsUnder80Words: okEntries
        .filter((e) => wordCount(e.aiFullDescription) < 80)
        .map((e) => `${e.sku} (${wordCount(e.aiFullDescription)} words)`),
      fullDescriptionsOver180Words: okEntries
        .filter((e) => wordCount(e.aiFullDescription) > 180)
        .map((e) => `${e.sku} (${wordCount(e.aiFullDescription)} words)`),
    },
    slugAudit: {
      duplicateFinalSlugs: [...slugMap.entries()].filter(([, skus]) => skus.length > 1).map(([slug]) => slug),
      slugsOver60Chars: okEntries
        .filter((e) => e.finalValidatedSlug.length > 60)
        .map((e) => ({ sku: e.sku, slug: e.finalValidatedSlug, len: e.finalValidatedSlug.length })),
      suspiciousSlugs,
    },
    categorySample: selectCategorySample(entries),
  };
}

export function printAuditReport(audit: AiManifestAuditReport): void {
  console.log("\n=== FULL-CATALOGUE SEO AUDIT ===\n");

  console.log("--- Commercial keyword counts (total / distinct products) ---");
  for (const row of audit.keywordAudit) {
    console.log(`${row.label}: ${row.totalOccurrences} / ${row.distinctProducts} products`);
  }

  console.log("\n--- Repetition audit ---");
  const r = audit.repetition;
  console.log(`Duplicate short descriptions: ${r.duplicateShortDescriptions.length}`);
  console.log(`Duplicate full descriptions: ${r.duplicateFullDescriptions.length}`);
  console.log(`Duplicate SEO titles: ${r.duplicateSeoTitles.length}`);
  console.log(`Duplicate SEO descriptions: ${r.duplicateSeoDescriptions.length}`);
  console.log(`Duplicate proposed slugs: ${r.duplicateProposedSlugs.length}`);

  console.log("\n--- TOP 20 repeated commercial sentences ---");
  if (!audit.topCommercialSentences.length) console.log("(none with count > 1)");
  for (const item of audit.topCommercialSentences) {
    console.log(`[${item.count}x] ${item.sentence.slice(0, 120)}${item.sentence.length > 120 ? "…" : ""}`);
  }

  console.log("\n--- TOP 20 repeated commercial structures ---");
  if (!audit.topCommercialStructures.length) console.log("(none with count > 1)");
  for (const item of audit.topCommercialStructures) {
    console.log(`[${item.count}x] ${item.pattern.slice(0, 120)}`);
  }

  console.log("\n--- Mixed-script audit ---");
  console.log(`Total violation tokens: ${audit.mixedScript.totalViolations}`);
  console.log(`Affected SKUs: ${audit.mixedScript.affectedSkus.length}`);
  for (const row of audit.mixedScript.affectedSkus.slice(0, 20)) {
    console.log(`  ${row.sku}: ${row.tokens.join(", ")}`);
  }

  console.log("\n--- Factual safety audit ---");
  console.log(`Products requiring retries: ${audit.factualSafety.retriedSkus.length}`);
  console.log(`Unresolved blocking flags: ${audit.factualSafety.unresolvedBlockingFlags.length}`);
  for (const f of audit.factualSafety.unresolvedBlockingFlags.slice(0, 30)) {
    console.log(`  ${f.sku} ${f.code}: ${f.message}`);
  }

  console.log("\n--- Length audit ---");
  const l = audit.lengths;
  console.log(`Short desc words: min=${l.shortDescriptionWords.min} avg=${l.shortDescriptionWords.avg} median=${l.shortDescriptionWords.median} max=${l.shortDescriptionWords.max}`);
  console.log(`Full desc words: min=${l.fullDescriptionWords.min} avg=${l.fullDescriptionWords.avg} median=${l.fullDescriptionWords.median} max=${l.fullDescriptionWords.max}`);
  console.log(`SEO title chars: min=${l.seoTitleChars.min} avg=${l.seoTitleChars.avg} median=${l.seoTitleChars.median} max=${l.seoTitleChars.max}`);
  console.log(`SEO meta chars: min=${l.seoDescriptionChars.min} avg=${l.seoDescriptionChars.avg} median=${l.seoDescriptionChars.median} max=${l.seoDescriptionChars.max}`);
  console.log(`Slug chars: min=${l.slugChars.min} avg=${l.slugChars.avg} median=${l.slugChars.median} max=${l.slugChars.max}`);
  console.log(`SEO titles > 60 chars: ${l.seoTitlesOver60.length}`);
  console.log(`SEO descriptions > 160 chars: ${l.seoDescriptionsOver160.length}`);
  console.log(`Full descriptions < 80 words: ${l.fullDescriptionsUnder80Words.length}`);
  console.log(`Full descriptions > 180 words: ${l.fullDescriptionsOver180Words.length}`);

  console.log("\n--- Slug audit ---");
  console.log(`Duplicate final slugs: ${audit.slugAudit.duplicateFinalSlugs.length}`);
  if (audit.slugAudit.duplicateFinalSlugs.length) {
    console.log(`  ${audit.slugAudit.duplicateFinalSlugs.slice(0, 10).join(", ")}`);
  }
  console.log(`Slugs > 60 chars: ${audit.slugAudit.slugsOver60Chars.length}`);
  console.log(`Suspicious slugs for review: ${audit.slugAudit.suspiciousSlugs.length}`);

  console.log("\n--- Category QA sample (30 products) ---\n");
  for (const entry of audit.categorySample) {
    console.log(`SKU: ${entry.sku}`);
    console.log(`Name: ${entry.productName}`);
    console.log(`Category: ${entry.category}`);
    console.log(`SHORT:\n${entry.aiShortDescription}`);
    console.log(`FULL:\n${entry.aiFullDescription}`);
    console.log(`SEO TITLE: ${entry.aiSeoTitle}`);
    console.log(`SEO DESCRIPTION: ${entry.aiSeoDescription}`);
    console.log(`SLUG: ${entry.finalValidatedSlug}`);
    console.log("=".repeat(80));
  }
}

export function readinessAssessment(
  entries: AiSeoManifestEntry[],
  audit: AiManifestAuditReport,
  failedSkus: string[],
): "READY FOR LOCAL DB IMPORT" | "NOT READY FOR LOCAL DB IMPORT" {
  if (failedSkus.length > 0) return "NOT READY FOR LOCAL DB IMPORT";
  if (audit.mixedScript.affectedSkus.length > 0) return "NOT READY FOR LOCAL DB IMPORT";
  if (audit.factualSafety.unresolvedBlockingFlags.length > 0) return "NOT READY FOR LOCAL DB IMPORT";
  if (audit.slugAudit.duplicateFinalSlugs.length > 0) return "NOT READY FOR LOCAL DB IMPORT";
  const georgia = audit.keywordAudit.find((k) => k.label === "საქართველოში");
  if (georgia && georgia.totalOccurrences > 0) return "NOT READY FOR LOCAL DB IMPORT";
  const successCount = entries.filter((e) => e.generationStatus !== "failed").length;
  if (successCount < 458) return "NOT READY FOR LOCAL DB IMPORT";
  return "READY FOR LOCAL DB IMPORT";
}
