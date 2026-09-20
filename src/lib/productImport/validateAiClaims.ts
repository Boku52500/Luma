import type { ProductFacts } from "./parseProductFacts";

export type ClaimValidationFlag = {
  code: string;
  message: string;
};

/** Spec-like tokens that must appear in source name or explicit facts. */
const INVENTED_SPEC_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b240\s*Hz\b/i, label: "240Hz refresh rate" },
  { pattern: /\b0\.03\s*ms\b/i, label: "0.03ms response time" },
  { pattern: /\bHDMI\s*2\.1\b/i, label: "HDMI 2.1" },
  { pattern: /\bOLED\b/i, label: "OLED panel" },
  { pattern: /\bAndroid\s*TV\b/i, label: "Android TV" },
  { pattern: /\bDolby\s*(?:Vision|Atmos)\b/i, label: "Dolby feature" },
  { pattern: /\bHDR10\+?\b/i, label: "HDR" },
  { pattern: /\bFull\s*HD\b/i, label: "Full HD" },
  { pattern: /\bIPS\b/i, label: "IPS panel" },
  { pattern: /\bVA\b\s*(?:პანელ|panel)/i, label: "VA panel" },
];

const FORBIDDEN_GEORGIA_IN = /საქართველოში/i;

const MALFORMED_GEORGIAN = /(?:^|\s)[\w\u10a0-\u10FF]+(?:ები|ები)-(?:ს|ში|ზe|ით)\b/i;

/** Georgian script (Mkhedruli + Mtavruli). */
const GEORGIAN_SCRIPT = /[\u10A0-\u10FF]/;
/** Latin ASCII letters only — not Georgian homoglyphs such as ე (U+10D4) or ი (U+10D8). */
const LATIN_ASCII = /[A-Za-z]/;

/** Brand/model Latin prefix + hyphen + Georgian suffix only (e.g. Luma-ში, iPhone-ის, SSD-ით, R9-9900X3D-ის). */
const VALID_LATIN_GEORGIAN_HYBRID = /^[A-Za-z0-9][A-Za-z0-9.+\/-]*-[\u10A0-\u10FF]+$/;

function stripTokenOuterPunctuation(token: string): string {
  return token.replace(/^[^\p{L}\p{N}\u10A0-\u10FF]+|[^\p{L}\p{N}\u10A0-\u10FF]+$/gu, "");
}

/** True when a single token illegally mixes Georgian script with Latin ASCII letters. */
export function isMixedScriptGeorgianToken(token: string): boolean {
  const core = stripTokenOuterPunctuation(token);
  if (!core) return false;
  if (!GEORGIAN_SCRIPT.test(core) || !LATIN_ASCII.test(core)) return false;
  if (VALID_LATIN_GEORGIAN_HYBRID.test(core)) return false;
  return true;
}

export function findMixedScriptTokensInText(text: string): string[] {
  const tokens = text.match(/[^\s]+/g) ?? [];
  const violations: string[] = [];
  for (const token of tokens) {
    if (isMixedScriptGeorgianToken(token)) {
      violations.push(stripTokenOuterPunctuation(token));
    }
  }
  return violations;
}

const SEO_META_COMMERCIAL_PATTERNS = [
  /ფას/i,
  /საუკეთესო\s+ფას(?:ი|ად)/i,
  /იაფ(?:ად|ი)?/i,
  /ყველაზე\s+იაფ(?:ად|ი)?/i,
  /დაბალ\s+ფას(?:ად|ი)?/i,
  /(?:ყიდვა|იყიდე|შეიძინ)/i,
  /განვადებ(?:ა|ით)/i,
];

export const COMMERCIAL_KEYWORD_COUNT_LABELS: Array<{ label: string; pattern: RegExp }> = [
  { label: "საქართველოში", pattern: /საქართველოში/gi },
  { label: "საუკეთესო ფასი", pattern: /საუკეთესო\s+ფასი/gi },
  { label: "საუკეთესო ფასად", pattern: /საუკეთესო\s+ფასად/gi },
  { label: "ყველაზე იაფი", pattern: /ყველაზე\s+იაფი/gi },
  { label: "ყველაზე იაფად", pattern: /ყველაზე\s+იაფად/gi },
  { label: "იაფად", pattern: /იაფად/gi },
  { label: "დაბალ ფასად", pattern: /დაბალ\s+ფასად/gi },
  { label: "ფასი", pattern: /ფას(?:ი|ს|ად|ებ)?/gi },
  { label: "მიმდინარე ფასი", pattern: /მიმდინარე\s+ფას(?:ი|ს)?/gi },
  { label: "განვადება", pattern: /განვადებ(?!ით)/gi },
  { label: "განვადებით", pattern: /განვადებით/gi },
  { label: "შეიძინე", pattern: /შეიძინ(?:ე|ოთ)?/gi },
  { label: "იყიდე", pattern: /იყიდ(?:ე|ოთ)?/gi },
  { label: "ყიდვა", pattern: /ყიდვ(?:ა|ის|ით)?/gi },
  { label: "Luma", pattern: /Luma/gi },
];

function sourceCorpus(facts: ProductFacts): string {
  return [facts.name, facts.cleanName, ...facts.explicitTokens].join(" ");
}

function patternAllowedInSource(pattern: RegExp, source: string): boolean {
  return pattern.test(source);
}

export function containsForbiddenGeorgia(text: string): boolean {
  return FORBIDDEN_GEORGIA_IN.test(text);
}

export function containsMixedScriptGeorgian(text: string): boolean {
  return findMixedScriptTokensInText(text).length > 0;
}

export function findMixedScriptViolations(texts: string[]): string[] {
  const violations: string[] = [];
  for (const text of texts) {
    violations.push(...findMixedScriptTokensInText(text));
  }
  return [...new Set(violations)];
}

export function seoMetaHasCommercialIntent(seoDescription: string): boolean {
  return SEO_META_COMMERCIAL_PATTERNS.some((pattern) => pattern.test(seoDescription));
}

/** QA checks for model-authored copy against supplied facts only. */
export function validateAiClaims(text: string, facts: ProductFacts): ClaimValidationFlag[] {
  const flags: ClaimValidationFlag[] = [];
  const source = sourceCorpus(facts);
  const combined = `${text}`;

  if (containsForbiddenGeorgia(combined)) {
    flags.push({
      code: "FORBIDDEN_GEORGIA_IN",
      message: 'Forbidden phrase "საქართველოში" detected',
    });
  }

  if (containsMixedScriptGeorgian(combined)) {
    flags.push({
      code: "MIXED_SCRIPT_GEORGIAN",
      message: "Georgian word contains accidental Latin letters (e.g. მქონe, იყიდe)",
    });
  }

  for (const { pattern, label } of INVENTED_SPEC_PATTERNS) {
    if (pattern.test(combined) && !patternAllowedInSource(pattern, source)) {
      flags.push({
        code: "INVENTED_SPEC",
        message: `Possible invented spec: ${label}`,
      });
    }
  }

  if (MALFORMED_GEORGIAN.test(combined)) {
    flags.push({
      code: "MALFORMED_GEORGIAN",
      message: "Malformed Georgian declension (e.g. category-ს)",
    });
  }

  const brandEscaped = facts.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const brandRe = new RegExp(`\\b(${brandEscaped})\\s+\\1\\b`, "i");
  if (brandRe.test(combined)) {
    flags.push({
      code: "DUPLICATE_BRAND",
      message: "Duplicated brand name in copy",
    });
  }

  const cheapSynonyms =
    combined.match(/(?:იაფ(?:ად|ი)?|საუკეთესო\s+ფას(?:ი|ად)|ყველაზე\s+იაფ(?:ად|ი)?|დაბალ\s+ფას(?:ად|ი)?)/gi)?.length ?? 0;
  if (cheapSynonyms >= 4) {
    flags.push({
      code: "KEYWORD_STUFFING",
      message: "Too many price/cheap synonyms in one product",
    });
  }

  return flags;
}

export function validateAiCommercialSeo(fields: {
  shortDescription: string;
  fullDescription: string;
  seoTitle: string;
  seoDescription: string;
}): ClaimValidationFlag[] {
  const flags: ClaimValidationFlag[] = [];
  const allText = [fields.shortDescription, fields.fullDescription, fields.seoTitle, fields.seoDescription].join("\n");

  if (containsForbiddenGeorgia(allText)) {
    flags.push({
      code: "FORBIDDEN_GEORGIA_IN",
      message: 'Forbidden phrase "საქართველოში" detected in generated content',
    });
  }

  if (containsMixedScriptGeorgian(allText)) {
    flags.push({
      code: "MIXED_SCRIPT_GEORGIAN",
      message: "Georgian word contains accidental Latin letters in generated content",
    });
  }

  if (!seoMetaHasCommercialIntent(fields.seoDescription)) {
    flags.push({
      code: "WEAK_SEO_META",
      message: "SEO meta description lacks required commercial price/purchase/financing intent",
    });
  }

  return flags;
}

export function countCommercialKeywords(texts: string[]): Record<string, number> {
  const combined = texts.join("\n");
  const counts: Record<string, number> = {};
  for (const { label, pattern } of COMMERCIAL_KEYWORD_COUNT_LABELS) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    counts[label] = (combined.match(re) ?? []).length;
  }
  return counts;
}

function normalizeCommercialStructure(sentence: string): string {
  return sentence
    .replace(/Luma-?(?:ში|ს)?/gi, "LUMA")
    .replace(/\b[\w.-]+\b/g, (word) => (/[\u10a0-\u10ff]/.test(word) ? word : "X"))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type CommercialRepetitionReport = {
  exactSentences: Array<{ sentence: string; skus: string[] }>;
  structurePatterns: Array<{ pattern: string; skus: string[] }>;
};

export function analyzeCommercialRepetition(
  entries: Array<{ sku: string; seoDescription: string; fullDescription: string }>,
): CommercialRepetitionReport {
  const sentenceMap = new Map<string, string[]>();
  const structureMap = new Map<string, string[]>();

  for (const entry of entries) {
    const sentences = [
      ...entry.seoDescription.split(/(?<=[.!?])\s+/),
      ...entry.fullDescription.split(/(?<=[.!?])\s+/),
    ].filter((s) => /(?:ფას|შეიძინ|იყიდ|განვად|Luma)/i.test(s));

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length < 20) continue;
      const key = trimmed.toLowerCase();
      const skus = sentenceMap.get(key) ?? [];
      skus.push(entry.sku);
      sentenceMap.set(key, skus);

      const structure = normalizeCommercialStructure(trimmed);
      if (structure.length >= 15) {
        const structSkus = structureMap.get(structure) ?? [];
        structSkus.push(entry.sku);
        structureMap.set(structure, structSkus);
      }
    }
  }

  const exactSentences = [...sentenceMap.entries()]
    .filter(([, skus]) => skus.length > 1)
    .map(([sentence, skus]) => ({ sentence, skus: [...new Set(skus)] }));

  const structurePatterns = [...structureMap.entries()]
    .filter(([, skus]) => skus.length > 1)
    .map(([pattern, skus]) => ({ pattern, skus: [...new Set(skus)] }));

  return { exactSentences, structurePatterns };
}

export function summarizePeerCommercialUsage(peerTexts: string[]): Record<string, number> | undefined {
  if (!peerTexts.length) return undefined;
  return countCommercialKeywords(peerTexts);
}
