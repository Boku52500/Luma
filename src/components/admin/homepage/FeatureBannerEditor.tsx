"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { adminCardClass, adminInputErrorClass } from "@/components/admin/adminUi";
import { HomepageImageUploadField } from "@/components/admin/homepage/HomepageImageUploadField";
import { HomepageLinkFields, type HomepageLinkValue } from "@/components/admin/homepage/HomepageLinkFields";
import { saveHomepageFeatureBanner } from "@/server/actions/homepage";
import type { AdminHomepageBannerRow } from "@/server/homepage/admin";

export function FeatureBannerEditor({
  sectionId,
  initialBanner,
  storageConfigured,
  categories,
  brands,
}: {
  sectionId: string;
  initialBanner: AdminHomepageBannerRow;
  storageConfigured: boolean;
  categories: { id: string; label: string }[];
  brands: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [banner, setBanner] = useState(initialBanner);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const link: HomepageLinkValue = {
    linkType: banner.linkType,
    href: banner.href,
    categoryId: banner.categoryId,
    categoryLabel: banner.categoryLabel,
    productId: banner.productId,
    productLabel: banner.productLabel,
    brandId: banner.brandId,
    brandLabel: banner.brandLabel,
  };

  function save() {
    setMessage(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await saveHomepageFeatureBanner({ sectionId, banner });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSuccess("ბანერი შენახულია");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-50 px-3 py-2 text-small text-danger-600">{message}</p> : null}
      {success ? <p role="status" className="rounded-[var(--radius-sm)] bg-success-50 px-3 py-2 text-small text-success-600">{success}</p> : null}

      <section className={adminCardClass}>
        <h2 className="mb-4 text-base font-semibold text-text">ფართო ბანერი</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <HomepageImageUploadField
            id="feature-image"
            label="სურათის ატვირთვა"
            imageUrl={banner.imageUrl}
            storageConfigured={storageConfigured}
            aspectClassName="aspect-[21/9]"
            onChange={({ imageUrl, objectKey }) => setBanner((b) => ({ ...b, imageUrl, objectKey }))}
          />
          <HomepageImageUploadField
            id="feature-mobile-image"
            label="მობილურის სურათი (არასავალდებულო)"
            imageUrl={banner.mobileImageUrl}
            storageConfigured={storageConfigured}
            aspectClassName="aspect-[4/5]"
            onChange={({ imageUrl, objectKey }) => setBanner((b) => ({ ...b, mobileImageUrl: imageUrl, mobileObjectKey: objectKey }))}
          />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <FormField id="feature-title" label="სათაური" optional>
            <input id="feature-title" value={banner.title} onChange={(e) => setBanner((b) => ({ ...b, title: e.target.value }))} className={adminInputErrorClass(false)} />
          </FormField>
          <FormField id="feature-subtitle" label="ქვესათაური" optional>
            <input id="feature-subtitle" value={banner.subtitle} onChange={(e) => setBanner((b) => ({ ...b, subtitle: e.target.value }))} className={adminInputErrorClass(false)} />
          </FormField>
          <FormField id="feature-cta" label="ღილაკის ტექსტი" optional>
            <input id="feature-cta" value={banner.ctaText} onChange={(e) => setBanner((b) => ({ ...b, ctaText: e.target.value }))} className={adminInputErrorClass(false)} />
          </FormField>
          <FormField id="feature-alt" label="სურათის აღწერა (alt)" optional>
            <input id="feature-alt" value={banner.alt} onChange={(e) => setBanner((b) => ({ ...b, alt: e.target.value }))} className={adminInputErrorClass(false)} />
          </FormField>
        </div>
        <div className="mt-4">
          <HomepageLinkFields
            idPrefix="feature"
            value={link}
            categories={categories}
            brands={brands}
            onChange={(next) =>
              setBanner((b) => ({
                ...b,
                linkType: next.linkType,
                href: next.href,
                categoryId: next.categoryId,
                categoryLabel: next.categoryLabel ?? "",
                productId: next.productId,
                productLabel: next.productLabel ?? "",
                brandId: next.brandId,
                brandLabel: next.brandLabel ?? "",
              }))
            }
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex min-h-9 items-center gap-2 text-small">
            <input type="checkbox" checked={banner.openInNewTab} onChange={(e) => setBanner((b) => ({ ...b, openInNewTab: e.target.checked }))} />
            გაიხსნას ახალ ტაბში
          </label>
          <label className="flex min-h-9 items-center gap-2 text-small">
            <input type="checkbox" checked={banner.enabled} onChange={(e) => setBanner((b) => ({ ...b, enabled: e.target.checked }))} />
            აქტიური
          </label>
        </div>
      </section>

      <div>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "ინახება..." : "შენახვა"}
        </Button>
      </div>
    </div>
  );
}
