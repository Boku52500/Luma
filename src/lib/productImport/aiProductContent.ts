import { z } from "zod";

import { AI_COPYWRITER_SYSTEM_PROMPT, CONTENT_PROMPT_VERSION } from "./aiCopywriterPrompt";
import { buildAiContentCacheKey, readAiContentCache, writeAiContentCache, type AiContentCacheEntry } from "./aiContentCache";
import { buildAiProductFactsPayload, type AiProductFactsPayload } from "./aiProductFactsPayload";
import { cleanGeneratedText } from "./content";
import type { ContentQualityFlag } from "./contentQuality";
import { normalizeAiSlugSuggestion, resolveCompactProductSlugWithAiSuggestion } from "./compactSlug";
import type { ExcelProductRow } from "./excelProducts";
import { parseProductFacts } from "./parseProductFacts";
import { validateAiClaims, validateAiCommercialSeo, summarizePeerCommercialUsage } from "./validateAiClaims";
import { analyzeContentQuality, type SeoManifestEntry } from "./contentQuality";

export type AiProductContentFields = {
  shortDescription: string;
  fullDescription: string;
  seoTitle: string;
  seoDescription: string;
  slugSuggestion: string;
};

const aiResponseSchema = z.object({
  shortDescription: z.string().min(1),
  fullDescription: z.string().min(1),
  seoTitle: z.string().min(1),
  seoDescription: z.string().min(1),
  slugSuggestion: z.string().min(1),
});

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type AiGeneratedProductContent = {
  sku: string;
  sourceFacts: AiProductFactsPayload;
  content: AiProductContentFields;
  aiSlugSuggestion: string;
  aiSlugSuggestionNormalized: string;
  finalSlug: string;
  qualityFlags: ContentQualityFlag[];
  claimFlags: Array<{ code: string; message: string }>;
  generationStatus: "success" | "cached" | "failed";
  model: string;
  tokenUsage: TokenUsage | null;
  cacheKey: string;
  retries: number;
  error?: string;
};

export type AiProviderConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const MAX_QUALITY_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 120_000;

export class AiProviderFatalError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "AiProviderFatalError";
    this.code = code;
  }
}

function isFatalProviderError(
  status: number,
  error?: { message?: string; code?: string; type?: string },
): boolean {
  if (status === 401 || status === 403) return true;
  const code = error?.code ?? "";
  const type = error?.type ?? "";
  if (code === "insufficient_quota" || type === "insufficient_quota") return true;
  const message = error?.message ?? "";
  if (/insufficient_quota|billing|credit|authentication|invalid_api_key|incorrect api key|no credits/i.test(message)) {
    return true;
  }
  return false;
}

export function resolveAiProviderConfig(): AiProviderConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
    baseUrl: (process.env.OPENAI_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, ""),
  };
}

export function describeMissingAiProvider(): string {
  return [
    "No LLM API credentials found.",
    "Configure one of:",
    "  OPENAI_API_KEY=sk-...        (required)",
    "  OPENAI_MODEL=gpt-4o-mini     (optional, default gpt-4o-mini)",
    "  OPENAI_BASE_URL=https://api.openai.com/v1  (optional, for OpenAI-compatible providers)",
    "",
    "Add these to .env.local (not committed to Git), then rerun:",
    "  npm run products:ai-seo-test -- \"C:\\path\\products.xlsx\"",
  ].join("\n");
}

function buildUserPrompt(
  payload: AiProductFactsPayload,
  options?: { feedback?: string; peerCommercialCounts?: Record<string, number> },
): string {
  const base: Record<string, unknown> = {
    instruction: "Write individually authored Georgian ecommerce/SEO content for this ONE product.",
    product: payload,
    outputSchema: {
      shortDescription: "string",
      fullDescription: "string",
      seoTitle: "string",
      seoDescription: "string",
      slugSuggestion: "string",
    },
  };
  if (options?.peerCommercialCounts && Object.keys(options.peerCommercialCounts).length > 0) {
    base.catalogueContext = {
      note: "Other products in this batch already use these commercial phrases. Choose different natural wording from the approved vocabulary for THIS product.",
      peerPhraseCounts: options.peerCommercialCounts,
    };
  }
  if (options?.feedback) {
    base.rewriteFeedback = options.feedback;
  }
  return JSON.stringify(base, null, 2);
}

async function callChatModel(
  config: AiProviderConfig,
  userPrompt: string,
): Promise<{ parsed: AiProductContentFields; tokenUsage: TokenUsage | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AI_COPYWRITER_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    const body = (await response.json()) as {
      error?: { message?: string; code?: string; type?: string };
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    if (!response.ok) {
      if (isFatalProviderError(response.status, body.error)) {
        throw new AiProviderFatalError(
          body.error?.message ?? `LLM HTTP ${response.status}`,
          body.error?.code ?? body.error?.type ?? `http_${response.status}`,
        );
      }
      throw new Error(body.error?.message ?? `LLM HTTP ${response.status}`);
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty content");

    const json = JSON.parse(content) as unknown;
    const parsed = aiResponseSchema.parse(json);

    const tokenUsage = body.usage
      ? {
          promptTokens: body.usage.prompt_tokens ?? 0,
          completionTokens: body.usage.completion_tokens ?? 0,
          totalTokens: body.usage.total_tokens ?? 0,
        }
      : null;

    return {
      parsed: {
        shortDescription: cleanGeneratedText(parsed.shortDescription),
        fullDescription: cleanGeneratedText(parsed.fullDescription),
        seoTitle: cleanGeneratedText(parsed.seoTitle),
        seoDescription: cleanGeneratedText(parsed.seoDescription),
        slugSuggestion: parsed.slugSuggestion.trim(),
      },
      tokenUsage,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function collectQualityFlags(
  entry: SeoManifestEntry,
  allEntries: SeoManifestEntry[],
  facts: ReturnType<typeof parseProductFacts>,
): ContentQualityFlag[] {
  const report = analyzeContentQuality(allEntries);
  const skuFlags = report.flags.filter((f) => f.sku === entry.sku || f.sku === "*");
  const claimFlags = validateAiClaims(
    `${entry.proposedShortDescription}\n${entry.proposedFullDescription}\n${entry.proposedSeoTitle}\n${entry.proposedSeoDescription}`,
    facts,
  );
  const commercialFlags = validateAiCommercialSeo({
    shortDescription: entry.proposedShortDescription,
    fullDescription: entry.proposedFullDescription,
    seoTitle: entry.proposedSeoTitle,
    seoDescription: entry.proposedSeoDescription,
  });
  return [
    ...skuFlags,
    ...claimFlags.map((f) => ({ sku: entry.sku, code: f.code, message: f.message })),
    ...commercialFlags.map((f) => ({ sku: entry.sku, code: f.code, message: f.message })),
  ];
}

function qualityFailureFeedback(flags: ContentQualityFlag[]): string {
  const messages = flags.map((f) => `${f.code}: ${f.message}`);
  return `Rewrite this product. Previous copy failed quality checks: ${messages.join("; ")}. Write fresh individually authored Georgian copy.`;
}

const closingRewriteSchema = z.object({
  commercialClosing: z.string().min(8),
});

const seoMetaRewriteSchema = z.object({
  seoTitle: z.string().min(1),
  seoDescription: z.string().min(1),
});

async function callJsonModel<T>(
  config: AiProviderConfig,
  userPrompt: string,
  schema: z.ZodType<T>,
): Promise<{ parsed: T; tokenUsage: TokenUsage | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: AI_COPYWRITER_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    const body = (await response.json()) as {
      error?: { message?: string; code?: string; type?: string };
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    if (!response.ok) {
      if (isFatalProviderError(response.status, body.error)) {
        throw new AiProviderFatalError(
          body.error?.message ?? `LLM HTTP ${response.status}`,
          body.error?.code ?? body.error?.type ?? `http_${response.status}`,
        );
      }
      throw new Error(body.error?.message ?? `LLM HTTP ${response.status}`);
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("LLM returned empty content");
    const parsed = schema.parse(JSON.parse(content) as unknown);
    const tokenUsage = body.usage
      ? {
          promptTokens: body.usage.prompt_tokens ?? 0,
          completionTokens: body.usage.completion_tokens ?? 0,
          totalTokens: body.usage.total_tokens ?? 0,
        }
      : null;
    return { parsed, tokenUsage };
  } finally {
    clearTimeout(timeout);
  }
}

/** Split full description into factual body + final commercial closing sentence. */
export function splitCommercialClosing(fullDescription: string): { body: string; closing: string } {
  const parts = fullDescription
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return { body: "", closing: fullDescription.trim() };
  const closing = parts[parts.length - 1]!;
  const body = parts.slice(0, -1).join(" ");
  return { body, closing };
}

/**
 * AI-rewrite ONLY the final commercial closing sentence of a full description.
 * Preserves the factual body paragraphs. Uses QA retries for blocking failures.
 */
export async function rewriteCommercialClosingOnly(input: {
  config: AiProviderConfig;
  sku: string;
  productName: string;
  brand: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  seoTitle: string;
  seoDescription: string;
  peerClosingCounts: Record<string, number>;
  reservedClosingsAvoid: string[];
}): Promise<{ fullDescription: string; tokenUsage: TokenUsage | null; retries: number }> {
  const facts = parseProductFacts({
    sku: input.sku,
    name: input.productName,
    brand: input.brand,
    category: input.category,
  });
  const { body, closing: oldClosing } = splitCommercialClosing(input.fullDescription);
  if (!body) {
    return { fullDescription: input.fullDescription, tokenUsage: null, retries: 0 };
  }

  let feedback: string | undefined;
  let totalTokenUsage: TokenUsage | null = null;

  for (let attempt = 0; attempt <= MAX_QUALITY_RETRIES; attempt += 1) {
    const userPrompt = JSON.stringify(
      {
        instruction:
          "Rewrite ONLY the final commercial closing sentence for this Georgian ecommerce product. Keep the factual body unchanged. Return JSON { commercialClosing }. One natural sentence with purchase/price/financing intent for Luma. Vary wording — do NOT copy overused catalogue closings. Never use საქართველოში. Do not invent specs.",
        product: {
          sku: input.sku,
          productName: input.productName,
          brand: input.brand,
          category: input.category,
        },
        factualBodyPreserveExactly: body,
        previousClosing: oldClosing,
        shortDescription: input.shortDescription,
        catalogueClosingPressure: input.peerClosingCounts,
        avoidExactClosings: input.reservedClosingsAvoid.slice(0, 40),
        rewriteFeedback: feedback,
      },
      null,
      2,
    );

    const { parsed, tokenUsage } = await callJsonModel(input.config, userPrompt, closingRewriteSchema);
    if (tokenUsage) {
      totalTokenUsage = totalTokenUsage
        ? {
            promptTokens: totalTokenUsage.promptTokens + tokenUsage.promptTokens,
            completionTokens: totalTokenUsage.completionTokens + tokenUsage.completionTokens,
            totalTokens: totalTokenUsage.totalTokens + tokenUsage.totalTokens,
          }
        : tokenUsage;
    }

    let closing = cleanGeneratedText(parsed.commercialClosing).trim();
    if (!/[.!?]$/.test(closing)) closing = `${closing}.`;
    const fullDescription = `${body} ${closing}`.trim();

    const entry: SeoManifestEntry = {
      sku: input.sku,
      productName: input.productName,
      brand: input.brand,
      category: input.category,
      currentSlug: null,
      proposedSlug: "temp",
      proposedShortDescription: input.shortDescription,
      proposedFullDescription: fullDescription,
      proposedSeoTitle: input.seoTitle,
      proposedSeoDescription: input.seoDescription,
    };
    const flags = collectQualityFlags(entry, [entry], facts).filter((f) =>
      [
        "FORBIDDEN_CLAIM",
        "FORBIDDEN_GEORGIA_IN",
        "WEAK_SEO_META",
        "INVENTED_SPEC",
        "OLD_BOILERPLATE",
        "DUPLICATE_BRAND",
        "KEYWORD_STUFFING",
        "MIXED_SCRIPT_GEORGIAN",
      ].includes(f.code),
    );

    const sameAsOld = closing.toLowerCase() === oldClosing.toLowerCase();
    const avoidedHit = input.reservedClosingsAvoid.some((c) => c.toLowerCase() === closing.toLowerCase());
    if ((flags.length > 0 || sameAsOld || avoidedHit) && attempt < MAX_QUALITY_RETRIES) {
      feedback = [
        flags.length ? qualityFailureFeedback(flags) : "",
        sameAsOld ? "Do not reuse the previous closing sentence." : "",
        avoidedHit ? "Do not reuse an overused catalogue closing sentence." : "",
        "Prefer Georgian phrasing like 'ამ მოდელის შესაძენად' instead of attaching Georgian case endings directly onto long Latin model codes.",
      ]
        .filter(Boolean)
        .join(" ");
      continue;
    }

    // Never accept a rewrite that still fails blocking checks.
    if (flags.length > 0 || sameAsOld) {
      return { fullDescription: input.fullDescription, tokenUsage: totalTokenUsage, retries: attempt };
    }

    return { fullDescription, tokenUsage: totalTokenUsage, retries: attempt };
  }

  return { fullDescription: input.fullDescription, tokenUsage: totalTokenUsage, retries: MAX_QUALITY_RETRIES };
}

/** AI-rewrite SEO title + meta only (for near-duplicate variants that need unique truthful meta). */
export async function rewriteSeoTitleMetaOnly(input: {
  config: AiProviderConfig;
  sku: string;
  productName: string;
  brand: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  currentSeoTitle: string;
  currentSeoDescription: string;
  mustIncludeTokens: string[];
  avoidExactTitles: string[];
  avoidExactMetas: string[];
}): Promise<{ seoTitle: string; seoDescription: string; tokenUsage: TokenUsage | null; retries: number }> {
  const facts = parseProductFacts({
    sku: input.sku,
    name: input.productName,
    brand: input.brand,
    category: input.category,
  });
  let feedback: string | undefined;
  let totalTokenUsage: TokenUsage | null = null;

  for (let attempt = 0; attempt <= MAX_QUALITY_RETRIES; attempt += 1) {
    const userPrompt = JSON.stringify(
      {
        instruction:
          "Rewrite ONLY seoTitle and seoDescription for this product so they are unique vs sibling variants, still truthful, and keep strong commercial SEO intent. Include the distinguishing model tokens supplied. Never invent specs. Never use საქართველოში. Return JSON { seoTitle, seoDescription }.",
        product: {
          sku: input.sku,
          productName: input.productName,
          brand: input.brand,
          category: input.category,
          mustIncludeTokens: input.mustIncludeTokens,
        },
        shortDescription: input.shortDescription,
        fullDescription: input.fullDescription,
        previous: { seoTitle: input.currentSeoTitle, seoDescription: input.currentSeoDescription },
        avoidExactTitles: input.avoidExactTitles,
        avoidExactMetas: input.avoidExactMetas,
        rewriteFeedback: feedback,
      },
      null,
      2,
    );

    const { parsed, tokenUsage } = await callJsonModel(input.config, userPrompt, seoMetaRewriteSchema);
    if (tokenUsage) {
      totalTokenUsage = totalTokenUsage
        ? {
            promptTokens: totalTokenUsage.promptTokens + tokenUsage.promptTokens,
            completionTokens: totalTokenUsage.completionTokens + tokenUsage.completionTokens,
            totalTokens: totalTokenUsage.totalTokens + tokenUsage.totalTokens,
          }
        : tokenUsage;
    }

    const seoTitle = cleanGeneratedText(parsed.seoTitle);
    const seoDescription = cleanGeneratedText(parsed.seoDescription);
    const entry: SeoManifestEntry = {
      sku: input.sku,
      productName: input.productName,
      brand: input.brand,
      category: input.category,
      currentSlug: null,
      proposedSlug: "temp",
      proposedShortDescription: input.shortDescription,
      proposedFullDescription: input.fullDescription,
      proposedSeoTitle: seoTitle,
      proposedSeoDescription: seoDescription,
    };
    const flags = collectQualityFlags(entry, [entry], facts).filter((f) =>
      [
        "FORBIDDEN_CLAIM",
        "FORBIDDEN_GEORGIA_IN",
        "WEAK_SEO_META",
        "INVENTED_SPEC",
        "MIXED_SCRIPT_GEORGIAN",
        "KEYWORD_STUFFING",
      ].includes(f.code),
    );
    const missingToken = input.mustIncludeTokens.some(
      (t) => !`${seoTitle} ${seoDescription}`.toLowerCase().includes(t.toLowerCase()),
    );
    const titleClash = input.avoidExactTitles.some((t) => t.toLowerCase() === seoTitle.toLowerCase());
    const metaClash = input.avoidExactMetas.some((t) => t.toLowerCase() === seoDescription.toLowerCase());

    if ((flags.length > 0 || missingToken || titleClash || metaClash) && attempt < MAX_QUALITY_RETRIES) {
      feedback = [
        flags.length ? qualityFailureFeedback(flags) : "",
        missingToken ? `Must include distinguishing tokens: ${input.mustIncludeTokens.join(", ")}` : "",
        titleClash || metaClash ? "Title/meta must differ from sibling variants." : "",
      ]
        .filter(Boolean)
        .join(" ");
      continue;
    }

    return { seoTitle, seoDescription, tokenUsage: totalTokenUsage, retries: attempt };
  }

  return {
    seoTitle: input.currentSeoTitle,
    seoDescription: input.currentSeoDescription,
    tokenUsage: totalTokenUsage,
    retries: MAX_QUALITY_RETRIES,
  };
}

/** Recompute quality flags for one entry against the full catalogue peer set. */
export function recomputeQualityFlags(
  entry: SeoManifestEntry,
  allEntries: SeoManifestEntry[],
): ContentQualityFlag[] {
  const facts = parseProductFacts({
    sku: entry.sku,
    name: entry.productName,
    brand: entry.brand,
    category: entry.category,
  });
  return collectQualityFlags(entry, allEntries, facts);
}

export async function generateAiProductContent(
  row: ExcelProductRow,
  options: {
    config: AiProviderConfig;
    reservedSlugs: Set<string>;
    currentSlug?: string | null;
    peerEntries?: SeoManifestEntry[];
    useCache?: boolean;
  },
): Promise<AiGeneratedProductContent> {
  const facts = parseProductFacts(row);
  const sourceFacts = buildAiProductFactsPayload(facts);
  const cacheKey = buildAiContentCacheKey(row);

  if (options.useCache !== false) {
    const cached = await readAiContentCache(cacheKey);
    if (cached) {
      return {
        sku: row.sku,
        sourceFacts,
        content: cached.content,
        aiSlugSuggestion: cached.aiSlugSuggestion,
        aiSlugSuggestionNormalized: normalizeAiSlugSuggestion(cached.aiSlugSuggestion, facts),
        finalSlug: cached.finalSlug,
        qualityFlags: cached.qualityFlags,
        claimFlags: [],
        generationStatus: "cached",
        model: cached.model,
        tokenUsage: cached.tokenUsage,
        cacheKey,
        retries: 0,
      };
    }
  }

  let feedback: string | undefined;
  let lastError: string | undefined;
  let totalTokenUsage: TokenUsage | null = null;

  for (let attempt = 0; attempt <= MAX_QUALITY_RETRIES; attempt += 1) {
    try {
      const peerTexts =
        options.peerEntries?.flatMap((e) => [e.proposedSeoDescription, e.proposedFullDescription]) ?? [];
      const userPrompt = buildUserPrompt(sourceFacts, {
        feedback,
        peerCommercialCounts: summarizePeerCommercialUsage(peerTexts),
      });
      const { parsed, tokenUsage } = await callChatModel(options.config, userPrompt);

      if (tokenUsage) {
        totalTokenUsage = totalTokenUsage
          ? {
              promptTokens: totalTokenUsage.promptTokens + tokenUsage.promptTokens,
              completionTokens: totalTokenUsage.completionTokens + tokenUsage.completionTokens,
              totalTokens: totalTokenUsage.totalTokens + tokenUsage.totalTokens,
            }
          : tokenUsage;
      }

      const aiSlugSuggestionNormalized = normalizeAiSlugSuggestion(parsed.slugSuggestion, facts);
      const { slug: finalSlug } = resolveCompactProductSlugWithAiSuggestion(
        row,
        aiSlugSuggestionNormalized,
        options.reservedSlugs,
      );
      options.reservedSlugs.add(finalSlug);

      const entry: SeoManifestEntry = {
        sku: row.sku,
        productName: row.name,
        brand: row.brand,
        category: row.category,
        currentSlug: options.currentSlug ?? null,
        proposedSlug: finalSlug,
        proposedShortDescription: parsed.shortDescription,
        proposedFullDescription: parsed.fullDescription,
        proposedSeoTitle: parsed.seoTitle,
        proposedSeoDescription: parsed.seoDescription,
      };

      const peerEntries = [...(options.peerEntries ?? []), entry];
      const qualityFlags = collectQualityFlags(entry, peerEntries, facts);
      const blocking = qualityFlags.filter((f) =>
        [
          "FORBIDDEN_CLAIM",
          "FORBIDDEN_GEORGIA_IN",
          "WEAK_SEO_META",
          "INVENTED_SPEC",
          "OLD_BOILERPLATE",
          "DUPLICATE_BRAND",
          "KEYWORD_STUFFING",
          "MIXED_SCRIPT_GEORGIAN",
        ].includes(f.code),
      );

      if (blocking.length > 0 && attempt < MAX_QUALITY_RETRIES) {
        feedback = qualityFailureFeedback(blocking);
        continue;
      }

      const result: AiGeneratedProductContent = {
        sku: row.sku,
        sourceFacts,
        content: parsed,
        aiSlugSuggestion: parsed.slugSuggestion,
        aiSlugSuggestionNormalized,
        finalSlug,
        qualityFlags,
        claimFlags: validateAiClaims(
          `${parsed.shortDescription}\n${parsed.fullDescription}\n${parsed.seoDescription}`,
          facts,
        ),
        generationStatus: "success",
        model: options.config.model,
        tokenUsage: totalTokenUsage,
        cacheKey,
        retries: attempt,
      };

      const cacheEntry: AiContentCacheEntry = {
        cacheKey,
        promptVersion: CONTENT_PROMPT_VERSION,
        sku: row.sku,
        name: row.name,
        brand: row.brand,
        category: row.category,
        generatedAt: new Date().toISOString(),
        model: options.config.model,
        tokenUsage: totalTokenUsage,
        content: parsed,
        aiSlugSuggestion: parsed.slugSuggestion,
        finalSlug,
        qualityFlags,
        generationStatus: "success",
      };
      await writeAiContentCache(cacheEntry);

      return result;
    } catch (err) {
      if (err instanceof AiProviderFatalError) throw err;
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt >= MAX_QUALITY_RETRIES) break;
    }
  }

  return {
    sku: row.sku,
    sourceFacts,
    content: {
      shortDescription: "",
      fullDescription: "",
      seoTitle: "",
      seoDescription: "",
      slugSuggestion: "",
    },
    aiSlugSuggestion: "",
    aiSlugSuggestionNormalized: "",
    finalSlug: "",
    qualityFlags: [{ sku: row.sku, code: "GENERATION_FAILED", message: lastError ?? "Unknown error" }],
    claimFlags: [],
    generationStatus: "failed",
    model: options.config.model,
    tokenUsage: totalTokenUsage,
    cacheKey,
    retries: MAX_QUALITY_RETRIES,
    error: lastError,
  };
}
