import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/admin";
import { listAdminCategories } from "@/server/admin/categories";
import { CategoryQuickCreate } from "@/components/admin/CategoryQuickCreate";
import { CategoryOrganizeButton } from "@/components/admin/CategoryOrganizeButton";
import { CategoryTreeManager } from "@/components/admin/CategoryTreeManager";

export const metadata: Metadata = { title: "კატეგორიები" };

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");
  const rows = await listAdminCategories();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">კატეგორიები</h1>
        <p className="text-small mt-1 text-text-muted">
          {rows.length} კატეგორია · მთავარი → ქვეკატეგორია
        </p>
      </div>
      <CategoryOrganizeButton />
      <CategoryQuickCreate mainCategories={rows.filter((row) => !row.parentId)} />
      <CategoryTreeManager
        key={rows
          .map(
            (row) =>
              `${row.id}:${row.parentId ?? ""}:${row.sortOrder}:${row.productCount}:${row.totalProductCount}:${row.iconKey ?? ""}`,
          )
          .join("|")}
        initialRows={rows}
      />
    </div>
  );
}
