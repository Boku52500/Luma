"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { ProductImageManager, type EditorImage } from "@/components/admin/ProductImageManager";
import {
  ADMIN_EDITOR_BOTTOM_PAD_CLASS,
  ADMIN_STICKY_FOOTER_CLASS,
  ADMIN_STICKY_FOOTER_INNER_CLASS,
  adminCardClass,
  adminInputErrorClass,
  adminSelectClass,
  adminTextareaClass,
} from "@/components/admin/adminUi";
import { BADGE_KIND_OPTIONS } from "@/lib/adminLabels";
import {
  applyPastedSpecifications,
  parsePastedSpecificationTable,
  planProductSpecifications,
  resolvePastedSpecificationText,
} from "@/lib/adminProductSpecs";
import { deactivateAdminProduct, restoreAdminProduct, saveAdminProduct, createAdminVariantOption, createAdminSpecification, createAdminSpecificationValue } from "@/server/actions/admin";
import { AdminCreatableCombobox } from "@/components/admin/AdminCreatableCombobox";
import { AdminProductDeleteButton } from "@/components/admin/AdminProductDeleteButton";
import type {
  AdminProductEditorData,
  AdminLookupOption,
  AdminSpecDefinition,
  AdminVariantAttribute,
} from "@/server/admin/products";

type Props = {
  product: AdminProductEditorData;
  brands: AdminLookupOption[];
  categories: AdminLookupOption[];
  variantAttributes: AdminVariantAttribute[];
  specDefinitions: AdminSpecDefinition[];
  isNew?: boolean;
  storageConfigured?: boolean;
};

function newVariant(): EditorVariant {
  return {
    id: "",
    sku: "",
    priceOverride: "",
    stockQuantity: 0,
    isActive: true,
    optionIds: [],
    key: `var-${Date.now()}`,
  };
}

type EditorVariant = {
  id: string;
  sku: string;
  priceOverride: string;
  stockQuantity: number;
  isActive: boolean;
  optionIds: string[];
  key: string;
};

type SpecRow = {
  key: string;
  specificationId: string;
  specificationName: string;
  valueId: string;
  value: string;
};

export function ProductEditor({ product, brands, categories, variantAttributes, specDefinitions, isNew, storageConfigured = false }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState(product);
  const [images, setImages] = useState<EditorImage[]>(
    () => product.images.map((image, index) => ({ ...image, objectKey: image.objectKey ?? null, key: image.id || `img-${index}` })),
  );
  const [variants, setVariants] = useState<EditorVariant[]>(
    () => product.variants.map((variant, index) => ({ ...variant, key: variant.id || `var-${index}` })),
  );
  const [attributes, setAttributes] = useState(variantAttributes);
  const [definitions, setDefinitions] = useState(specDefinitions);
  const [specRows, setSpecRows] = useState<SpecRow[]>(() =>
    product.specifications
      .filter((row) => row.value.trim())
      .map((row, index) => ({
        key: row.specificationId || `spec-${index}`,
        specificationId: row.specificationId,
        specificationName: specDefinitions.find((item) => item.id === row.specificationId)?.name ?? "",
        valueId: row.valueId,
        value: row.value,
      })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteResult, setPasteResult] = useState<{ filled: number; skipped: string[] } | null>(null);

  function patch<K extends keyof AdminProductEditorData>(key: K, value: AdminProductEditorData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function patchKa<K extends keyof AdminProductEditorData["translations"]["ka"]>(
    key: K,
    value: AdminProductEditorData["translations"]["ka"][K],
  ) {
    setForm((current) => ({
      ...current,
      translations: { ...current.translations, ka: { ...current.translations.ka, [key]: value } },
    }));
  }

  function patchLocale(
    locale: "en" | "ru",
    key: keyof AdminProductEditorData["translations"]["ka"],
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      translations: {
        ...current.translations,
        [locale]: { ...current.translations[locale], [key]: value },
      },
    }));
  }

  function submit() {
    setMessage(null);
    setSuccess(null);
    setFieldErrors({});
    const specPlan = planProductSpecifications(
      specRows.map((row) => ({
        specificationId: row.specificationId || undefined,
        specificationName: row.specificationName,
        valueId: row.valueId,
        value: row.value,
      })),
    );
    if (!specPlan.ok) {
      setMessage(specPlan.message);
      return;
    }
    startTransition(async () => {
      const result = await saveAdminProduct({
        id: form.id || undefined,
        sku: form.sku,
        slug: form.slug,
        brandId: form.brandId,
        categoryId: form.categoryId,
        price: form.price,
        previousPrice: form.previousPrice,
        stockQuantity: 0,
        stockStatus: form.stockStatus,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        isNew: form.isNew,
        featuredSort: form.featuredSort,
        newArrivalSort: form.newArrivalSort,
        badgeKind: form.badgeKind || null,
        badgeLabel: form.badgeLabel,
        indexable: form.indexable,
        warrantyMonths: form.warrantyMonths,
        returnDays: form.returnDays,
        translations: form.translations,
        images: images
          .filter((image) => image.url.trim())
          .map((image, index) => ({
            id: image.id || undefined,
            url: image.url,
            alt: image.alt,
            sortOrder: index,
            objectKey: image.objectKey || null,
          })),
        variants: variants.map((variant) => ({
          id: variant.id || undefined,
          sku: variant.sku,
          priceOverride: variant.priceOverride,
          stockQuantity: 0,
          isActive: variant.isActive,
          optionIds: variant.optionIds,
        })),
        specifications: specPlan.rows.map((row) => ({
          specificationId: row.specificationId || undefined,
          specificationName: row.specificationName,
          value: row.value,
        })),
      });
      if (!result.ok) {
        setMessage(result.message);
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      setSuccess("ცვლილებები შენახულია");
      if (isNew) {
        router.push(`/admin/products/${result.data.id}?saved=1`);
        router.refresh();
        return;
      }
      // Keep editor rows aligned with what we just persisted (drop blank drafts).
      setSpecRows((current) =>
        current.filter((row) => row.specificationId.trim() && row.value.trim()),
      );
      router.refresh();
    });
  }

  function deactivate() {
    if (!form.id) return;
    startTransition(async () => {
      const result = await deactivateAdminProduct({ id: form.id });
      setConfirmDeactivate(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSuccess("პროდუქტი გაითიშა");
      patch("isActive", false);
      router.refresh();
    });
  }

  function restore() {
    if (!form.id) return;
    startTransition(async () => {
      const result = await restoreAdminProduct({ id: form.id });
      setConfirmRestore(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSuccess("პროდუქტი აღდგენილია");
      patch("isActive", true);
      patch("deletedAt", null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <div className={`flex flex-col gap-5 ${ADMIN_EDITOR_BOTTOM_PAD_CLASS}`}>
      {message ? (
        <p role="alert" className="rounded-[var(--radius-sm)] border border-danger-500/25 bg-danger-50 px-3 py-2 text-small text-danger-600">
          {message}
        </p>
      ) : null}
      {form.deletedAt ? (
        <p role="status" className="rounded-[var(--radius-sm)] border border-warning-500/25 bg-warning-50 px-3 py-2 text-small text-text">
          ეს პროდუქტი არქივშია და ვიტრინაზე არ ჩანს. ისტორიული შეკვეთები შენარჩუნებულია.
        </p>
      ) : null}
      {success ? (
        <p role="status" className="rounded-[var(--radius-sm)] border border-success-500/25 bg-success-50 px-3 py-2 text-small text-success-600">
          {success}
        </p>
      ) : null}

      <section className={adminCardClass}>
        <h2 className="mb-4 text-base font-semibold text-text">ძირითადი ინფორმაცია</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="nameKa" label="დასახელება (ქართული)" required error={fieldErrors["translations.ka.name"]}>
            <input
              id="nameKa"
              value={form.translations.ka.name}
              onChange={(e) => patchKa("name", e.target.value)}
              className={adminInputErrorClass(Boolean(fieldErrors["translations.ka.name"]))}
            />
          </FormField>
          <FormField id="slug" label="Slug" required error={fieldErrors.slug}>
            <input id="slug" value={form.slug} onChange={(e) => patch("slug", e.target.value)} className={adminInputErrorClass(Boolean(fieldErrors.slug))} />
          </FormField>
          <FormField id="sku" label="SKU" required error={fieldErrors.sku}>
            <input id="sku" value={form.sku} onChange={(e) => patch("sku", e.target.value)} className={adminInputErrorClass(Boolean(fieldErrors.sku))} />
          </FormField>
          <FormField id="brandId" label="ბრენდი" required error={fieldErrors.brandId}>
            <select id="brandId" value={form.brandId} onChange={(e) => patch("brandId", e.target.value)} className={adminSelectClass}>
              <option value="">აირჩიეთ ბრენდი</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="categoryId" label="კატეგორია" required error={fieldErrors.categoryId}>
            <select id="categoryId" value={form.categoryId} onChange={(e) => patch("categoryId", e.target.value)} className={adminSelectClass}>
              <option value="">აირჩიეთ კატეგორია</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="shortDescription" label="მოკლე აღწერა" className="sm:col-span-2">
            <textarea
              id="shortDescription"
              value={form.translations.ka.shortDescription}
              onChange={(e) => patchKa("shortDescription", e.target.value)}
              className={adminTextareaClass}
            />
          </FormField>
          <FormField id="description" label="სრული აღწერა" className="sm:col-span-2">
            <textarea
              id="description"
              value={form.translations.ka.description}
              onChange={(e) => patchKa("description", e.target.value)}
              className={`${adminTextareaClass} min-h-[8rem]`}
            />
          </FormField>
        </div>
      </section>

      <section className={adminCardClass}>
        <h2 className="mb-4 text-base font-semibold text-text">ფასი</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="price" label="მიმდინარე ფასი" required error={fieldErrors.price}>
            <input id="price" inputMode="decimal" value={form.price} onChange={(e) => patch("price", e.target.value)} className={adminInputErrorClass(Boolean(fieldErrors.price))} />
          </FormField>
          <FormField id="previousPrice" label="წინა ფასი" optional error={fieldErrors.previousPrice}>
            <input id="previousPrice" inputMode="decimal" value={form.previousPrice} onChange={(e) => patch("previousPrice", e.target.value)} className={adminInputErrorClass(Boolean(fieldErrors.previousPrice))} />
          </FormField>
        </div>
      </section>

      <section className={adminCardClass}>
        <h2 className="mb-4 text-base font-semibold text-text">ხელმისაწვდომობა და ვიტრინა</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex min-h-11 items-center gap-2 text-small">
            <input type="checkbox" checked={form.isActive} onChange={(e) => patch("isActive", e.target.checked)} />
            ხელმისაწვდომია
          </label>
          <label className="flex min-h-11 items-center gap-2 text-small">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => patch("isFeatured", e.target.checked)} />
            რჩეული
          </label>
          <label className="flex min-h-11 items-center gap-2 text-small">
            <input type="checkbox" checked={form.isNew} onChange={(e) => patch("isNew", e.target.checked)} />
            ახალი შემოსული
          </label>
          <label className="flex min-h-11 items-center gap-2 text-small">
            <input type="checkbox" checked={form.indexable} onChange={(e) => patch("indexable", e.target.checked)} />
            ინდექსირებადი (SEO)
          </label>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField id="featuredSort" label="რჩეულის რიგი" optional>
            <input
              id="featuredSort"
              type="number"
              min={0}
              value={form.featuredSort ?? ""}
              onChange={(e) => patch("featuredSort", e.target.value === "" ? null : Number(e.target.value))}
              className={adminInputErrorClass(false)}
            />
          </FormField>
          <FormField id="newArrivalSort" label="ახალის რიგი" optional>
            <input
              id="newArrivalSort"
              type="number"
              min={0}
              value={form.newArrivalSort ?? ""}
              onChange={(e) => patch("newArrivalSort", e.target.value === "" ? null : Number(e.target.value))}
              className={adminInputErrorClass(false)}
            />
          </FormField>
          <FormField id="badgeKind" label="ბეჯი">
            <select id="badgeKind" value={form.badgeKind} onChange={(e) => patch("badgeKind", e.target.value)} className={adminSelectClass}>
              {BADGE_KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="badgeLabel" label="ბეჯის ტექსტი" optional>
            <input id="badgeLabel" value={form.badgeLabel} onChange={(e) => patch("badgeLabel", e.target.value)} className={adminInputErrorClass(false)} />
          </FormField>
          <FormField id="warranty" label="გარანტია (ტექსტი)" optional>
            <input id="warranty" value={form.translations.ka.warranty} onChange={(e) => patchKa("warranty", e.target.value)} className={adminInputErrorClass(false)} />
          </FormField>
          <FormField id="warrantyMonths" label="გარანტია (თვე)" optional>
            <input
              id="warrantyMonths"
              type="number"
              min={0}
              value={form.warrantyMonths ?? ""}
              onChange={(e) => patch("warrantyMonths", e.target.value === "" ? null : Number(e.target.value))}
              className={adminInputErrorClass(false)}
            />
          </FormField>
        </div>
      </section>

      <section className={adminCardClass}>
        <h2 className="mb-4 text-base font-semibold text-text">SEO</h2>
        <div className="grid gap-4">
          <FormField id="seoTitle" label="SEO სათაური" optional>
            <input id="seoTitle" value={form.translations.ka.seoTitle} onChange={(e) => patchKa("seoTitle", e.target.value)} className={adminInputErrorClass(false)} />
          </FormField>
          <FormField id="seoDescription" label="SEO აღწერა" optional>
            <textarea id="seoDescription" value={form.translations.ka.seoDescription} onChange={(e) => patchKa("seoDescription", e.target.value)} className={adminTextareaClass} />
          </FormField>
        </div>
      </section>

      <details className={adminCardClass}>
        <summary className="cursor-pointer text-base font-semibold text-text">დამატებითი თარგმანები (EN / RU)</summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {(["en", "ru"] as const).map((locale) => (
            <div key={locale} className="flex flex-col gap-3">
              <h3 className="text-small font-semibold uppercase text-text-muted">{locale}</h3>
              <FormField id={`${locale}-name`} label="დასახელება" optional>
                <input
                  id={`${locale}-name`}
                  value={form.translations[locale].name}
                  onChange={(e) => patchLocale(locale, "name", e.target.value)}
                  className={adminInputErrorClass(false)}
                />
              </FormField>
              <FormField id={`${locale}-short`} label="მოკლე აღწერა" optional>
                <textarea
                  id={`${locale}-short`}
                  value={form.translations[locale].shortDescription}
                  onChange={(e) => patchLocale(locale, "shortDescription", e.target.value)}
                  className={adminTextareaClass}
                />
              </FormField>
            </div>
          ))}
        </div>
      </details>

      <ProductImageManager
        productId={form.id}
        productName={form.translations.ka.name}
        images={images}
        onChange={setImages}
        storageConfigured={storageConfigured}
      />

      <section className={adminCardClass}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text">ვარიანტები</h2>
          <Button type="button" variant="secondary" size="sm" onClick={() => setVariants((current) => [...current, newVariant()])}>
            <Plus className="size-4" />
            ვარიანტის დამატება
          </Button>
        </div>
        {variants.length === 0 ? (
          <p className="text-small text-text-muted">ვარიანტები არ არის — ხელმისაწვდომობა მართავს მხოლოდ პროდუქტის დონეზე.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {variants.map((variant, index) => (
              <div key={variant.key} className="rounded-[var(--radius-sm)] border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField id={`v-sku-${index}`} label="SKU">
                    <input
                      id={`v-sku-${index}`}
                      value={variant.sku}
                      onChange={(e) => setVariants((current) => current.map((row, i) => (i === index ? { ...row, sku: e.target.value } : row)))}
                      className={adminInputErrorClass(false)}
                    />
                  </FormField>
                  <FormField id={`v-price-${index}`} label="ფასის override" optional>
                    <input
                      id={`v-price-${index}`}
                      value={variant.priceOverride}
                      onChange={(e) => setVariants((current) => current.map((row, i) => (i === index ? { ...row, priceOverride: e.target.value } : row)))}
                      className={adminInputErrorClass(false)}
                    />
                  </FormField>
                  <label className="flex min-h-11 items-end gap-2 pb-2 text-small">
                    <input
                      type="checkbox"
                      checked={variant.isActive}
                      onChange={(e) => setVariants((current) => current.map((row, i) => (i === index ? { ...row, isActive: e.target.checked } : row)))}
                    />
                    ხელმისაწვდომია
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {attributes.map((attribute) => (
                    <FormField key={attribute.id} id={`v-${index}-${attribute.slug}`} label={attribute.name}>
                      <AdminCreatableCombobox
                        id={`v-${index}-${attribute.slug}`}
                        valueId={variant.optionIds.find((id) => attribute.options.some((option) => option.id === id)) ?? ""}
                        options={attribute.options.map((option) => ({ id: option.id, label: option.name }))}
                        placeholder="ძებნა ან ახალი მნიშვნელობა..."
                        createLabel={(label) => `+ დამატება „${label}“`}
                        onSelect={(option) => {
                          setVariants((current) =>
                            current.map((row, i) => {
                              if (i !== index) return row;
                              const without = row.optionIds.filter((id) => !attribute.options.some((item) => item.id === id));
                              return { ...row, optionIds: option ? [...without, option.id] : without };
                            }),
                          );
                        }}
                        onCreate={async (label) => {
                          const result = await createAdminVariantOption({ attributeId: attribute.id, name: label });
                          if (!result.ok) {
                            setMessage(result.message);
                            return null;
                          }
                          setAttributes((current) =>
                            current.map((item) =>
                              item.id === attribute.id
                                ? { ...item, options: [...item.options, { id: result.data.id, slug: result.data.slug, name: result.data.name, swatch: null }] }
                                : item,
                            ),
                          );
                          return { id: result.data.id, label: result.data.name };
                        }}
                      />
                    </FormField>
                  ))}
                </div>
                <button
                  type="button"
                  className="text-small mt-3 text-danger-600"
                  onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}
                >
                  ვარიანტის წაშლა
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={adminCardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text">სპეციფიკაციები</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setPasteOpen((open) => !open);
                setPasteResult(null);
              }}
            >
              სპეციფიკაციების ჩასმა
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setSpecRows((current) => [
                  ...current,
                  { key: `spec-${Date.now()}`, specificationId: "", specificationName: "", valueId: "", value: "" },
                ])
              }
            >
              <Plus className="size-4" />
              სპეციფიკაციის დამატება
            </Button>
          </div>
        </div>
        {pasteOpen ? (
          <div className="mb-4 rounded-[var(--radius-sm)] border border-border bg-surface-2 p-3">
            <FormField id="spec-paste" label="ჩასვით Markdown სპეციფიკაციები">
              <textarea
                id="spec-paste"
                value={pasteText}
                onChange={(event) => setPasteText(event.target.value)}
                onPaste={(event) => {
                  const plain = event.clipboardData.getData("text/plain") || "";
                  const html = event.clipboardData.getData("text/html") || "";
                  const resolved = resolvePastedSpecificationText(plain, html);
                  // Always control paste so React state keeps the exact markdown
                  // (or recovered pipe tables) instead of a flattened browser insert.
                  event.preventDefault();
                  const target = event.currentTarget;
                  const start = target.selectionStart ?? pasteText.length;
                  const end = target.selectionEnd ?? pasteText.length;
                  const next = `${pasteText.slice(0, start)}${resolved}${pasteText.slice(end)}`;
                  setPasteText(next);
                }}
                spellCheck={false}
                className={`${adminTextareaClass} font-mono whitespace-pre-wrap`}
                rows={12}
                placeholder={"| ბრენდი | Microsoft |\n| --------- | --------- |\n| მოდელი/PN | Xbox Series S |\n\n##### პროცესორი\n\n| პროცესორის მწარმოებელი | AMD |"}
              />
            </FormField>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  // Always read the raw textarea value and match against the full
                  // specification library — not only currently visible product rows.
                  const pasted = parsePastedSpecificationTable(pasteText);
                  const result = applyPastedSpecifications(specRows, pasted, definitions);
                  setSpecRows(result.rows);
                  setPasteResult({ filled: result.filled, skipped: result.skipped });
                }}
              >
                შევსება
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setPasteOpen(false);
                  setPasteResult(null);
                }}
              >
                დახურვა
              </Button>
            </div>
            {pasteResult ? (
              <div className="mt-3">
                <p className="text-small text-text">
                  შეივსო {pasteResult.filled} სპეციფიკაცია • {pasteResult.skipped.length} ვერ მოიძებნა
                </p>
                {pasteResult.skipped.length ? (
                  <ul className="text-small mt-1 list-disc pl-5 text-text-muted">
                    {pasteResult.skipped.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {specRows.length === 0 ? (
          <p className="text-small text-text-muted">სპეციფიკაციები არ არის. დაამატეთ RAM, Processor ან ნებისმიერი სხვა ველი — ახალი სქემა არ არის საჭირო.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {specRows.map((row, index) => {
              const definition = definitions.find((item) => item.id === row.specificationId);
              const valueOptions = definition?.values ?? [];
              return (
                <div key={row.key} className="grid gap-3 rounded-[var(--radius-sm)] border border-border p-3 sm:grid-cols-[1fr_1fr_auto]">
                  <FormField id={`spec-name-${index}`} label="სპეციფიკაცია">
                    <AdminCreatableCombobox
                      id={`spec-name-${index}`}
                      valueId={row.specificationId}
                      valueLabel={row.specificationName}
                      options={definitions.map((item) => ({ id: item.id, label: item.name }))}
                      placeholder="ძებნა ან ახალი სპეციფიკაცია..."
                      createLabel={(label) => `+ დამატება „${label}“`}
                      onSelect={(option) => {
                        const definition = option ? definitions.find((item) => item.id === option.id) : null;
                        setSpecRows((current) =>
                          current.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  specificationId: option?.id ?? "",
                                  specificationName: definition?.name ?? option?.label ?? "",
                                  valueId: "",
                                  value: "",
                                }
                              : item,
                          ),
                        );
                      }}
                      onCreate={async (label) => {
                        const result = await createAdminSpecification({ name: label });
                        if (!result.ok) {
                          setMessage(result.message);
                          return null;
                        }
                        setDefinitions((current) =>
                          current.some((item) => item.id === result.data.id)
                            ? current
                            : [...current, { id: result.data.id, slug: "", name: result.data.name, unit: null, values: [] }],
                        );
                        return { id: result.data.id, label: result.data.name };
                      }}
                    />
                  </FormField>
                  <FormField id={`spec-value-${index}`} label="მნიშვნელობა">
                    <AdminCreatableCombobox
                      id={`spec-value-${index}`}
                      valueId={row.valueId}
                      valueLabel={row.value}
                      options={valueOptions.map((item) => ({ id: item.id, label: item.name }))}
                      placeholder="ძებნა ან ახალი მნიშვნელობა..."
                      disabled={!row.specificationId}
                      createLabel={(label) => `+ დამატება „${label}“`}
                      onSelect={(option) => {
                        setSpecRows((current) =>
                          current.map((item, i) =>
                            i === index ? { ...item, valueId: option?.id ?? "", value: option?.label ?? "" } : item,
                          ),
                        );
                      }}
                      onCreate={async (label) => {
                        if (!row.specificationId) return null;
                        const result = await createAdminSpecificationValue({ specificationId: row.specificationId, name: label });
                        if (!result.ok) {
                          setMessage(result.message);
                          return null;
                        }
                        setDefinitions((current) =>
                          current.map((item) =>
                            item.id === row.specificationId
                              ? {
                                  ...item,
                                  values: item.values.some((value) => value.id === result.data.id)
                                    ? item.values
                                    : [...item.values, { id: result.data.id, name: result.data.name }],
                                }
                              : item,
                          ),
                        );
                        return { id: result.data.id, label: result.data.name };
                      }}
                    />
                  </FormField>
                  <button
                    type="button"
                    className="text-small self-end pb-2 text-danger-600"
                    onClick={() => setSpecRows((current) => current.filter((_, i) => i !== index))}
                  >
                    წაშლა
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      </div>

      <div className={ADMIN_STICKY_FOOTER_CLASS}>
        <div className={ADMIN_STICKY_FOOTER_INNER_CLASS}>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "ინახება..." : isNew ? "შექმნა" : "შენახვა"}
        </Button>
        {!isNew && !form.deletedAt ? (
          <Button type="button" variant="secondary" disabled={pending || !form.isActive} onClick={() => setConfirmDeactivate(true)}>
            გამორთვა
          </Button>
        ) : null}
        {!isNew && form.deletedAt ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmRestore(true)}>
            აღდგენა
          </Button>
        ) : null}
        {!isNew && !form.deletedAt ? (
          <AdminProductDeleteButton
            productId={form.id}
            productName={form.translations.ka.name || form.sku}
            className="text-small font-semibold text-danger-600"
            onArchived={() => {
              patch("deletedAt", new Date().toISOString());
              patch("isActive", false);
            }}
          />
        ) : null}
        <Button href="/admin/products" variant="ghost">
          სიაზე დაბრუნება
        </Button>
        </div>
      </div>

      <AdminConfirmDialog
        open={confirmDeactivate}
        title="პროდუქტის გამორთვა"
        description="პროდუქტი აღარ გამოჩნდება ვიტრინაზე. ისტორიული შეკვეთები არ წაიშლება."
        confirmLabel="გამორთვა"
        danger
        pending={pending}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={deactivate}
      />
      <AdminConfirmDialog
        open={confirmRestore}
        title="პროდუქტის აღდგენა"
        description="პროდუქტი ისევ გამოჩნდება ვიტრინაზე, თუ აქტიურია."
        confirmLabel="აღდგენა"
        pending={pending}
        onClose={() => setConfirmRestore(false)}
        onConfirm={restore}
      />
    </div>
  );
}
