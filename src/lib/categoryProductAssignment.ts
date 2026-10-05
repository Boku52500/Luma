import type { CategoryProductAssignment } from "@/server/admin/categoryProductAssignmentTypes";

export type { CategoryProductAssignment, CategoryProductBlocker } from "@/server/admin/categoryProductAssignmentTypes";

/** Human-readable delete block when products still reference the category. */
export function formatCategoryProductDeleteBlock(assignment: CategoryProductAssignment): string {
  if (assignment.assignedCount <= 0) {
    return "კატეგორიას აქვს პროდუქტები — ჯერ გადაიტანეთ პროდუქტები";
  }

  const labels = assignment.blockers.map((item) => {
    const mark = item.archived ? "არქივი" : "აქტიური";
    return `${item.sku} (${mark})`;
  });
  const more =
    assignment.assignedCount > assignment.blockers.length
      ? ` და კიდევ ${assignment.assignedCount - assignment.blockers.length}`
      : "";

  if (assignment.liveCount === 0 && assignment.archivedCount > 0) {
    return `კატეგორიას აქვს ${assignment.archivedCount} დაარქივებული პროდუქტი: ${labels.join(", ")}${more}. გადაიტანეთ ან აღადგინეთ Admin → პროდუქტები → არქივი.`;
  }

  return `კატეგორიას აქვს ${assignment.assignedCount} პროდუქტი: ${labels.join(", ")}${more} — ჯერ გადაიტანეთ პროდუქტები`;
}
