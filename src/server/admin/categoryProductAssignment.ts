import "server-only";

import { prisma } from "@/server/db";
import { pickTranslation } from "@/server/locale";
import type { CategoryProductAssignment, CategoryProductBlocker } from "@/server/admin/categoryProductAssignmentTypes";

export type { CategoryProductAssignment, CategoryProductBlocker } from "@/server/admin/categoryProductAssignmentTypes";
export { formatCategoryProductDeleteBlock } from "@/lib/categoryProductAssignment";

/** Non-archived products — matches Admin → Products default list and category count. */
export const categoryLiveProductWhere = { deletedAt: null } as const;

/**
 * Single source of truth for Admin Categories product counts and delete checks.
 * Counts only products whose `categoryId` equals this category (no child rollup).
 */
export async function getCategoryProductAssignment(
  categoryId: string,
  opts?: { blockerLimit?: number },
): Promise<CategoryProductAssignment> {
  const blockerLimit = opts?.blockerLimit ?? 12;

  const [liveCount, archivedCount, products] = await Promise.all([
    prisma.product.count({ where: { categoryId, deletedAt: null } }),
    prisma.product.count({ where: { categoryId, deletedAt: { not: null } } }),
    prisma.product.findMany({
      where: { categoryId },
      select: {
        id: true,
        sku: true,
        slug: true,
        deletedAt: true,
        translations: { select: { locale: true, name: true } },
      },
      orderBy: [{ deletedAt: "asc" }, { sku: "asc" }],
      take: blockerLimit,
    }),
  ]);

  return {
    categoryId,
    liveCount,
    archivedCount,
    assignedCount: liveCount + archivedCount,
    blockers: products.map((product): CategoryProductBlocker => ({
      id: product.id,
      sku: product.sku,
      slug: product.slug,
      name: pickTranslation(product.translations).name || product.sku,
      archived: product.deletedAt != null,
    })),
  };
}

/** Map categoryId → archived product count for the admin category tree. */
export async function archivedProductCountsByCategory(): Promise<Map<string, number>> {
  const rows = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { deletedAt: { not: null } },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.categoryId, row._count._all]));
}
