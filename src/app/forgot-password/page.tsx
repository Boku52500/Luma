import type { Metadata } from "next";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { ForgotPasswordPageClient } from "@/components/auth/ForgotPasswordPageClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "პაროლის აღდგენა — Luma",
  description: "აღადგინეთ თქვენი Luma ანგარიშის პაროლი.",
  ...noIndexMetadata,
};

export default function ForgotPasswordPage() {
  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <ForgotPasswordPageClient />
      </main>
      <Footer />
    </>
  );
}
