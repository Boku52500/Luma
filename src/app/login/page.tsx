import type { Metadata } from "next";
import { Suspense } from "react";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { LoginPageClient } from "@/components/auth/LoginPageClient";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "შესვლა — Luma",
  description: "შედით თქვენს Luma ანგარიშში.",
  ...noIndexMetadata,
};

export default function LoginPage() {
  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <Suspense fallback={null}>
          <LoginPageClient />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
