import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/server/auth/admin";
import { AdminShell } from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "ადმინი — Luma",
    template: "%s — Luma ადმინი",
  },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin("/admin");
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
