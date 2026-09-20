import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { BrandPageClient } from "@/components/brand/BrandPageClient";
import { loadStorefrontBrandPage } from "@/server/catalog/brandPage";
import { noIndexRobots, pageCanonical } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadStorefrontBrandPage(slug);
  if (!page) notFound();

  return {
    title: page.brand.seoTitle ?? `${page.brand.name} — Luma`,
    description: page.brand.seoDescription ?? page.brand.description ?? undefined,
    robots: page.brand.indexable ? undefined : noIndexRobots,
    ...pageCanonical(`/brand/${slug}`, page.brand.canonicalOverride),
  };
}

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await loadStorefrontBrandPage(slug);
  if (!page) notFound();

  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <BrandPageClient brand={page.brand} products={page.products} />
      </main>
      <Footer />
    </>
  );
}
