/**
 * Execute category taxonomy organize against the configured DB, then print verification.
 * Safe: find-or-create mains, reparent existing leaves by name; never deletes products/categories.
 */
import { createRequire } from "node:module";
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

// Scripts run outside Next.js; allow importing server-only modules.
const require = createRequire(import.meta.url);
const serverOnlyPath = require.resolve("server-only");
require.cache[serverOnlyPath] = {
  id: serverOnlyPath,
  filename: serverOnlyPath,
  loaded: true,
  exports: {},
} as NodeModule;

async function main() {
  const { prisma } = await import("../src/server/prisma");
  const { organizeAdminCategoryTaxonomy } = await import("../src/server/admin/categoryOrganize");
  const { pickTranslation } = await import("../src/server/locale");
  const { describeDatabaseTarget, getDatabaseUrl } = await import("../src/server/env");

  console.log("DB target:", describeDatabaseTarget(getDatabaseUrl()));

  const beforeProducts = await prisma.product.count();
  const beforeCategoryLinks = await prisma.product.groupBy({
    by: ["categoryId"],
    _count: { _all: true },
  });
  const beforeLinkFingerprint = beforeCategoryLinks
    .map((row) => `${row.categoryId}:${row._count._all}`)
    .sort()
    .join("|");

  console.log("\n=== RUNNING ORGANIZE ===");
  const report = await organizeAdminCategoryTaxonomy();

  console.log("\nMains created:");
  for (const row of report.mainsCreated) {
    console.log(`  + ${row.name} [${row.slug}] icon=${row.iconKey} id=${row.id}`);
  }
  if (!report.mainsCreated.length) console.log("  (none)");

  console.log("\nMains reused:");
  for (const row of report.mainsReused) {
    console.log(`  = ${row.name} [${row.slug}] icon=${row.iconKey} id=${row.id}`);
  }
  if (!report.mainsReused.length) console.log("  (none)");

  console.log("\nMoved:");
  for (const row of report.moved) {
    console.log(`  → ${row.name} id=${row.id} to ${row.toParentName}`);
  }
  if (!report.moved.length) console.log("  (none — already placed or unmatched)");

  console.log("\nIcons assigned:");
  for (const row of report.iconsAssigned) {
    console.log(`  ${row.name} → ${row.iconKey}`);
  }

  console.log("\nPlan unmatched (no existing category found by name/alias):");
  for (const row of report.unmatched) {
    console.log(`  ? ${row}`);
  }
  if (!report.unmatched.length) console.log("  (none)");

  const afterProducts = await prisma.product.count();
  const afterCategoryLinks = await prisma.product.groupBy({
    by: ["categoryId"],
    _count: { _all: true },
  });
  const afterLinkFingerprint = afterCategoryLinks
    .map((row) => `${row.categoryId}:${row._count._all}`)
    .sort()
    .join("|");

  console.log("\n=== PRODUCT SAFETY ===");
  console.log(`product count before/after: ${beforeProducts} / ${afterProducts}`);
  console.log(
    `categoryId assignment fingerprint unchanged: ${beforeLinkFingerprint === afterLinkFingerprint}`,
  );

  const categories = await prisma.category.findMany({
    include: { translations: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });

  const nameOf = (id: string | null) => {
    if (!id) return null;
    const row = categories.find((c) => c.id === id);
    return row ? pickTranslation(row.translations).name : id;
  };

  const roots = categories
    .filter((c) => !c.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));

  const childrenOf = (parentId: string) =>
    categories
      .filter((c) => c.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));

  console.log("\n=== VERIFIED HIERARCHY ===");
  for (const root of roots) {
    const rootName = pickTranslation(root.translations).name;
    console.log(`\n${rootName}  [${root.slug}]  icon=${root.iconKey ?? "—"}`);
    for (const child of childrenOf(root.id)) {
      const childName = pickTranslation(child.translations).name;
      console.log(`  → ${childName}  [${child.slug}]`);
      for (const grand of childrenOf(child.id)) {
        const grandName = pickTranslation(grand.translations).name;
        console.log(`    → ${grandName}  [${grand.slug}] (depth>1)`);
      }
    }
  }

  const notUnderMain = categories.filter((c) => {
    if (!c.parentId) return false;
    return !roots.some((r) => r.id === c.parentId);
  });

  console.log("\n=== EXISTING CATEGORIES NOT ASSIGNED UNDER A MAIN (parent is not a root) ===");
  if (!notUnderMain.length) {
    console.log("  (none)");
  } else {
    for (const c of notUnderMain) {
      console.log(
        `  · ${pickTranslation(c.translations).name} [${c.slug}] parent=${nameOf(c.parentId)}`,
      );
    }
  }

  console.log("\n=== ALL ROOT CATEGORIES ===");
  for (const root of roots) {
    console.log(
      `  · ${pickTranslation(root.translations).name} [${root.slug}] children=${childrenOf(root.id).length} icon=${root.iconKey ?? "—"}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
