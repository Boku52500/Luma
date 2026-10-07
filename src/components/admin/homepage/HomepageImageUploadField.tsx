"use client";

import { useRef, useState } from "react";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { adminInputErrorClass } from "@/components/admin/adminUi";
import { uploadAdminHomepageImage } from "@/server/actions/homepage";

export function HomepageImageUploadField({
  id,
  label,
  imageUrl,
  storageConfigured,
  aspectClassName = "aspect-[16/9]",
  onChange,
}: {
  id: string;
  label: string;
  imageUrl: string;
  storageConfigured: boolean;
  aspectClassName?: string;
  onChange: (next: { imageUrl: string; objectKey: string | null }) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setError(null);
    setPending(true);
    const formData = new FormData();
    formData.set("file", file);
    uploadAdminHomepageImage(formData)
      .then((result) => {
        if (!result.ok) {
          setError(result.message);
          return;
        }
        onChange({ imageUrl: result.data.url, objectKey: result.data.objectKey });
        if (fileRef.current) fileRef.current.value = "";
      })
      .finally(() => setPending(false));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className={`relative w-full overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface-2 ${aspectClassName}`}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" className="size-full object-contain" />
        ) : (
          <div className="flex size-full items-center justify-center text-small text-text-faint">სურათი არ არის</div>
        )}
      </div>
      {error ? <p role="alert" className="text-label text-danger-500">{error}</p> : null}
      {storageConfigured ? (
        <FormField id={id} label={label} optional>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} id={id} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className={adminInputErrorClass(false)} />
            <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={upload}>
              {pending ? "ატვირთვა..." : "ატვირთვა"}
            </Button>
            {imageUrl ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ imageUrl: "", objectKey: null })}>
                მოცილება
              </Button>
            ) : null}
          </div>
        </FormField>
      ) : (
        <FormField id={id} label={label} optional>
          <input
            id={id}
            value={imageUrl}
            placeholder="https://…"
            onChange={(e) => onChange({ imageUrl: e.target.value, objectKey: null })}
            className={adminInputErrorClass(false)}
          />
        </FormField>
      )}
    </div>
  );
}
