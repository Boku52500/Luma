"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { organizeAdminCategories } from "@/server/actions/admin";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { Button } from "@/components/ui/Button";
import { adminCardClass } from "@/components/admin/adminUi";
import { MAIN_CATEGORY_TAXONOMY } from "@/lib/categoryMainTaxonomy";

export function CategoryOrganizeButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [report, setReport] = useState<string | null>(null);

  function confirm() {
    setMessage(null);
    setReport(null);
    startTransition(async () => {
      const result = await organizeAdminCategories();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setOpen(false);
      const unmatched = result.data.unmatched.length
        ? `\nვერ მოიძებნა: ${result.data.unmatched.join("; ")}`
        : "\nყველა ჩამოთვლილი ქვეკატეგორია მოიძებნა ან უკვე სწორ ადგილასაა.";
      setReport(
        `შეიქმნა ${result.data.mainsCreated} მთავარი · გამოყენებულია ${result.data.mainsReused} არსებული · გადატანილია ${result.data.moved} კატეგორია.${unmatched}`,
      );
      router.refresh();
    });
  }

  return (
    <section className={adminCardClass}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-body font-semibold text-text">კატეგორიების ავტომატურად დალაგება</h2>
          <p className="text-label text-text-faint">
            შექმნის {MAIN_CATEGORY_TAXONOMY.length} მთავარ კატეგორიას (თუ არ არსებობს), მიანიჭებს იკონებს და
            არსებულ ქვეკატეგორიებს გადაიტანს სწორ მშობელში. პროდუქტები და არსებული ID-ები უცვლელი რჩება.
          </p>
          {report ? <p className="text-small mt-2 whitespace-pre-line text-text">{report}</p> : null}
          {message ? <p className="text-small mt-2 text-danger-600">{message}</p> : null}
        </div>
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={pending}>
          კატეგორიების ავტომატურად დალაგება
        </Button>
      </div>
      <AdminConfirmDialog
        open={open}
        title="კატეგორიების ავტომატური დალაგება"
        description="შეიქმნება 12 მთავარი კატეგორია (მხოლოდ თუ არ არსებობს), მიენიჭება იკონები და არსებული ქვეკატეგორიები გადავა შესაბამის მთავარ კატეგორიებში. პროდუქტები, slug-ები და არსებული კატეგორიების ID-ები არ წაიშლება. ოპერაცია უსაფრთხოდ შეიძლება განმეორდეს."
        confirmLabel="დალაგების დაწყება"
        pending={pending}
        onClose={() => setOpen(false)}
        onConfirm={confirm}
      />
    </section>
  );
}
