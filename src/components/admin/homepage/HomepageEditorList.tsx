"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ArrowDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { adminCardClass } from "@/components/admin/adminUi";
import { moveHomepageSection, setHomepageSectionEnabled } from "@/server/actions/homepage";
import type { AdminHomepageSectionRow } from "@/server/homepage/admin";

export function HomepageEditorList({ initialSections }: { initialSections: AdminHomepageSectionRow[] }) {
  const router = useRouter();
  const [sections, setSections] = useState(initialSections);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function move(id: string, direction: "up" | "down") {
    setMessage(null);
    const index = sections.findIndex((row) => row.id === id);
    const swap = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swap < 0 || swap >= sections.length) return;
    const next = [...sections];
    const tmp = next[index]!;
    next[index] = next[swap]!;
    next[swap] = tmp;
    setSections(next);
    startTransition(async () => {
      const result = await moveHomepageSection({ id, direction });
      if (!result.ok) {
        setMessage(result.message);
        router.refresh();
        return;
      }
      router.refresh();
    });
  }

  function toggleEnabled(id: string, enabled: boolean) {
    setMessage(null);
    setSections((current) => current.map((row) => (row.id === id ? { ...row, enabled } : row)));
    startTransition(async () => {
      const result = await setHomepageSectionEnabled({ id, enabled });
      if (!result.ok) {
        setMessage(result.message);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? (
        <p role="alert" className="rounded-[var(--radius-sm)] bg-danger-50 px-3 py-2 text-small text-danger-600">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {sections.map((section, index) => (
          <article key={section.id} className={`${adminCardClass} flex flex-col gap-3 sm:flex-row sm:items-center`}>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-small font-bold text-brand-700">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-small font-semibold text-text">
                {section.title || section.adminLabel}
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-label font-medium text-text-muted">
                  {section.typeLabel}
                </span>
                {!section.enabled ? (
                  <span className="rounded-full bg-warning-50 px-2 py-0.5 text-label font-medium text-warning-600">
                    გამორთული
                  </span>
                ) : null}
              </p>
              <p className="text-label mt-1 text-text-muted">{section.summary}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex min-h-9 items-center gap-2 text-small">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  disabled={pending}
                  onChange={(e) => toggleEnabled(section.id, e.target.checked)}
                />
                აქტიური
              </label>
              <Button type="button" variant="secondary" size="sm" disabled={pending || index === 0} onClick={() => move(section.id, "up")}>
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending || index === sections.length - 1}
                onClick={() => move(section.id, "down")}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button href={`/admin/homepage/${section.id}`} variant="secondary" size="sm">
                <Pencil className="size-4" />
                რედაქტირება
              </Button>
            </div>
          </article>
        ))}
      </div>

      <p className="text-label text-text-faint">
        გამორთული სექცია ვიტრინაზე არ გამოჩნდება. ცარიელი (სურათების/პროდუქტების გარეშე) სექცია ავტომატურად გამოტოვებულია.
      </p>
      <Link href="/" target="_blank" className="text-btn text-brand-600 hover:text-brand-700">
        მთავარი გვერდის ნახვა →
      </Link>
    </div>
  );
}
