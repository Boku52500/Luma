"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { adminCardClass, adminInputErrorClass } from "@/components/admin/adminUi";
import { HomepageImageUploadField } from "@/components/admin/homepage/HomepageImageUploadField";
import { HomepageLinkFields, type HomepageLinkValue } from "@/components/admin/homepage/HomepageLinkFields";
import { saveHomepageSplitBanners } from "@/server/actions/homepage";
import type { AdminHomepageBannerRow } from "@/server/homepage/admin";

type BannerForm = AdminHomepageBannerRow;

function toLinkValue(banner: BannerForm): HomepageLinkValue {
  return {
    linkType: banner.linkType,
    href: banner.href,
    categoryId: banner.categoryId,
    categoryLabel: banner.categoryLabel,
    productId: banner.productId,
    productLabel: banner.productLabel,
    brandId: banner.brandId,
    brandLabel: banner.brandLabel,
  };
}

function BannerCard({
  label,
  banner,
  storageConfigured,
  categories,
  brands,
  onChange,
}: {
  label: string;
  banner: BannerForm;
  storageConfigured: boolean;
  categories: { id: string; label: string }[];
  brands: { id: string; label: string }[];
  onChange: (next: BannerForm) => void;
}) {
  const idPrefix = `banner-${banner.slot ?? "x"}`;
  const link = toLinkValue(banner);

  return (
    <section className={adminCardClass}>
      <h2 className="mb-4 text-base font-semibold text-text">{label}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <HomepageImageUploadField
          id={`${idPrefix}-image`}
          label="სურათის ატვირთვა"
          imageUrl={banner.imageUrl}
          storageConfigured={storageConfigured}
          aspectClassName="aspect-[4/5] sm:aspect-square"
          onChange={({ imageUrl, objectKey }) => onChange({ ...banner, imageUrl, objectKey })}
        />
        <HomepageImageUploadField
          id={`${idPrefix}-mobile-image`}
          label="მობილურის სურათი (არასავალდებულო)"
          imageUrl={banner.mobileImageUrl}
          storageConfigured={storageConfigured}
          aspectClassName="aspect-[4/5] sm:aspect-square"
          onChange={({ imageUrl, objectKey }) => onChange({ ...banner, mobileImageUrl: imageUrl, mobileObjectKey: objectKey })}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <FormField id={`${idPrefix}-title`} label="სათაური" optional>
          <input id={`${idPrefix}-title`} value={banner.title} onChange={(e) => onChange({ ...banner, title: e.target.value })} className={adminInputErrorClass(false)} />
        </FormField>
        <FormField id={`${idPrefix}-subtitle`} label="ქვესათაური" optional>
          <input id={`${idPrefix}-subtitle`} value={banner.subtitle} onChange={(e) => onChange({ ...banner, subtitle: e.target.value })} className={adminInputErrorClass(false)} />
        </FormField>
        <FormField id={`${idPrefix}-cta`} label="ღილაკის ტექსტი" optional>
          <input id={`${idPrefix}-cta`} value={banner.ctaText} onChange={(e) => onChange({ ...banner, ctaText: e.target.value })} className={adminInputErrorClass(false)} />
        </FormField>
        <FormField id={`${idPrefix}-alt`} label="სურათის აღწერა (alt)" optional>
          <input id={`${idPrefix}-alt`} value={banner.alt} onChange={(e) => onChange({ ...banner, alt: e.target.value })} className={adminInputErrorClass(false)} />
        </FormField>
      </div>
      <div className="mt-4">
        <HomepageLinkFields
          idPrefix={idPrefix}
          value={link}
          categories={categories}
          brands={brands}
          onChange={(next) =>
            onChange({
              ...banner,
              linkType: next.linkType,
              href: next.href,
              categoryId: next.categoryId,
              categoryLabel: next.categoryLabel ?? "",
              productId: next.productId,
              productLabel: next.productLabel ?? "",
              brandId: next.brandId,
              brandLabel: next.brandLabel ?? "",
            })
          }
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex min-h-9 items-center gap-2 text-small">
          <input type="checkbox" checked={banner.openInNewTab} onChange={(e) => onChange({ ...banner, openInNewTab: e.target.checked })} />
          გაიხსნას ახალ ტაბში
        </label>
        <label className="flex min-h-9 items-center gap-2 text-small">
          <input type="checkbox" checked={banner.enabled} onChange={(e) => onChange({ ...banner, enabled: e.target.checked })} />
          აქტიური
        </label>
      </div>
    </section>
  );
}

export function SplitBannersEditor({
  sectionId,
  initialBanners,
  storageConfigured,
  categories,
  brands,
}: {
  sectionId: string;
  initialBanners: [BannerForm, BannerForm];
  storageConfigured: boolean;
  categories: { id: string; label: string }[];
  brands: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [banners, setBanners] = useState(initialBanners);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function save() {
    setMessage(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await saveHomepageSplitBanners({ sectionId, banners });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSuccess("ბანერები შენახულია");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-50 px-3 py-2 text-small text-danger-600">{message}</p> : null}
      {success ? <p role="status" className="rounded-[var(--radius-sm)] bg-success-50 px-3 py-2 text-small text-success-600">{success}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <BannerCard
          label="ბანერი A"
          banner={banners[0]}
          storageConfigured={storageConfigured}
          categories={categories}
          brands={brands}
          onChange={(next) => setBanners(([, b]) => [next, b])}
        />
        <BannerCard
          label="ბანერი B"
          banner={banners[1]}
          storageConfigured={storageConfigured}
          categories={categories}
          brands={brands}
          onChange={(next) => setBanners(([a]) => [a, next])}
        />
      </div>

      <div>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "ინახება..." : "შენახვა"}
        </Button>
      </div>
    </div>
  );
}
