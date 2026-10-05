import "server-only";

import { prisma } from "@/server/db";
import { pickTranslation } from "@/server/locale";

export type AdminCategoryRow = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  sortOrder: number;
  showInMainNav: boolean;
  navSortOrder: number;
  productCount: number;
  childCount: number;
  depth: number;
};

export type AdminCategoryEditorData = {
  id: string;
  slug: string;
  parentId: string;
  imageUrl: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
  indexable: boolean;
  showInMainNav: boolean;
  navSortOrder: number;
  showOnHomepage: boolean;
  homepageSortOrder: number;
  translations: {
    ka: { name: string; description: string; seoTitle: string; seoDescription: string };
    en: { name: string; description: string; seoTitle: string; seoDescription: string };
    ru: { name: string; description: string; seoTitle: string; seoDescription: string };
  };
};

function emptyCopy() {
  return { name: "", description: "", seoTitle: "", seoDescription: "" };
}

function copyFrom(
  rows: { locale: string; name: string; description: string | null; seoTitle: string | null; seoDescription: string | null }[],
  locale: string,
) {
  const row = rows.find((item) => item.locale === locale);
  if (!row) return emptyCopy();
  return {
    name: row.name,
    description: row.description ?? "",
    seoTitle: row.seoTitle ?? "",
    seoDescription: row.seoDescription ?? "",
  };
}

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const categories = await prisma.category.findMany({
    include: {
      translations: true,
      parent: { include: { translations: true } },
      // Count only current (non-archived) products on this exact categoryId.
      // Soft-deleted rows still keep categoryId for order history, but must not
      // inflate admin category product counts.
      _count: { select: { products: { where: { deletedAt: null } } } },
    },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
  });

  const byParent = new Map<string | null, typeof categories>();
  for (const category of categories) {
    const key = category.parentId;
    const list = byParent.get(key) ?? [];
    list.push(category);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
  }

  const rows: AdminCategoryRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const category of byParent.get(parentId) ?? []) {
      rows.push({
        id: category.id,
        slug: category.slug,
        name: pickTranslation(category.translations).name,
        parentId: category.parentId,
        parentName: category.parent ? pickTranslation(category.parent.translations).name : null,
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        showInMainNav: category.showInMainNav,
        navSortOrder: category.navSortOrder,
        productCount: category._count.products,
        childCount: byParent.get(category.id)?.length ?? 0,
        depth,
      });
      walk(category.id, depth + 1);
    }
  };
  walk(null, 0);

  const seen = new Set(rows.map((row) => row.id));
  for (const category of categories) {
    if (seen.has(category.id)) continue;
    rows.push({
      id: category.id,
      slug: category.slug,
      name: pickTranslation(category.translations).name,
      parentId: category.parentId,
      parentName: category.parent ? pickTranslation(category.parent.translations).name : null,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      showInMainNav: category.showInMainNav,
      navSortOrder: category.navSortOrder,
      productCount: category._count.products,
      childCount: byParent.get(category.id)?.length ?? 0,
      depth: 0,
    });
  }

  return rows;
}

export async function getAdminCategoryEditor(id: string): Promise<AdminCategoryEditorData | null> {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!category) return null;
  return {
    id: category.id,
    slug: category.slug,
    parentId: category.parentId ?? "",
    imageUrl: category.imageUrl ?? "",
    iconKey: category.iconKey ?? "",
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    indexable: category.indexable,
    showInMainNav: category.showInMainNav,
    navSortOrder: category.navSortOrder,
    showOnHomepage: category.showOnHomepage,
    homepageSortOrder: category.homepageSortOrder,
    translations: {
      ka: copyFrom(category.translations, "ka"),
      en: copyFrom(category.translations, "en"),
      ru: copyFrom(category.translations, "ru"),
    },
  };
}

export function emptyCategoryEditor(): AdminCategoryEditorData {
  return {
    id: "",
    slug: "",
    parentId: "",
    imageUrl: "",
    iconKey: "",
    sortOrder: 0,
    isActive: true,
    indexable: true,
    showInMainNav: false,
    navSortOrder: 0,
    showOnHomepage: false,
    homepageSortOrder: 0,
    translations: { ka: emptyCopy(), en: emptyCopy(), ru: emptyCopy() },
  };
}

export async function categoryWouldCycle(categoryId: string, parentId: string | null): Promise<boolean> {
  if (!parentId) return false;
  if (parentId === categoryId) return true;
  let current: string | null = parentId;
  const seen = new Set<string>([categoryId]);
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    const row: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return false;
}
