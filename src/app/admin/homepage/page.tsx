import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/admin";
import { ensureHomepageInitialized } from "@/server/homepage/init";
import { listAdminHomepageSections } from "@/server/homepage/admin";
import { HomepageEditorList } from "@/components/admin/homepage/HomepageEditorList";

export const metadata: Metadata = { title: "მთავარი გვერდი" };

export default async function AdminHomepagePage() {
  await requireAdmin("/admin/homepage");
  await ensureHomepageInitialized();
  const sections = await listAdminHomepageSections();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">მთავარი გვერდის რედაქტორი</h1>
        <p className="text-small mt-1 text-text-muted">
          მართეთ მთავარი გვერდის სექციების თანმიმდევრობა, აქტიურობა და შინაარსი — ჰერო ბანერი, პროდუქტების ზოლები, ბრენდები და ბანერები.
        </p>
      </div>
      <HomepageEditorList initialSections={sections} />
    </div>
  );
}
