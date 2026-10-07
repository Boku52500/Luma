/**
 * Seed the default 13-section homepage layout against the configured DB.
 * Safe: idempotent, never deletes sections/products/categories.
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
  const { ensureHomepageInitialized } = await import("../src/server/homepage/init");
  const { describeDatabaseTarget, getDatabaseUrl } = await import("../src/server/env");
  const { pickTranslation } = await import("../src/server/locale");

  console.log("DB target:", describeDatabaseTarget(getDatabaseUrl()));

  await ensureHomepageInitialized();

  const sections = await prisma.homepageSection.findMany({
    orderBy: { position: "asc" },
    include: {
      banners: true,
      brandItems: { include: { brand: { include: { translations: true } } } },
      tiles: { include: { category: { include: { translations: true } } } },
    },
  });

  console.log("\n=== HOMEPAGE SECTIONS ===");
  for (const section of sections) {
    console.log(`${section.position + 1}. [${section.key}] ${section.type} — ${section.adminLabel} (enabled=${section.enabled})`);
    if (section.type === "BRAND_REEL") {
      for (const item of section.brandItems) {
        console.log(`   · brand: ${pickTranslation(item.brand.translations).name}`);
      }
    }
    if (section.type === "CATEGORY_PRODUCT_REEL") {
      console.log(`   · config: ${JSON.stringify(section.config)}`);
    }
    if (section.type === "VISUAL_CATEGORIES") {
      for (const tile of section.tiles) {
        console.log(`   · tile ${tile.slot}: category=${tile.category ? pickTranslation(tile.category.translations).name : "—"}`);
      }
    }
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
