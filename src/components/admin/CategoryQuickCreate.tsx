"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { adminCardClass, adminInputErrorClass, adminSelectClass } from "@/components/admin/adminUi";
import { saveAdminCategory } from "@/server/actions/admin";
import { categorySlugFromName } from "@/lib/categorySlug";
import { CATEGORY_ICON_OPTIONS } from "@/lib/categoryIcons";
import type { AdminCategoryRow } from "@/server/admin/categories";

export function CategoryQuickCreate({ mainCategories }: { mainCategories: AdminCategoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentId, setParentId] = useState("");
  const [iconKey, setIconKey] = useState("");
  const [showInMainNav, setShowInMainNav] = useState(false);
  const [showOnHomepage, setShowOnHomepage] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(value.trim() ? categorySlugFromName(value) : "");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setFieldErrors({});
    startTransition(async () => {
      const result = await saveAdminCategory({
        slug,
        parentId: parentId || null,
        imageUrl: "",
        iconKey: parentId ? "" : iconKey,
        sortOrder: 0,
        isActive: true,
        indexable: true,
        showInMainNav,
        navSortOrder: 0,
        showOnHomepage,
        homepageSortOrder: 0,
        translations: {
          ka: { name, description: "", seoTitle: "", seoDescription: "" },
          en: { name: "", description: "", seoTitle: "", seoDescription: "" },
          ru: { name: "", description: "", seoTitle: "", seoDescription: "" },
        },
      });
      if (!result.ok) {
        setMessage(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setName("");
      setSlug("");
      setSlugTouched(false);
      setParentId("");
      setIconKey("");
      setShowInMainNav(false);
      setShowOnHomepage(false);
      router.refresh();
    });
  }

  return (
    <section className={adminCardClass}>
      <form onSubmit={submit} className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="text-body font-semibold text-text">კატეგორიის დამატება</h2>
          <p className="text-label text-text-faint">აირჩიეთ მშობელი მთავარი კატეგორია, ან დატოვეთ ცარიელი მთავარი კატეგორიისთვის.</p>
        </div>
        {message ? (
          <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-50 px-3 py-2 text-small text-danger-600">
            {message}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField id="quick-cat-name" label="დასახელება" required error={fieldErrors["translations.ka.name"]}>
            <input
              id="quick-cat-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className={adminInputErrorClass(Boolean(fieldErrors["translations.ka.name"]))}
              required
            />
          </FormField>
          <FormField id="quick-cat-slug" label="Slug (Latin)" error={fieldErrors.slug}>
            <input
              id="quick-cat-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="მაგ: teleponebi"
              className={adminInputErrorClass(Boolean(fieldErrors.slug))}
            />
          </FormField>
          <FormField id="quick-cat-parent" label="მშობელი კატეგორია">
            <select
              id="quick-cat-parent"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={adminSelectClass}
            >
              <option value="">მთავარი კატეგორია (უმშობლო)</option>
              {mainCategories.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </FormField>
          {!parentId ? (
            <FormField id="quick-cat-icon" label="იკონი (მთავარი)">
              <select id="quick-cat-icon" value={iconKey} onChange={(e) => setIconKey(e.target.value)} className={adminSelectClass}>
                <option value="">—</option>
                {CATEGORY_ICON_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-4 text-small text-text">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showInMainNav} onChange={(e) => setShowInMainNav(e.target.checked)} />
            მთავარ ნავიგაციაში
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={showOnHomepage} onChange={(e) => setShowOnHomepage(e.target.checked)} />
            მთავარ გვერდზე
          </label>
        </div>
        <div>
          <Button type="submit" disabled={pending || !name.trim()}>
            {pending ? "ემატება…" : "დამატება"}
          </Button>
        </div>
      </form>
    </section>
  );
}
