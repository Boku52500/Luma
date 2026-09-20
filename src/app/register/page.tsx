import type { Metadata } from "next";
import { Suspense } from "react";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { RegisterPageClient } from "@/components/auth/RegisterPageClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "რეგისტრაცია — Luma",
  description: "შექმენით ახალი Luma ანგარიში.",
  ...noIndexMetadata,
};

export default function RegisterPage() {
  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <Suspense fallback={null}>
          <RegisterPageClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
