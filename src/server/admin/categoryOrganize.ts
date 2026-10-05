import "server-only";

import { prisma } from "@/server/db";
import { categorySlugFromName, ensureUniqueCategorySlug } from "@/lib/categorySlug";
import {
  MAIN_CATEGORY_TAXONOMY,
  childMatchKeys,
  categoryMatchKey,
  mainCategorySlug,
  type MainCategoryPlan,
} from "@/lib/categoryMainTaxonomy";

export type OrganizeCategoriesResult = {
  mainsCreated: Array<{ id: string; name: string; slug: string; iconKey: string }>;
  mainsReused: Array<{ id: string; name: string; slug: string; iconKey: string }>;
  moved: Array<{ id: string; name: string; fromParentId: string | null; toParentId: string; toParentName: string }>;
  unmatched: string[];
  iconsAssigned: Array<{ name: string; iconKey: string }>;
};

type CatRow = {
  id: string;
  slug: string;
  parentId: string | null;
  iconKey: string | null;
  sortOrder: number;
  translations: { locale: string; name: string }[];
};

function kaName(row: CatRow): string {
  const ka = row.translations.find((item) => item.locale === "ka");
  return ka?.name || row.translations[0]?.name || row.slug;
}

/**
 * Idempotent taxonomy organize:
 * - find-or-create the 12 main categories
 * - reparent matching existing categories under the correct main
 * - never deletes categories or touches products
 */
export async function organizeAdminCategoryTaxonomy(): Promise<OrganizeCategoriesResult> {
  return prisma.$transaction(async (tx) => {
    const all = (await tx.category.findMany({
      include: { translations: { select: { locale: true, name: true } } },
    })) as CatRow[];

    const byId = new Map(all.map((row) => [row.id, row]));
    const bySlug = new Map(all.map((row) => [row.slug, row]));
    const byNameKey = new Map<string, CatRow>();
    for (const row of all) {
      const key = categoryMatchKey(kaName(row));
      if (key && !byNameKey.has(key)) byNameKey.set(key, row);
    }

    const reservedSlugs = new Set(all.map((row) => row.slug));
    const mainsCreated: OrganizeCategoriesResult["mainsCreated"] = [];
    const mainsReused: OrganizeCategoriesResult["mainsReused"] = [];
    const moved: OrganizeCategoriesResult["moved"] = [];
    const iconsAssigned: OrganizeCategoriesResult["iconsAssigned"] = [];
    const unmatched: string[] = [];
    const claimedChildIds = new Set<string>();

    const ensureMain = async (plan: MainCategoryPlan, sortOrder: number) => {
      const preferredSlug = mainCategorySlug(plan);
      let existing =
        bySlug.get(preferredSlug) ??
        byNameKey.get(categoryMatchKey(plan.name)) ??
        null;

      // Prefer an existing root with the same name over a nested accidental match.
      if (existing && existing.parentId) {
        const rootSameName = all.find(
          (row) => !row.parentId && categoryMatchKey(kaName(row)) === categoryMatchKey(plan.name),
        );
        if (rootSameName) existing = rootSameName;
      }

      if (existing) {
        const updated = await tx.category.update({
          where: { id: existing.id },
          data: {
            parentId: null,
            iconKey: plan.iconKey,
            sortOrder,
            isActive: true,
          },
          include: { translations: { select: { locale: true, name: true } } },
        });
        const row = updated as CatRow;
        byId.set(row.id, row);
        bySlug.set(row.slug, row);
        byNameKey.set(categoryMatchKey(kaName(row)), row);
        mainsReused.push({ id: row.id, name: kaName(row), slug: row.slug, iconKey: plan.iconKey });
        iconsAssigned.push({ name: kaName(row), iconKey: plan.iconKey });
        return row;
      }

      const slug = ensureUniqueCategorySlug(preferredSlug || categorySlugFromName(plan.name), reservedSlugs);
      reservedSlugs.add(slug);
      const created = await tx.category.create({
        data: {
          slug,
          parentId: null,
          iconKey: plan.iconKey,
          sortOrder,
          isActive: true,
          indexable: true,
          showInMainNav: false,
          navSortOrder: 0,
          showOnHomepage: false,
          homepageSortOrder: 0,
          translations: {
            create: { locale: "ka", name: plan.name },
          },
        },
        include: { translations: { select: { locale: true, name: true } } },
      });
      const row = created as CatRow;
      all.push(row);
      byId.set(row.id, row);
      bySlug.set(row.slug, row);
      byNameKey.set(categoryMatchKey(plan.name), row);
      mainsCreated.push({ id: row.id, name: plan.name, slug: row.slug, iconKey: plan.iconKey });
      iconsAssigned.push({ name: plan.name, iconKey: plan.iconKey });
      return row;
    };

    const mainRows: CatRow[] = [];
    for (let i = 0; i < MAIN_CATEGORY_TAXONOMY.length; i += 1) {
      mainRows.push(await ensureMain(MAIN_CATEGORY_TAXONOMY[i]!, i));
    }
    const mainIds = new Set(mainRows.map((row) => row.id));

    for (let mi = 0; mi < MAIN_CATEGORY_TAXONOMY.length; mi += 1) {
      const plan = MAIN_CATEGORY_TAXONOMY[mi]!;
      const main = mainRows[mi]!;
      let childSort = 0;

      for (const child of plan.children) {
        const keys = childMatchKeys(child);
        let match: CatRow | null = null;
        for (const key of keys) {
          const candidate = byNameKey.get(key);
          if (!candidate) continue;
          // Never reparent another main category as a child.
          if (mainIds.has(candidate.id) && candidate.id !== main.id) continue;
          if (claimedChildIds.has(candidate.id)) continue;
          match = candidate;
          break;
        }

        if (!match) {
          unmatched.push(`${plan.name} → ${child.name}`);
          continue;
        }

        claimedChildIds.add(match.id);
        const fromParentId = match.parentId;
        if (match.parentId !== main.id || match.sortOrder !== childSort) {
          // Keep existing leaf iconKey; only ensure parent/order.
          const updated = await tx.category.update({
            where: { id: match.id },
            data: {
              parentId: main.id,
              sortOrder: childSort,
            },
            include: { translations: { select: { locale: true, name: true } } },
          });
          const row = updated as CatRow;
          byId.set(row.id, row);
          if (fromParentId !== main.id) {
            moved.push({
              id: row.id,
              name: kaName(row),
              fromParentId,
              toParentId: main.id,
              toParentName: plan.name,
            });
          }
        }
        childSort += 1;
      }
    }

    return { mainsCreated, mainsReused, moved, unmatched, iconsAssigned };
  }, { maxWait: 15_000, timeout: 60_000 });
}
