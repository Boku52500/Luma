import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/admin";
import { listAdminFilterOptions, listAdminProducts } from "@/server/admin/products";
import { Button } from "@/components/ui/Button";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminProductsTable } from "@/components/admin/AdminProductsTable";
import { adminInputClass, adminSelectClass } from "@/components/admin/adminUi";

export const metadata: Metadata = { title: "პროდუქტები" };

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requireAdmin("/admin/products");
  const params = await searchParams;
  const q = param(params.q);
  const categoryId = param(params.category);
  const brandId = param(params.brand);
  const active = (param(params.active) || "all") as "all" | "active" | "inactive" | "archived";
  const stock = (param(params.stock) || "all") as "all" | "in-stock" | "out-of-stock";
  const page = Math.max(1, Number(param(params.page) || "1") || 1);

  const [{ rows, total, totalPages }, filters] = await Promise.all([
    listAdminProducts({ q, categoryId: categoryId || undefined, brandId: brandId || undefined, active, stock, page }),
    listAdminFilterOptions(),
  ]);

  const hrefForPage = (nextPage: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (categoryId) search.set("category", categoryId);
    if (brandId) search.set("brand", brandId);
    if (active !== "all") search.set("active", active);
    if (stock !== "all") search.set("stock", stock);
    if (nextPage > 1) search.set("page", String(nextPage));
    const qs = search.toString();
    return qs ? `/admin/products?${qs}` : "/admin/products";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-text">პროდუქტები</h1>
          <p className="text-small mt-1 text-text-muted">{total} ჩანაწერი</p>
        </div>
        <Button href="/admin/products/new">ახალი პროდუქტი</Button>
      </div>

      <form
        method="get"
        autoComplete="off"
        key={`${q}|${categoryId}|${brandId}|${active}|${stock}|${page}`}
        className="grid gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-4 sm:grid-cols-2 lg:grid-cols-6"
      >
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className="text-[0.8125rem] font-medium">ძიება</span>
          <input name="q" defaultValue={q} placeholder="სახელი, SKU, slug" autoComplete="off" className={adminInputClass} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-medium">კატეგორია</span>
          <select name="category" defaultValue={categoryId} className={adminSelectClass}>
            <option value="">ყველა</option>
            {filters.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-medium">ბრენდი</span>
          <select name="brand" defaultValue={brandId} className={adminSelectClass}>
            <option value="">ყველა</option>
            {filters.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-medium">სტატუსი</span>
          <select name="active" defaultValue={active} className={adminSelectClass}>
            <option value="all">ყველა</option>
            <option value="active">აქტიური</option>
            <option value="inactive">გამორთული</option>
            <option value="archived">არქივი</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[0.8125rem] font-medium">ხელმისაწვდომობა</span>
          <select name="stock" defaultValue={stock} className={adminSelectClass}>
            <option value="all">ყველა</option>
            <option value="in-stock">ხელმისაწვდომია</option>
            <option value="out-of-stock">გამოუწვდომელი</option>
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="secondary" className="w-full">
            ფილტრი
          </Button>
        </div>
      </form>

      <AdminProductsTable key={rowsKey(rows)} initialRows={rows} />

      <AdminPagination page={page} totalPages={totalPages} hrefForPage={hrefForPage} />
    </div>
  );
}

function rowsKey(rows: { id: string; price: number; previousPrice: number | null; isActive: boolean; deletedAt: Date | null }[]) {
  return rows
    .map(
      (row) =>
        `${row.id}:${row.price}:${row.previousPrice ?? ""}:${row.isActive ? 1 : 0}:${row.deletedAt ? 1 : 0}`,
    )
    .join("|");
}
