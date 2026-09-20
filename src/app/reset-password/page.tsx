import type { Metadata } from "next";
import { Suspense } from "react";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { ResetPasswordPageClient } from "@/components/auth/ResetPasswordPageClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "ახალი პაროლი — Luma",
  description: "დააყენეთ ახალი პაროლი Luma ანგარიშისთვის.",
  ...noIndexMetadata,
};

export default function ResetPasswordPage() {
  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <Suspense>
          <ResetPasswordPageClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
