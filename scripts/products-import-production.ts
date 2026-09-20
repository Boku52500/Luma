/**
 * SAFE, TEMPORARY Vercel production catalogue import.
 *
 * - Uses DATABASE_URL from the environment (same as luma.ge on Vercel Production)
 * - Runs ONLY when RUN_PRODUCT_IMPORT === "true"
 * - Idempotent by SKU against the versioned approved dataset in-repo
 * - Never prints secrets / full DATABASE_URL
 *
 * Vercel Build Command:
 *   npm run db:migrate:deploy && npm run products:import:production && npm run build
 */
import fs from "node:fs";
import path from "node:path";

import { catalogIdentityKey } from "../src/lib/productImport/slug";
import type { PlannedProduct, RowIssue } from "../src/lib/productImport/types";
import {
  executeProductImport,
  updateExistingProductAiContent,
} from "../src/server/import/productImportDb";
import { parseMoneyInput } from "../src/server/money";
import { prisma } from "../src/server/prisma";

const DATASET_PATH = path.join(
  process.cwd(),
  "data",
  "product-catalogue-import",
  "approved-catalogue-v1.json",
);

const PHILIPS_DUPLICATE_REVIEW = ["172492", "177053"] as const;

export type ApprovedCatalogueProduct = {
  sku: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  seoTitle: string;
  seoDescription: string;
};

export type ApprovedCatalogueDataset = {
  version: string;
  productCount: number;
  philipsDuplicateReviewSkus: string[];
  products: ApprovedCatalogueProduct[];
};

function sanitizeHost(hostname: string): string {
  if (/neon\.tech$/i.test(hostname)) {
    const parts = hostname.split(".");
    if (parts.length >= 4) return `*.${parts.slice(-4).join(".")}`;
    return "*.neon.tech";
  }
  if (["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(hostname)) {
    return hostname;
  }
  return hostname.replace(/^[^.]+\./, "*.");
}

function describeDatabaseTargetSafe(databaseUrl: string): {
  sanitizedHost: string;
  database: string;
  providerHint: string;
} {
  const parsed = new URL(databaseUrl);
  const database = (parsed.pathname || "/").replace(/^\//, "").split("?")[0] ?? "";
  const host = parsed.hostname;
  const providerHint = /neon\.tech$/i.test(host)
    ? "Neon"
    : ["localhost", "127.0.0.1", "::1", "host.docker.internal"].includes(host)
      ? "local"
      : "postgres";
  return { sanitizedHost: sanitizeHost(host), database, providerHint };
}

function loadDataset(): ApprovedCatalogueDataset {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Approved catalogue dataset missing: ${DATASET_PATH}`);
  }
  const raw = JSON.parse(fs.readFileSync(DATASET_PATH, "utf8")) as ApprovedCatalogueDataset;
  if (!Array.isArray(raw.products) || raw.products.length !== 458) {
    throw new Error(`Dataset productCount invalid: ${raw.products?.length ?? 0} (expected 458)`);
  }
  if (raw.productCount !== 458) {
    throw new Error(`Dataset productCount field ${raw.productCount} !== 458`);
  }

  const skuSet = new Set<string>();
  const slugSet = new Set<string>();
  for (const [index, product] of raw.products.entries()) {
    for (const key of [
      "sku",
      "name",
      "brand",
      "category",
      "price",
      "slug",
      "shortDescription",
      "fullDescription",
      "seoTitle",
      "seoDescription",
    ] as const) {
      if (!product[key] || typeof product[key] !== "string") {
        throw new Error(`Dataset row ${index} missing ${key}`);
      }
    }
    if (skuSet.has(product.sku)) throw new Error(`Duplicate SKU in dataset: ${product.sku}`);
    if (slugSet.has(product.slug)) throw new Error(`Duplicate slug in dataset: ${product.slug}`);
    skuSet.add(product.sku);
    slugSet.add(product.slug);
  }

  for (const sku of PHILIPS_DUPLICATE_REVIEW) {
    if (!skuSet.has(sku)) throw new Error(`Philips duplicate-review SKU missing: ${sku}`);
  }

  return raw;
}

function fieldsMatch(
  product: ApprovedCatalogueProduct,
  db: {
    slug: string;
    price: { toString(): string };
    name: string | null | undefined;
    shortDescription: string | null | undefined;
    description: string | null | undefined;
    seoTitle: string | null | undefined;
    seoDescription: string | null | undefined;
    brandName: string | null | undefined;
    categoryName: string | null | undefined;
  },
): boolean {
  return (
    (db.name ?? "") === product.name &&
    parseMoneyInput(product.price).toString() === db.price.toString() &&
    catalogIdentityKey(db.brandName ?? "") === catalogIdentityKey(product.brand) &&
    catalogIdentityKey(db.categoryName ?? "") === catalogIdentityKey(product.category) &&
    (db.shortDescription ?? "") === product.shortDescription &&
    (db.description ?? "") === product.fullDescription &&
    (db.seoTitle ?? "") === product.seoTitle &&
    (db.seoDescription ?? "") === product.seoDescription &&
    db.slug === product.slug
  );
}

function toPlanned(product: ApprovedCatalogueProduct, index: number): PlannedProduct {
  return {
    excelRowNumber: index + 1,
    sku: product.sku,
    name: product.name,
    category: product.category,
    categoryExists: false,
    brand: product.brand,
    brandExists: false,
    price: product.price,
    slug: product.slug,
    shortDescription: product.shortDescription,
    fullDescription: product.fullDescription,
    seoTitle: product.seoTitle,
    seoDescription: product.seoDescription,
    status: "READY",
  };
}

async function main() {
  if (process.env.RUN_PRODUCT_IMPORT !== "true") {
    console.log("Product import disabled");
    return;
  }

  console.log("\n=== products:import:production (gated) ===\n");

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set — refusing catalogue import");
  }

  const target = describeDatabaseTargetSafe(databaseUrl);
  const beforeCount = await prisma.product.count();
  console.log(`DB provider hint: ${target.providerHint}`);
  console.log(`DB host (sanitized): ${target.sanitizedHost}`);
  console.log(`DB name: ${target.database}`);
  console.log(`Current product count: ${beforeCount}`);

  const dataset = loadDataset();
  console.log(`Dataset version: ${dataset.version}`);
  console.log(`Dataset products: ${dataset.productCount}`);
  console.log(`Philips INVENTORY_DUPLICATE_REVIEW: ${PHILIPS_DUPLICATE_REVIEW.join(", ")}`);

  const existing = await prisma.product.findMany({
    where: { sku: { in: dataset.products.map((p) => p.sku) } },
    select: {
      id: true,
      sku: true,
      slug: true,
      price: true,
      translations: {
        where: { locale: "ka" },
        select: {
          name: true,
          shortDescription: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
        },
        take: 1,
      },
      brand: { select: { translations: { where: { locale: "ka" }, select: { name: true }, take: 1 } } },
      category: {
        select: { translations: { where: { locale: "ka" }, select: { name: true }, take: 1 } },
      },
    },
  });
  const bySku = new Map(existing.map((row) => [row.sku, row]));

  const toCreate: PlannedProduct[] = [];
  const toUpdate: ApprovedCatalogueProduct[] = [];
  let unchanged = 0;

  for (const [index, product] of dataset.products.entries()) {
    const row = bySku.get(product.sku);
    if (!row) {
      toCreate.push(toPlanned(product, index));
      continue;
    }
    const t = row.translations[0];
    if (
      fieldsMatch(product, {
        slug: row.slug,
        price: row.price,
        name: t?.name,
        shortDescription: t?.shortDescription,
        description: t?.description,
        seoTitle: t?.seoTitle,
        seoDescription: t?.seoDescription,
        brandName: row.brand.translations[0]?.name,
        categoryName: row.category.translations[0]?.name,
      })
    ) {
      unchanged += 1;
      continue;
    }
    toUpdate.push(product);
  }

  console.log(`Plan: create=${toCreate.length} update=${toUpdate.length} unchanged=${unchanged}`);

  const failed: RowIssue[] = [];
  let created = 0;
  let updated = 0;

  if (toCreate.length) {
    const result = await executeProductImport(toCreate);
    created = result.createdProductIds.length;
    failed.push(...result.failed);
    console.log(`Created ${created}; create failures ${result.failed.length}`);
  }

  for (const [index, product] of toUpdate.entries()) {
    const result = await updateExistingProductAiContent({
      sku: product.sku,
      excelRowNumber: index + 1,
      name: product.name,
      brand: product.brand,
      category: product.category,
      price: product.price,
      slug: product.slug,
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      syncExcelNameAndPrice: true,
    });
    if (result.ok) updated += 1;
    else failed.push(result.issue);
  }

  // Verification
  const afterCount = await prisma.product.count();
  const verifyRows = await prisma.product.findMany({
    where: { sku: { in: dataset.products.map((p) => p.sku) } },
    select: {
      sku: true,
      slug: true,
      price: true,
      translations: {
        where: { locale: "ka" },
        select: {
          name: true,
          shortDescription: true,
          description: true,
          seoTitle: true,
          seoDescription: true,
        },
        take: 1,
      },
      brand: { select: { translations: { where: { locale: "ka" }, select: { name: true }, take: 1 } } },
      category: {
        select: { translations: { where: { locale: "ka" }, select: { name: true }, take: 1 } },
      },
    },
  });
  const verifyBySku = new Map(verifyRows.map((row) => [row.sku, row]));
  const missing = dataset.products.filter((p) => !verifyBySku.has(p.sku)).map((p) => p.sku);
  const mismatches: Array<{ sku: string; field: string }> = [];

  for (const product of dataset.products) {
    const row = verifyBySku.get(product.sku);
    if (!row) continue;
    const t = row.translations[0];
    if (!fieldsMatch(product, {
      slug: row.slug,
      price: row.price,
      name: t?.name,
      shortDescription: t?.shortDescription,
      description: t?.description,
      seoTitle: t?.seoTitle,
      seoDescription: t?.seoDescription,
      brandName: row.brand.translations[0]?.name,
      categoryName: row.category.translations[0]?.name,
    })) {
      mismatches.push({ sku: product.sku, field: "content" });
    }
  }

  const skuDupCheck = await prisma.$queryRaw<Array<{ sku: string; c: bigint }>>`
    SELECT sku, COUNT(*)::bigint AS c FROM "Product" GROUP BY sku HAVING COUNT(*) > 1
  `;
  const slugDupCheck = await prisma.$queryRaw<Array<{ slug: string; c: bigint }>>`
    SELECT slug, COUNT(*)::bigint AS c FROM "Product" GROUP BY slug HAVING COUNT(*) > 1
  `;

  console.log("\n--- Sync result ---");
  console.log(`created: ${created}`);
  console.log(`updated: ${updated}`);
  console.log(`unchanged: ${unchanged}`);
  console.log(`failed: ${failed.length}`);
  console.log(`final product count: ${afterCount}`);
  console.log(`approved SKUs present: ${verifyRows.length}/458`);
  console.log(`duplicate SKUs: ${skuDupCheck.length}`);
  console.log(`duplicate slugs: ${slugDupCheck.length}`);
  console.log(`source/DB mismatches: ${mismatches.length}`);
  console.log(
    `Philips: ${PHILIPS_DUPLICATE_REVIEW.map((sku) => `${sku}=${verifyBySku.has(sku) ? "ok" : "MISSING"}`).join(", ")}`,
  );

  const ok =
    failed.length === 0 &&
    missing.length === 0 &&
    verifyRows.length === 458 &&
    skuDupCheck.length === 0 &&
    slugDupCheck.length === 0 &&
    mismatches.length === 0;

  if (!ok) {
    if (missing.length) console.error(`Missing SKUs (first 20): ${missing.slice(0, 20).join(", ")}`);
    if (mismatches.length) {
      console.error(
        `Mismatches (first 20): ${mismatches
          .slice(0, 20)
          .map((m) => m.sku)
          .join(", ")}`,
      );
    }
    if (failed.length) {
      console.error(
        `Failures (first 10): ${failed
          .slice(0, 10)
          .map((f) => `${f.sku}:${f.message}`)
          .join(" | ")}`,
      );
    }
    throw new Error("Catalogue import verification failed");
  }

  console.log("\nCatalogue import verification passed.\n");
}

main()
  .catch((error) => {
    console.error("products:import:production failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
