import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildAiContentCacheKey } from "./aiContentCache";
import { buildAiProductFactsPayload } from "./aiProductFactsPayload";
import { buildCompactSlug, normalizeAiSlugSuggestion, resolveCompactProductSlug } from "./compactSlug";
import { composeProductContent, OLD_BOILERPLATE_PATTERNS } from "./composeProductContent";
import { analyzeContentQuality } from "./contentQuality";
import { parseProductFacts } from "./parseProductFacts";
import { selectAiTestProducts } from "./selectAiTestProducts";
import {
  containsMixedScriptGeorgian,
  isMixedScriptGeorgianToken,
  validateAiClaims,
  validateAiCommercialSeo,
} from "./validateAiClaims";
import type { SeoManifestEntry } from "./contentQuality";
import type { ExcelProductRow } from "./excelProducts";

describe("compact slug generation", () => {
  it("removes supplier codes and keeps model identity", () => {
    const facts = parseProductFacts({
      sku: "1",
      name: "AMD CPU Ryzen X8 R7-8700F SAM5 65W 4100-100-000001590",
      brand: "AMD",
      category: "პროცესორი",
    });
    const slug = buildCompactSlug(facts);
    assert.match(slug, /amd/);
    assert.match(slug, /8700f/i);
    assert.doesNotMatch(slug, /4100-100-000001590/);
  });

  it("compacts monitor slug to brand model and resolution", () => {
    const slug = buildCompactSlug(
      parseProductFacts({
        sku: "2",
        name: 'Asus ROG Strix XG32UCDS 31.5" 4K 90LM0A50-B01370 - Black',
        brand: "ASUS",
        category: "მონიტორები",
      }),
    );
    assert.match(slug, /asus/);
    assert.match(slug, /xg32ucds/i);
    assert.match(slug, /4k/i);
    assert.doesNotMatch(slug, /90lm0a50/i);
  });

  it("resolves slug collisions with smallest differentiator before SKU", () => {
    const reserved = new Set<string>(["samsung-990-pro-1tb"]);
    const { slug } = resolveCompactProductSlug(
      {
        sku: "A",
        name: "Samsung 990 PRO 1TB MZ-V9P1T0BW",
        brand: "Samsung",
        category: "მეხსიერება SSD/HDD",
      },
      reserved,
    );
    assert.notEqual(slug, "samsung-990-pro-1tb");
    assert.match(slug, /990-pro-1tb/i);
  });
});

describe("fact-driven product content", () => {
  it("does not use old boilerplate template phrasing", () => {
    const content = composeProductContent({
      sku: "160903",
      name: 'Lenovo Legion R45w-30 44.5" DQHD 67B1GAC3EU - Black',
      brand: "Lenovo",
      category: "მონიტორები",
    });
    for (const pattern of OLD_BOILERPLATE_PATTERNS) {
      assert.doesNotMatch(content.shortDescription, pattern);
      assert.doesNotMatch(content.fullDescription, pattern);
    }
    assert.match(content.shortDescription, /44\.5|DQHD|Lenovo/i);
  });

  it("uses parsed resolution without inventing refresh rate", () => {
    const content = composeProductContent({
      sku: "999",
      name: 'Asus ROG Strix XG32UCDS 31.5" 4K',
      brand: "ASUS",
      category: "მონიტორები",
    });
    assert.match(content.shortDescription, /4K/i);
    assert.doesNotMatch(content.fullDescription, /240Hz|OLED|0\.03/i);
  });

  it("produces distinct short descriptions for different products", () => {
    const a = composeProductContent({
      sku: "1",
      name: "Intel Core i5-14400F",
      brand: "Intel",
      category: "პროცესორი",
    });
    const b = composeProductContent({
      sku: "2",
      name: "Apple iPhone 16 128GB - Black",
      brand: "Apple",
      category: "ტელეფონები",
    });
    assert.notEqual(a.shortDescription, b.shortDescription);
  });
});

describe("content quality manifest validation", () => {
  it("detects duplicate SEO titles and phrase repetition", () => {
    const base: SeoManifestEntry = {
      sku: "1",
      productName: "A",
      brand: "B",
      category: "C",
      currentSlug: "old",
      proposedSlug: "new-a",
      proposedShortDescription: "Short A unique text here for testing minimum useful length ok",
      proposedFullDescription: "Full A unique body with enough words to pass validation comfortably here.",
      proposedSeoTitle: "Same Title | Luma",
      proposedSeoDescription: "Meta A",
    };
    const entries: SeoManifestEntry[] = [
      base,
      { ...base, sku: "2", proposedSlug: "new-b", proposedShortDescription: "Short B unique different product copy here ok" },
    ];
    const report = analyzeContentQuality(entries);
    assert.ok(report.duplicateSeoTitles.length >= 1);
    assert.equal(report.total, 2);
  });
});

describe("AI content infrastructure", () => {
  it("builds explicit facts payload without inferred specs", () => {
    const facts = parseProductFacts({
      sku: "1",
      name: "Samsung 990 PRO 1TB MZ-V9P1T0BW",
      brand: "Samsung",
      category: "მეხსიერება SSD/HDD",
    });
    const payload = buildAiProductFactsPayload(facts);
    assert.equal(payload.explicitFacts.includes("1TB"), true);
    assert.match(payload.parsed.primaryStorage ?? "", /1TB/);
  });

  it("normalizes AI slug suggestions and dedupes tokens", () => {
    const facts = parseProductFacts({
      sku: "2",
      name: 'Asus ROG Strix XG32UCDS 31.5" 4K',
      brand: "ASUS",
      category: "მონიტორები",
    });
    const slug = normalizeAiSlugSuggestion("asus-rog-strix-xg32ucds-asus-4k", facts);
    assert.match(slug, /asus/);
    assert.match(slug, /xg32ucds/i);
    assert.doesNotMatch(slug, /asus-asus/);
  });

  it("flags invented specs but allows approved price superlatives", () => {
    const facts = parseProductFacts({
      sku: "3",
      name: "TCL 32S5K",
      brand: "TCL",
      category: "ტელევიზორი",
    });
    const invented = validateAiClaims("TCL 32S5K Full HD Android TV OLED", facts);
    assert.ok(invented.some((f) => f.code === "INVENTED_SPEC"));
    assert.ok(!invented.some((f) => f.code === "UNSUPPORTED_PRICE_CLAIM"));

    const approved = validateAiClaims("შეიძინe იაფად Luma-ში საუკეთესო ფასად", facts);
    assert.ok(approved.some((f) => f.code === "MIXED_SCRIPT_GEORGIAN"));

    const clean = validateAiClaims("შეიძინე იაფად Luma-ში საუკეთესო ფასად", facts);
    assert.ok(!clean.some((f) => f.code === "MIXED_SCRIPT_GEORGIAN"));
    assert.ok(!clean.some((f) => f.code === "UNSUPPORTED_PRICE_CLAIM"));
  });

  it("rejects forbidden საქართველოში and weak SEO meta", () => {
    const flags = validateAiCommercialSeo({
      shortDescription: "test",
      fullDescription: "test",
      seoTitle: "title",
      seoDescription: "მხოლოდ პროდუქტის აღწერა",
    });
    assert.ok(flags.some((f) => f.code === "WEAK_SEO_META"));

    const georgia = validateAiCommercialSeo({
      shortDescription: "test",
      fullDescription: "test",
      seoTitle: "title",
      seoDescription: "შეიძინe საქართველოში",
    });
    assert.ok(georgia.some((f) => f.code === "FORBIDDEN_GEORGIA_IN"));
  });

  it("selects up to 10 diverse category slots", () => {
    const rows: ExcelProductRow[] = [
      { excelRowNumber: 1, sku: "c1", name: "AMD Ryzen 7 8700F", brand: "AMD", category: "პროცესორი", categoryExcel: "პროცესორი", price: "100" },
      { excelRowNumber: 2, sku: "g1", name: "ASUS RTX 5060 Ti", brand: "ASUS", category: "ვიდეობარათები", categoryExcel: "ვიდეობარათები", price: "200" },
      { excelRowNumber: 3, sku: "m1", name: 'Asus ROG 31.5" 4K', brand: "ASUS", category: "მონიტორები", categoryExcel: "მონიტორები", price: "300" },
    ];
    const picked = selectAiTestProducts(rows);
    assert.ok(picked.length >= 3);
    assert.equal(buildAiContentCacheKey(rows[0]!).length > 0, true);
  });

  it("rule-based composer no longer uses საქართველოში", () => {
    for (let i = 0; i < 20; i += 1) {
      const content = composeProductContent({
        sku: String(i),
        name: `Test Product ${i}`,
        brand: "TestBrand",
        category: "მონიტორები",
      });
      assert.doesNotMatch(content.fullDescription, /საქართველოში/);
      assert.doesNotMatch(content.seoDescription, /საქართველოში/);
    }
  });
});

describe("mixed-script Georgian token detection", () => {
  const invalidTokens = [
    "შეიძინe",
    "ნახe",
    "ფასi",
    "მქონe",
    "სმარტფონi",
    "თეთრi",
    "კორპუსi",
    "შეარჩიe",
    "ისარგებლe",
    "შეამოწმe",
  ];

  const validExamples: Array<{ text: string; label: string }> = [
    { text: "Luma-ში", label: "Luma-ში" },
    { text: "iPhone-ის", label: "iPhone-ის" },
    { text: "ASUS-ის", label: "ASUS-ის" },
    { text: "SSD-ით", label: "SSD-ით" },
    { text: "ARGB განათებით", label: "ARGB განათებით" },
    { text: "MacBook Air-ის", label: "MacBook Air-ის" },
    { text: "50-60m2", label: "50-60m2" },
    { text: "16GB", label: "16GB" },
    { text: "M.2", label: "M.2" },
  ];

  for (const token of invalidTokens) {
    it(`flags invalid mixed-script token: ${token}`, () => {
      assert.equal(isMixedScriptGeorgianToken(token), true, `expected ${token} to fail`);
      assert.equal(containsMixedScriptGeorgian(token), true);
    });
  }

  for (const { text, label } of validExamples) {
    it(`allows valid construction: ${label}`, () => {
      assert.equal(containsMixedScriptGeorgian(text), false, `expected "${text}" to pass`);
    });
  }

  it("flags invalid tokens inside sentences but allows valid hybrids in context", () => {
    assert.equal(containsMixedScriptGeorgian("შეიძინe Luma-ში."), true);
    assert.equal(containsMixedScriptGeorgian("შეიძინე Luma-ში."), false);
  });

  it("does not flag correct Georgian homoglyphs (ე/ი) as Latin", () => {
    assert.equal(containsMixedScriptGeorgian("შეიძინე ნახე ფასი"), false);
  });

  it("allows hyphenated/slash model codes with Georgian case endings", () => {
    assert.equal(isMixedScriptGeorgianToken("R9-9900X3D-ის"), false);
    assert.equal(isMixedScriptGeorgianToken("Z890-P-ის"), false);
    assert.equal(isMixedScriptGeorgianToken("SNV3S/2000G-ის"), false);
    assert.equal(containsMixedScriptGeorgian("AMD Ryzen R9-9900X3D-ის შესაძენად გაეცანი ფასს."), false);
  });
});

describe("parseProductFacts regression — 10-product AI test set", () => {
  it("INT I5-14400 extracts CPU model and explicit facts", () => {
    const facts = parseProductFacts({
      sku: "152597",
      name: "INT I5-14400",
      brand: "Intel",
      category: "პროცესორი",
    });
    assert.equal(facts.cpuModel, "I5-14400");
    assert.ok(facts.explicitTokens.some((t) => /I5-14400/i.test(t)));
    assert.notEqual(facts.explicitTokens.length, 0);
  });

  it("LG DA18CEH.NGGF preserves model, Inverter, and coverage", () => {
    const name = "LG DA18CEH.NGGF Inverter 50-60m2 Indoor + Complect";
    const facts = parseProductFacts({
      sku: "174714",
      name,
      brand: "LG",
      category: "კონდინციონერი",
    });
    assert.match(facts.cleanName, /DA18CEH\.NGGF/);
    assert.match(facts.cleanName, /Inverter/);
    assert.match(facts.cleanName, /50-60m2/);
    assert.ok(facts.explicitTokens.some((t) => /DA18CEH\.NGGF/.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /Inverter/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /50-60m2/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /Indoor/i.test(t) && /Complect/i.test(t)));
    assert.equal(facts.name, name);
  });

  it("MacBook Air M2 preserves cores, storage, SSD, and Starlight", () => {
    const name =
      'Apple MacBook Air 13" M2 8-core CPU and 8-core GPU (16GB/256GB) SSD - Starlight';
    const facts = parseProductFacts({
      sku: "161581",
      name,
      brand: "Apple",
      category: "ლეპტოპები",
    });
    assert.ok(facts.explicitTokens.some((t) => /\bM2\b/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /8-core CPU/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /8-core GPU/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /16GB/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /256GB/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /SSD/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /Starlight/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /13/.test(t)));
  });

  it("ASUS A21 PLUS Case ARGB White preserves case model tokens", () => {
    const facts = parseProductFacts({
      sku: "174249",
      name: "ASUS A21 PLUS Case ARGB White",
      brand: "Asus",
      category: "ქეისები",
    });
    assert.ok(facts.explicitTokens.some((t) => /A21/i.test(t) && /PLUS/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /Case/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /ARGB/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /White/i.test(t)));
  });

  it("Asus RT-AX92U router preserves RT-AX92U, 2 Pack, AX6100, Gaming Router", () => {
    const name = "Asus RT-AX92U (2 Pack) AX6100 Gaming Router (90IG04P0-MU2020)";
    const facts = parseProductFacts({
      sku: "139804",
      name,
      brand: "Asus",
      category: "როუტერი",
    });
    assert.ok(facts.explicitTokens.some((t) => /RT-AX92U/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /2 Pack/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /AX6100/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /Gaming Router/i.test(t)));
    assert.match(facts.cleanName, /RT-AX92U/);
    assert.doesNotMatch(facts.cleanName, /90IG04P0/);
  });

  it("Biostar RX 7600 preserves GPU model", () => {
    const facts = parseProductFacts({
      sku: "173643",
      name: "Biostar AMD Radeon RX 7600 OC 8GB - VA76S6RM81",
      brand: "Biostar",
      category: "ვიდეობარათები",
    });
    assert.match(facts.gpuModel ?? "", /RX 7600/i);
    assert.ok(facts.explicitTokens.some((t) => /RX 7600/i.test(t)));
  });

  it("HP 732xk monitor preserves model code and 4K", () => {
    const facts = parseProductFacts({
      sku: "176309",
      name: 'HP Series 7 Pro 732xk 31.5" 4K B7JM6AA - Silver',
      brand: "HP",
      category: "მონიტორები",
    });
    assert.ok(facts.explicitTokens.some((t) => /732xk/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /4K/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /Series 7 Pro/i.test(t)));
  });

  it("TCL 50V6D preserves TV model token", () => {
    const facts = parseProductFacts({
      sku: "172680",
      name: "TCL 50V6D",
      brand: "TCL",
      category: "ტელევიზორი",
    });
    assert.ok(facts.explicitTokens.some((t) => /50V6D/i.test(t)));
  });

  it("Crucial E100 preserves series and capacities", () => {
    const facts = parseProductFacts({
      sku: "173400",
      name: "CRUCIAL E100 2TB M.2 SSD - CT2000E100SSD8",
      brand: "Crucial",
      category: "მეხსიერება SSD/HDD",
    });
    assert.ok(facts.explicitTokens.some((t) => /E100/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /2TB/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /M\.2/i.test(t)));
    assert.ok(facts.explicitTokens.some((t) => /SSD/i.test(t)));
  });
});

describe("DUPLICATE_BRAND false-positive guard", () => {
  function entry(sku: string, short: string): SeoManifestEntry {
    return {
      sku,
      productName: short,
      brand: "AMD",
      category: "პროცესორი",
      currentSlug: null,
      proposedSlug: `slug-${sku}`,
      proposedShortDescription: short,
      proposedFullDescription: `${short} ნახე ფასი Luma-ში და შეიძინე ონლაინ.`,
      proposedSeoTitle: `${short} | Luma`,
      proposedSeoDescription: `${short} Luma-ში — ნახე ფასი და შეიძინე ონლაინ.`,
    };
  }

  it("does not flag Ryzen 7 7800X3D as duplicated token", () => {
    const report = analyzeContentQuality([
      entry("154370", "AMD Ryzen 7 7800X3D არის AM5 პლატფორმისთვის განკუთვნილი პროცესორი."),
    ]);
    assert.equal(report.flags.filter((f) => f.code === "DUPLICATE_BRAND").length, 0);
  });

  it("does not flag NB907GO-MC McLaren as duplicated token", () => {
    const report = analyzeContentQuality([
      entry(
        "169531",
        "NutriBullet NB907GO-MC McLaren არის ნაცრისფერი ბლენდერი McLaren სერიის დასახელებით.",
      ),
    ]);
    assert.equal(report.flags.filter((f) => f.code === "DUPLICATE_BRAND").length, 0);
  });

  it("still flags true consecutive brand duplication", () => {
    const report = analyzeContentQuality([
      entry("x", "AMD AMD Ryzen 7 არის პროცესორი დესკტოპ სისტემისთვის."),
    ]);
    assert.ok(report.flags.some((f) => f.code === "DUPLICATE_BRAND"));
  });
});
