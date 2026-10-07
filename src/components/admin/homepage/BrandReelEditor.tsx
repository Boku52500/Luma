"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { adminCardClass, adminInputErrorClass, adminSelectClass } from "@/components/admin/adminUi";
import { saveHomepageBrandReel, saveHomepageSectionMeta } from "@/server/actions/homepage";

export function BrandReelEditor({
  sectionId,
  initialTitle,
  initialBrandIds,
  allBrands,
}: {
  sectionId: string;
  initialTitle: string;
  initialBrandIds: string[];
  allBrands: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [brandIds, setBrandIds] = useState(initialBrandIds);
  const [addId, setAddId] = useState("");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const byId = new Map(allBrands.map((brand) => [brand.id, brand.label]));
  const available = allBrands.filter((brand) => !brandIds.includes(brand.id));

  function add() {
    if (!addId) return;
    setBrandIds((current) => [...current, addId]);
    setAddId("");
  }

  function remove(id: string) {
    setBrandIds((current) => current.filter((row) => row !== id));
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= brandIds.length) return;
    setBrandIds((current) => {
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
      const metaResult = await saveHomepageSectionMeta({ id: sectionId, title });
      if (!metaResult.ok) {
        setMessage(metaResult.message);
        return;
      }
      const result = await saveHomepageBrandReel({ sectionId, brandIds });
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setSuccess("ბრენდების ზოლი შენახულია");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-50 px-3 py-2 text-small text-danger-600">{message}</p> : null}
      {success ? <p role="status" className="rounded-[var(--radius-sm)] bg-success-50 px-3 py-2 text-small text-success-600">{success}</p> : null}

      <section className={adminCardClass}>
        <h2 className="mb-4 text-base font-semibold text-text">ბრენდები (რიგის მიხედვით)</h2>
        <FormField id="brand-reel-title" label="სათაური" className="mb-4 max-w-sm">
          <input id="brand-reel-title" value={title} onChange={(e) => setTitle(e.target.value)} className={adminInputErrorClass(false)} />
        </FormField>
        <div className="flex flex-col gap-2">
          {brandIds.length === 0 ? <p className="text-small text-text-muted">ბრენდი ჯერ არ არის დამატებული.</p> : null}
          {brandIds.map((id, index) => (
            <div key={id} className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-border px-3 py-2">
              <span className="flex-1 text-small text-text">{byId.get(id) ?? id}</span>
              <Button type="button" variant="secondary" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                <ArrowUp className="size-4" />
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={index === brandIds.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown className="size-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(id)}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <FormField id="brand-add" label="ბრენდის დამატება" className="min-w-[14rem]">
            <select id="brand-add" value={addId} onChange={(e) => setAddId(e.target.value)} className={adminSelectClass}>
              <option value="">— აირჩიეთ —</option>
              {available.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.label}
                </option>
              ))}
            </select>
          </FormField>
          <Button type="button" variant="secondary" disabled={!addId} onClick={add}>
            დამატება
          </Button>
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
