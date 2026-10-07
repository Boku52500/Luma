"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { adminCardClass, adminInputErrorClass } from "@/components/admin/adminUi";
import { HomepageImageUploadField } from "@/components/admin/homepage/HomepageImageUploadField";
import { HomepageLinkFields, type HomepageLinkValue } from "@/components/admin/homepage/HomepageLinkFields";
import { saveHomepageVisualTiles } from "@/server/actions/homepage";
import type { AdminHomepageTileRow } from "@/server/homepage/admin";
import type { HomepageVisualTileSlot } from "@/lib/homepage/types";

const SLOT_LABELS: Record<HomepageVisualTileSlot, string> = {
  largeA: "დიდი ფილა A",
  wide: "განიერი ფილა",
  smallC: "პატარა ფილა C",
  smallD: "პატარა ფილა D",
  largeB: "დიდი ფილა B",
};

export function VisualTilesEditor({
  sectionId,
  initialTiles,
  storageConfigured,
  categories,
}: {
  sectionId: string;
  initialTiles: AdminHomepageTileRow[];
  storageConfigured: boolean;
  categories: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [tiles, setTiles] = useState(initialTiles);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function updateTile(slot: HomepageVisualTileSlot, patch: Partial<AdminHomepageTileRow>) {
    setTiles((current) => current.map((tile) => (tile.slot === slot ? { ...tile, ...patch } : tile)));
  }

  function save() {
    setMessage(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await saveHomepageVisualTiles({
        sectionId,
        tiles: tiles.map((tile) => ({
          slot: tile.slot,
          imageUrl: tile.imageUrl || null,
          objectKey: tile.objectKey,
          mobileImageUrl: tile.mobileImageUrl || null,
          mobileObjectKey: tile.mobileObjectKey,
          title: tile.title || null,
          subtitle: tile.subtitle || null,
          linkType: tile.linkType,
          href: tile.href || null,
          categoryId: tile.categoryId || null,
          enabled: tile.enabled,
        })),
      });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSuccess("ფილები შენახულია");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-50 px-3 py-2 text-small text-danger-600">{message}</p> : null}
      {success ? <p role="status" className="rounded-[var(--radius-sm)] bg-success-50 px-3 py-2 text-small text-success-600">{success}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {tiles.map((tile) => {
          const idPrefix = `tile-${tile.slot}`;
          const link: HomepageLinkValue = {
            linkType: tile.linkType,
            href: tile.href,
            categoryId: tile.categoryId,
            categoryLabel: tile.categoryLabel,
            productId: "",
            brandId: "",
          };
          return (
            <section key={tile.slot} className={adminCardClass}>
              <h2 className="mb-4 text-base font-semibold text-text">{SLOT_LABELS[tile.slot]}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <HomepageImageUploadField
                  id={`${idPrefix}-image`}
                  label="სურათის ატვირთვა"
                  imageUrl={tile.imageUrl}
                  storageConfigured={storageConfigured}
                  aspectClassName="aspect-square"
                  onChange={({ imageUrl, objectKey }) => updateTile(tile.slot, { imageUrl, objectKey })}
                />
                <HomepageImageUploadField
                  id={`${idPrefix}-mobile-image`}
                  label="მობილურის სურათი (არასავალდებულო)"
                  imageUrl={tile.mobileImageUrl}
                  storageConfigured={storageConfigured}
                  aspectClassName="aspect-square"
                  onChange={({ imageUrl, objectKey }) => updateTile(tile.slot, { mobileImageUrl: imageUrl, mobileObjectKey: objectKey })}
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FormField id={`${idPrefix}-title`} label="სათაური" optional>
                  <input id={`${idPrefix}-title`} value={tile.title} onChange={(e) => updateTile(tile.slot, { title: e.target.value })} className={adminInputErrorClass(false)} />
                </FormField>
                <FormField id={`${idPrefix}-subtitle`} label="ქვესათაური" optional>
                  <input id={`${idPrefix}-subtitle`} value={tile.subtitle} onChange={(e) => updateTile(tile.slot, { subtitle: e.target.value })} className={adminInputErrorClass(false)} />
                </FormField>
              </div>
              <div className="mt-4">
                <HomepageLinkFields
                  idPrefix={idPrefix}
                  value={link}
                  categories={categories}
                  brands={[]}
                  allowedTypes={["NONE", "CATEGORY", "CUSTOM"]}
                  onChange={(next) =>
                    updateTile(tile.slot, {
                      linkType: next.linkType,
                      href: next.href,
                      categoryId: next.categoryId,
                      categoryLabel: next.categoryLabel ?? "",
                    })
                  }
                />
              </div>
              <label className="mt-3 flex min-h-9 items-center gap-2 text-small">
                <input type="checkbox" checked={tile.enabled} onChange={(e) => updateTile(tile.slot, { enabled: e.target.checked })} />
                აქტიური
              </label>
            </section>
          );
        })}
      </div>

      <div>
        <Button type="button" onClick={save} disabled={pending}>
          {pending ? "ინახება..." : "შენახვა"}
        </Button>
      </div>
    </div>
  );
}
