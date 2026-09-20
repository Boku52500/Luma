/**
 * Import products from Excel into the local PostgreSQL database.
 *
 * Usage:
 *   npm run products:import -- "C:\path\products.xlsx" --dry-run
 *   npm run products:import -- "C:\path\products.xlsx"
 *   npm run products:import -- "C:\path\products.xlsx" --limit=5
 */
import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";

import { planProductImport, summarizeImportPlan } from "../src/lib/productImport/planImport";
import {
  executeProductImport,
  loadPlanImportContext,
  verifyImportedProducts,
} from "../src/server/import/productImportDb";
import { prisma } from "../src/server/prisma";

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((arg) => arg.startsWith("--")));
  const fileArg = argv.find((arg) => arg && !arg.startsWith("--"));
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1] ?? "", 10) : undefined;

  return {
    filePath: fileArg ? path.resolve(fileArg) : null,
    dryRun: flags.has("--dry-run"),
    limit: Number.isFinite(limit) && (limit ?? 0) > 0 ? limit : undefined,
  };
}

function printReport(planSummary: ReturnType<typeof summarizeImportPlan>, plan: Awaited<ReturnType<typeof planProductImport>>) {
  console.log("\n=== Product Import Report ===\n");
  console.log(`Workbook: ${planSummary.filename}`);
  console.log(`Sheet: ${planSummary.sheetName}`);
  console.log(`Headers: ${planSummary.headers.join(" | ")}`);
  console.log(`Ignored columns: ${planSummary.ignoredHeaders.join(", ") || "(none)"}`);
  console.log(`Total Excel rows: ${planSummary.totalRows}`);
  console.log(`Blank rows: ${planSummary.blankRows}`);
  console.log(`Valid rows (ready): ${planSummary.validRows}`);
  console.log(`Invalid rows: ${planSummary.invalidRows}`);
  console.log(`Duplicate SKU in file: ${planSummary.duplicateSkuRows}`);
  console.log(`Existing SKU skipped: ${planSummary.existingSkuRows}`);
  console.log(`Products ready to create: ${planSummary.readyToCreate}`);
  console.log(`Categories to create (${planSummary.categoriesToCreate.length}): ${planSummary.categoriesToCreate.join(", ") || "(none)"}`);
  console.log(`Categories reused (${planSummary.categoriesReused.length}): ${planSummary.categoriesReused.slice(0, 20).join(", ")}${planSummary.categoriesReused.length > 20 ? "..." : ""}`);
  console.log(`Brands to create (${planSummary.brandsToCreate.length}): ${planSummary.brandsToCreate.join(", ") || "(none)"}`);
  console.log(`Brands reused (${planSummary.brandsReused.length}): ${planSummary.brandsReused.slice(0, 20).join(", ")}${planSummary.brandsReused.length > 20 ? "..." : ""}`);

  if (planSummary.categoryAliasesUsed.length > 0) {
    console.log("\n--- Approved category aliases ---");
    for (const alias of planSummary.categoryAliasesUsed) {
      console.log(`  ${alias.excelLabel} → ${alias.resolvedLabel} (${alias.productCount} product(s))`);
    }
  }

  if (planSummary.suspiciousNearDuplicates.length > 0) {
    console.log("\n--- Suspicious near-duplicates (diagnostic only, not merged) ---");
    for (const item of planSummary.suspiciousNearDuplicates.slice(0, 15)) {
      console.log(`  ${item.excel} ~ ${item.nearExisting} (${item.reason})`);
    }
    if (planSummary.suspiciousNearDuplicates.length > 15) {
      console.log(`  ... and ${planSummary.suspiciousNearDuplicates.length - 15} more`);
    }
  }

  const examples = plan.products.slice(0, 5);
  if (examples.length > 0) {
    console.log("\n--- Example slugs ---");
    for (const row of examples) console.log(`  ${row.slug}`);
    console.log("\n--- Example short descriptions ---");
    for (const row of examples) console.log(`  ${row.shortDescription}`);
    console.log("\n--- Example full descriptions ---");
    for (const row of examples) console.log(`  ${row.fullDescription.split("\n\n")[0]}...`);
    console.log("\n--- Example SEO titles ---");
    for (const row of examples) console.log(`  ${row.seoTitle}`);
    console.log("\n--- Example SEO descriptions ---");
    for (const row of examples) console.log(`  ${row.seoDescription}`);
  }

  const issueGroups = ["DUPLICATE_SKU_IN_FILE", "SKIPPED_EXISTING_SKU", "INVALID_PRICE", "INVALID_SKU"] as const;
  for (const code of issueGroups) {
    const rows = plan.issues.filter((issue) => issue.code === code);
    if (rows.length === 0) continue;
    console.log(`\n--- ${code} (${rows.length}) ---`);
    for (const issue of rows.slice(0, 10)) {
      console.log(`  row ${issue.excelRowNumber} sku=${issue.sku ?? "-"} ${issue.message}`);
    }
    if (rows.length > 10) console.log(`  ... and ${rows.length - 10} more`);
  }
}

async function writePreviewFile(plan: Awaited<ReturnType<typeof planProductImport>>) {
  const dir = path.join(process.cwd(), "tmp");
  await fs.mkdir(dir, { recursive: true });
  const outPath = path.join(dir, "product-import-preview.json");
  await fs.writeFile(outPath, JSON.stringify(plan, null, 2), "utf8");
  console.log(`\nPreview written to ${outPath}`);
  return outPath;
}

async function main() {
  const { filePath, dryRun, limit } = parseArgs(process.argv.slice(2));
  if (!filePath) {
    console.error('Usage: npm run products:import -- "C:\\path\\products.xlsx" [--dry-run] [--limit=5]');
    process.exit(1);
  }

  try {
    await fs.access(filePath);
  } catch {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Luma product import${dryRun ? " (DRY RUN — no DB writes)" : ""}`);
  console.log(`  File: ${filePath}`);

  let context;
  let dbContextWarning: string | null = null;
  try {
    context = await loadPlanImportContext();
  } catch (error) {
    if (!dryRun) throw error;
    dbContextWarning =
      error instanceof Error
        ? `Database unavailable for dry-run context: ${error.message}. Existing SKU checks skipped.`
        : "Database unavailable for dry-run context. Existing SKU checks skipped.";
    context = {
      existingSkus: new Map(),
      existingSlugs: new Set<string>(),
      existingCategories: new Map(),
      existingBrands: new Map(),
    };
    console.warn(`\nWARNING: ${dbContextWarning}`);
  }
  const plan = planProductImport(filePath, context);
  const summary = summarizeImportPlan(plan);

  await writePreviewFile(plan);
  printReport(summary, plan);

  if (dryRun) {
    console.log("\nDry-run complete: zero database writes performed.");
    if (dbContextWarning) {
      console.log("Note: reconnect PostgreSQL and re-run dry-run for existing SKU skip counts.");
    }
    return;
  }

  const batch = limit ? plan.products.slice(0, limit) : plan.products;
  if (batch.length === 0) {
    console.log("\nNo products to import.");
    return;
  }

  console.log(`\nImporting ${batch.length} product(s)...`);
  const result = await executeProductImport(batch);
  console.log(`Created products: ${result.createdProductIds.length}`);
  console.log(`Failed rows: ${result.failed.length}`);
  if (result.createdCategories.length) {
    console.log(`Created categories: ${result.createdCategories.join(", ")}`);
  }
  if (result.createdBrands.length) {
    console.log(`Created brands: ${result.createdBrands.join(", ")}`);
  }

  const verified = await verifyImportedProducts(result.createdProductIds);
  if (verified.length > 0) {
    console.log("\n--- Sample verification ---");
    for (const row of verified) {
      console.log(
        `  ${row.sku} | ${row.name.slice(0, 40)} | ${row.price} GEL | variants=${row.variantCount} images=${row.imageCount} stockQty=${row.stockQuantity} prevPrice=${row.previousPrice ?? "null"}`,
      );
    }
  }

  if (result.failed.length > 0) {
    console.log("\nImport completed with row failures.");
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("Product import failed.");
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
