"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { adminCardClass, adminInputErrorClass, adminSelectClass } from "@/components/admin/adminUi";
import { HOMEPAGE_PRODUCT_SOURCES, HOMEPAGE_PRODUCT_SOURCE_LABELS, type HomepageProductSource } from "@/lib/homepage/types";
import { saveHomepageCategoryReel, searchHomepageProductOptions } from "@/server/actions/homepage";

export function CategoryReelEditor({
  sectionId,
  initialTitle,
  initialCategoryId,
  initialProductSource,
  initialLimit,
  initialViewAllHref,
  initialManualProducts,
  categories,
}: {
  sectionId: string;
  initialTitle: string;
  initialCategoryId: string;
  initialProductSource: HomepageProductSource;
  initialLimit: number;
  initialViewAllHref: string;
  initialManualProducts: { id: string; label: string }[];
  categories: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [productSource, setProductSource] = useState(initialProductSource);
  const [limit, setLimit] = useState(initialLimit);
  const [viewAllHref, setViewAllHref] = useState(initialViewAllHref);
  const [manualProducts, setManualProducts] = useState(initialManualProducts);
  const [productQuery, setProductQuery] = useState("");
  const [productOptions, setProductOptions] = useState<{ id: string; label: string; sku: string }[]>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (productSource !== "MANUAL") return;
    const handle = window.setTimeout(() => {
      searchHomepageProductOptions(productQuery).then(setProductOptions);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [productQuery, productSource]);

  function addProduct(option: { id: string; label: string }) {
    if (manualProducts.some((row) => row.id === option.id)) return;
    setManualProducts((current) => [...current, option]);
  }

  function removeProduct(id: string) {
    setManualProducts((current) => current.filter((row) => row.id !== id));
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= manualProducts.length) return;
    setManualProducts((current) => {
      const copy = [...current];
      const tmp = copy[index]!;
      copy[index] = copy[next]!;
      copy[next] = tmp;
      return copy;
    });
  }

  function save() {
    setMessage(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await saveHomepageCategoryReel({
        sectionId,
        title,
        categoryId: categoryId || null,
        productSource,
        limit,
        viewAllHref: viewAllHref || null,
        manualProductIds: manualProducts.map((row) => row.id),
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSuccess("ზოლი შენახულია");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-50 px-3 py-2 text-small text-danger-600">{message}</p> : null}
      {success ? <p role="status" className="rounded-[var(--radius-sm)] bg-success-50 px-3 py-2 text-small text-success-600">{success}</p> : null}

      <section className={adminCardClass}>
        <h2 className="mb-4 text-base font-semibold text-text">პროდუქტების ზოლი</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="reel-title" label="სათაური">
            <input id="reel-title" value={title} onChange={(e) => setTitle(e.target.value)} className={adminInputErrorClass(false)} />
          </FormField>
          <FormField id="reel-category" label="კატეგორია">
            <select id="reel-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={adminSelectClass}>
              <option value="">— აირჩიეთ —</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="reel-source" label="პროდუქტების შერჩევა">
            <select
              id="reel-source"
              value={productSource}
              onChange={(e) => setProductSource(e.target.value as HomepageProductSource)}
              className={adminSelectClass}
            >
              {HOMEPAGE_PRODUCT_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {HOMEPAGE_PRODUCT_SOURCE_LABELS[source]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="reel-limit" label="მაქსიმალური რაოდენობა">
            <input
              id="reel-limit"
              type="number"
              min={1}
              max={24}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className={adminInputErrorClass(false)}
            />
          </FormField>
          <FormField id="reel-view-all" label="„ყველას ნახვა“ ბმული (არასავალდებულო)" optional className="sm:col-span-2">
            <input
              id="reel-view-all"
              value={viewAllHref}
              placeholder="/category/phones"
              onChange={(e) => setViewAllHref(e.target.value)}
              className={adminInputErrorClass(false)}
            />
          </FormField>
        </div>

        {productSource === "MANUAL" ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-small font-medium text-text">ხელით არჩეული პროდუქტები (რიგის მიხედვით)</p>
            <div className="mt-2 flex flex-col gap-2">
              {manualProducts.length === 0 ? (
                <p className="text-small text-text-muted">პროდუქტი ჯერ არ არის დამატებული.</p>
              ) : null}
              {manualProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2">
                  <span className="flex-1 text-small text-text">{product.label}</span>
                  <Button type="button" variant="secondary" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button type="button" variant="secondary" size="sm" disabled={index === manualProducts.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeProduct(product.id)}>
                    <X className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <FormField id="reel-product-search" label="პროდუქტის მოძებნა და დამატება" optional className="mt-3">
              <input
                id="reel-product-search"
                value={productQuery}
                placeholder="ჩაწერეთ სახელი ან SKU…"
                onChange={(e) => setProductQuery(e.target.value)}
                className={adminInputErrorClass(false)}
              />
            </FormField>
            {productOptions.length > 0 ? (
              <ul className="mt-1 max-h-48 overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-surface">
                {productOptions.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-small hover:bg-surface-2"
                      onClick={() => addProduct(option)}
                    >
                      <span>{option.label}</span>
                      <span className="text-label text-text-faint">{option.sku}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <div>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "ინახება..." : "შენახვა"}
        </Button>
      </div>
    </div>
  );
}
