"use client";

import { useEffect, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { adminInputErrorClass, adminSelectClass } from "@/components/admin/adminUi";
import { HOMEPAGE_LINK_TYPE_LABELS } from "@/lib/homepage/types";
import { searchHomepageProductOptions } from "@/server/actions/homepage";
import type { HomepageLinkType } from "@/generated/prisma/client";

export type HomepageLinkValue = {
  linkType: HomepageLinkType;
  href: string;
  categoryId: string;
  categoryLabel?: string;
  productId: string;
  productLabel?: string;
  brandId: string;
  brandLabel?: string;
};

const LINK_TYPES: HomepageLinkType[] = ["NONE", "CATEGORY", "PRODUCT", "BRAND", "CUSTOM"];

export function HomepageLinkFields({
  idPrefix,
  value,
  categories,
  brands,
  onChange,
  allowedTypes = LINK_TYPES,
}: {
  idPrefix: string;
  value: HomepageLinkValue;
  categories: { id: string; label: string }[];
  brands: { id: string; label: string }[];
  onChange: (next: HomepageLinkValue) => void;
  allowedTypes?: HomepageLinkType[];
}) {
  const [productQuery, setProductQuery] = useState(value.productLabel ?? "");
  const [productOptions, setProductOptions] = useState<{ id: string; label: string; sku: string }[]>([]);

  useEffect(() => {
    if (value.linkType !== "PRODUCT") return;
    const handle = window.setTimeout(() => {
      searchHomepageProductOptions(productQuery).then(setProductOptions);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [productQuery, value.linkType]);

  return (
    <div className="grid gap-3">
      <FormField id={`${idPrefix}-link-type`} label="ბმულის ტიპი">
        <select
          id={`${idPrefix}-link-type`}
          value={value.linkType}
          onChange={(e) => onChange({ ...value, linkType: e.target.value as HomepageLinkType })}
          className={adminSelectClass}
        >
          {allowedTypes.map((type) => (
            <option key={type} value={type}>
              {HOMEPAGE_LINK_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </FormField>

      {value.linkType === "CATEGORY" ? (
        <FormField id={`${idPrefix}-category`} label="კატეგორია">
          <select
            id={`${idPrefix}-category`}
            value={value.categoryId}
            onChange={(e) => onChange({ ...value, categoryId: e.target.value })}
            className={adminSelectClass}
          >
            <option value="">— აირჩიეთ —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}

      {value.linkType === "BRAND" ? (
        <FormField id={`${idPrefix}-brand`} label="ბრენდი">
          <select
            id={`${idPrefix}-brand`}
            value={value.brandId}
            onChange={(e) => onChange({ ...value, brandId: e.target.value })}
            className={adminSelectClass}
          >
            <option value="">— აირჩიეთ —</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.label}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}

      {value.linkType === "PRODUCT" ? (
        <FormField id={`${idPrefix}-product`} label="პროდუქტი">
          <input
            id={`${idPrefix}-product`}
            value={productQuery}
            placeholder="ჩაწერეთ სახელი ან SKU…"
            onChange={(e) => {
              setProductQuery(e.target.value);
              onChange({ ...value, productId: "", productLabel: e.target.value });
            }}
            className={adminInputErrorClass(false)}
          />
          {productOptions.length > 0 ? (
            <ul className="mt-1 max-h-40 overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-surface">
              {productOptions.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-small hover:bg-surface-2"
                    onClick={() => {
                      onChange({ ...value, productId: option.id, productLabel: option.label });
                      setProductQuery(option.label);
                      setProductOptions([]);
                    }}
                  >
                    <span>{option.label}</span>
                    <span className="text-label text-text-faint">{option.sku}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {value.productId ? <p className="text-label text-success-600">არჩეულია: {value.productLabel}</p> : null}
        </FormField>
      ) : null}

      {value.linkType === "CUSTOM" ? (
        <FormField id={`${idPrefix}-href`} label="ბმული">
          <input
            id={`${idPrefix}-href`}
            value={value.href}
            placeholder="/category/phones ან https://…"
            onChange={(e) => onChange({ ...value, href: e.target.value })}
            className={adminInputErrorClass(false)}
          />
        </FormField>
      ) : null}
    </div>
  );
}
