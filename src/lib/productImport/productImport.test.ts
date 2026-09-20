import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";

import { resolveImportCategory } from "./categoryAliases";
import { REQUIRED_EXCEL_COLUMNS } from "./constants";
import {
  cleanGeneratedText,
  contentSeed,
  generateFullDescription,
  generateProductContent,
  generateShortDescription,
  quotedCategory,
} from "./content";
import {
  normalizeSku,
  parseImportPrice,
} from "./normalize";
import { buildColumnIndex } from "./parseExcel";
import { planProductImport } from "./planImport";
import { baseProductSlug, catalogIdentityKey, resolveUniqueProductSlug } from "./slug";

function writeWorkbook(filePath: string, headers: string[], rows: unknown[][]): void {
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  XLSX.writeFile(workbook, filePath);
}

describe("product import excel mapping", () => {
  it("requires exact Georgian headers and ignores extra price columns", () => {
    const headers = [
      "SKU",
      "კატეგორია",
      "ბრენდი",
      "დასახელება",
      "ასაღები ფასი",
      "ალტას ფასი",
      "გასაყიდი ფასი",
      "მარჟა",
    ];
    const mapping = buildColumnIndex(headers);
    assert.equal(mapping.ok, true);
    if (!mapping.ok) return;
    assert.deepEqual(mapping.ignoredHeaders, ["ასაღები ფასი", "ალტას ფასი", "მარჟა"]);
    assert.equal(mapping.columnIndex["გასაყიდი ფასი"], 6);
  });

  it("preserves Georgian unicode in parsed rows", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-import-"));
    const file = path.join(dir, "georgian.xlsx");
    writeWorkbook(
      file,
      [...REQUIRED_EXCEL_COLUMNS],
      [[1001, "CPU", "Intel", "Intel Core Ultra 5 245K", 3199]],
    );

    const plan = planProductImport(file, {
      existingSkus: new Map(),
      existingSlugs: new Set(),
      existingCategories: new Map(),
      existingBrands: new Map(),
    });
    assert.equal(plan.products.length, 1);
    assert.equal(plan.products[0]?.name, "Intel Core Ultra 5 245K");
    assert.equal(plan.products[0]?.category, "CPU");
  });
});

describe("product import category aliases", () => {
  it("maps ტელევიზორი to existing ტელევიზორები via approved alias", () => {
    const resolved = resolveImportCategory("ტელევიზორი");
    assert.equal(resolved.resolvedLabel, "ტელევიზორები");
    assert.equal(resolved.aliasApplied, true);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-import-"));
    const file = path.join(dir, "tv-alias.xlsx");
    writeWorkbook(file, [...REQUIRED_EXCEL_COLUMNS], [[700, "ტელევიზორი", "Samsung", "Samsung TV 55", 1999]]);

    const tvKey = catalogIdentityKey("ტელევიზორები");
    const plan = planProductImport(file, {
      existingSkus: new Map(),
      existingSlugs: new Set(),
      existingCategories: new Map([[tvKey, { key: tvKey, displayName: "ტელევიზორები" }]]),
      existingBrands: new Map(),
    });

    assert.equal(plan.products.length, 1);
    assert.equal(plan.products[0]?.category, "ტელევიზორები");
    assert.equal(plan.products[0]?.categoryExists, true);
    assert.equal(plan.categoriesToCreate.includes("ტელევიზორი"), false);
    assert.equal(plan.categoriesToCreate.includes("ტელევიზორები"), false);
    assert.deepEqual(plan.categoryAliasesUsed, [
      { excelLabel: "ტელევიზორი", resolvedLabel: "ტელევიზორები", productCount: 1 },
    ]);
  });

  it("does not merge unrelated near-duplicates such as ქეისები and აქციები", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-import-"));
    const file = path.join(dir, "cases.xlsx");
    writeWorkbook(file, [...REQUIRED_EXCEL_COLUMNS], [[701, "ქეისები", "Asus", "Asus Case", 120]]);

    const promoKey = catalogIdentityKey("აქციები");
    const plan = planProductImport(file, {
      existingSkus: new Map(),
      existingSlugs: new Set(),
      existingCategories: new Map([[promoKey, { key: promoKey, displayName: "აქციები" }]]),
      existingBrands: new Map(),
    });

    assert.deepEqual(plan.categoriesToCreate, ["ქეისები"]);
    assert.equal(plan.products[0]?.category, "ქეისები");
    assert.ok(plan.suspiciousNearDuplicates.some((item) => item.excel === "ქეისები"));
  });
});

describe("product import normalization", () => {
  it("converts numeric SKU cells without decimal formatting", () => {
    assert.equal(normalizeSku(176028), "176028");
    assert.equal(normalizeSku("176028.0"), "176028");
  });

  it("parses selling price only from mapped column values", () => {
    assert.deepEqual(parseImportPrice(849), { ok: true, value: "849" });
    assert.deepEqual(parseImportPrice(0), { ok: false });
  });
});

describe("product import duplicate and skip rules", () => {
  it("skips existing database SKUs without planning create", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-import-"));
    const file = path.join(dir, "existing.xlsx");
    writeWorkbook(file, [...REQUIRED_EXCEL_COLUMNS], [[9, "CPU", "Intel", "Intel X", 100]]);

    const plan = planProductImport(file, {
      existingSkus: new Map([["9", { sku: "9", productId: "prod-9", productName: "Existing Intel X" }]]),
      existingSlugs: new Set(["intel-x"]),
      existingCategories: new Map([[catalogIdentityKey("CPU"), { key: catalogIdentityKey("CPU"), displayName: "CPU" }]]),
      existingBrands: new Map([[catalogIdentityKey("Intel"), { key: catalogIdentityKey("Intel"), displayName: "Intel" }]]),
    });

    assert.equal(plan.products.length, 0);
    assert.equal(plan.issues[0]?.code, "SKIPPED_EXISTING_SKU");
  });
});

describe("product import content generation", () => {
  const fixtures = [
    { sku: "176028", name: "Lenovo ThinkCentre neo 50a", brand: "Lenovo", category: "პანელური კომიუტერი | All-In-One" },
    { sku: "174249", name: "ASUS A21 PLUS Case ARGB White", brand: "Asus", category: "ქეისები" },
    { sku: "1001", name: "Intel Core Ultra 5 245K", brand: "Intel", category: "CPU" },
    { sku: "1002", name: "AMD Ryzen 7 7800X3D", brand: "AMD", category: "პროცესორი" },
    { sku: "1003", name: "Samsung 990 PRO 1TB", brand: "Samsung", category: "მეხსიერება SSD/HDD" },
    { sku: "1004", name: "Apple iPhone 15 Pro", brand: "Apple", category: "ტელეფონები" },
    { sku: "1005", name: "Samsung TV 55", brand: "Samsung", category: "ტელევიზორები" },
    { sku: "1006", name: "Mixed Product X", brand: "HP", category: "CPU" },
    { sku: "1007", name: "English Only Monitor", brand: "LG", category: "მონიტორები" },
    { sku: "1008", name: "Lenovo Laptop IdeaPad", brand: "Lenovo", category: "ლეპტოპები" },
  ] as const;

  it("is deterministic for the same SKU/name/brand/category", () => {
    const first = generateProductContent("1001", "Intel Core Ultra 5 245K", "Intel", "CPU");
    const second = generateProductContent("1001", "Intel Core Ultra 5 245K", "Intel", "CPU");
    assert.deepEqual(first, second);
  });

  it("does not append Georgian -ს suffixes to raw category labels", () => {
    for (const row of fixtures) {
      const shortDescription = generateShortDescription(row.sku, row.name, row.brand, row.category);
      const fullDescription = generateFullDescription(row.sku, row.name, row.brand, row.category);
      assert.doesNotMatch(shortDescription, /„[^"]+"-ს\b/);
      assert.doesNotMatch(fullDescription, /„[^"]+"-ს\b/);
      assert.ok(shortDescription.includes(quotedCategory(row.category)));
    }
  });

  it("exercises multiple templates across fixture set", () => {
    const shortIndexes = new Set<number>();
    const fullIndexes = new Set<number>();
    const seoIndexes = new Set<number>();

    for (const row of fixtures) {
      const content = generateProductContent(row.sku, row.name, row.brand, row.category);
      shortIndexes.add(content.templateIndex.short);
      fullIndexes.add(content.templateIndex.full);
      seoIndexes.add(content.templateIndex.seo);
      assert.match(content.seoTitle, /Luma/);
      assert.doesNotMatch(content.shortDescription, /(8|16|32)\s*core/i);
      assert.doesNotMatch(content.fullDescription, /\d+\s*GHz\b/i);
    }

    assert.ok(shortIndexes.size >= 2, "expected multiple short-description templates");
    assert.ok(fullIndexes.size >= 2, "expected multiple full-description templates");
    assert.ok(seoIndexes.size >= 2, "expected multiple SEO description templates");
  });

  it("does not invent claims beyond the product name", () => {
    const content = generateProductContent("1001", "Intel Core Ultra 5 245K", "Intel", "CPU");
    assert.match(content.shortDescription, /Intel Core Ultra 5 245K/);
    assert.doesNotMatch(content.shortDescription, /warranty|discount|delivery|ფასდაკლებ/i);
  });

  it("uses stable content seed", () => {
    const seedA = contentSeed({ sku: "1", name: "A", brand: "B", category: "CPU" });
    const seedB = contentSeed({ sku: "1", name: "A", brand: "B", category: "CPU" });
    assert.equal(seedA, seedB);
    assert.equal(cleanGeneratedText("  hello   world ."), "hello world.");
  });
});

describe("product import slug and safety defaults", () => {
  it("resolves slug conflicts with deterministic SKU suffix", () => {
    const reserved = new Set<string>([baseProductSlug("ASUS ROG Strix G16")]);
    const slug = resolveUniqueProductSlug({
      name: "ASUS ROG Strix G16",
      sku: "174218",
      reservedSlugs: reserved,
    });
    assert.match(slug, /174218/);
  });

  it("does not plan stock or old price from ignored columns", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "luma-import-"));
    const file = path.join(dir, "ignored.xlsx");
    writeWorkbook(
      file,
      ["SKU", "კატეგორია", "ბრენდი", "დასახელება", "ასაღები ფასი", "გასაყიდი ფასი"],
      [[55, "CPU", "Intel", "Intel Y", 999, 295]],
    );

    const plan = planProductImport(file, {
      existingSkus: new Map(),
      existingSlugs: new Set(),
      existingCategories: new Map(),
      existingBrands: new Map(),
    });

    assert.equal(plan.products[0]?.price, "295");
  });
});

describe("product import content preview set", () => {
  it("returns 10 sample generated content rows", () => {
    const rows = [
      { sku: "176028", name: "Lenovo ThinkCentre neo 50a", brand: "Lenovo", category: "პანელური კომიუტერი | All-In-One" },
      { sku: "174249", name: "ASUS A21 PLUS Case ARGB White", brand: "Asus", category: "ქეისები" },
      { sku: "1001", name: "Intel Core Ultra 5 245K", brand: "Intel", category: "CPU" },
      { sku: "1002", name: "AMD Ryzen 7 7800X3D", brand: "AMD", category: "პროცესორი" },
      { sku: "1003", name: "Samsung 990 PRO 1TB", brand: "Samsung", category: "მეხსიერება SSD/HDD" },
      { sku: "1004", name: "Apple iPhone 15 Pro", brand: "Apple", category: "ტელეფონები" },
      { sku: "1005", name: "Samsung TV 55", brand: "Samsung", category: "ტელევიზორები" },
      { sku: "1006", name: "Mixed Product X", brand: "HP", category: "CPU" },
      { sku: "1007", name: "English Only Monitor", brand: "LG", category: "მონიტორები" },
      { sku: "1008", name: "Lenovo Laptop IdeaPad", brand: "Lenovo", category: "ლეპტოპები" },
    ];

    const preview = rows.map((row) => ({
      sku: row.sku,
      category: row.category,
      ...generateProductContent(row.sku, row.name, row.brand, row.category),
    }));

    assert.equal(preview.length, 10);
    for (const row of preview) {
      assert.ok(row.shortDescription.length > 20);
      assert.ok(row.fullDescription.length > 40);
      assert.match(row.seoTitle, /Luma/);
    }
  });
});
