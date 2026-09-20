import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { CategoryPageClient } from "@/components/category/CategoryPageClient";
import { loadStorefrontCategoryPage } from "@/server/catalog";
import { loadCategorySeoMetadata } from "@/server/catalog/metadata";
import { resolveCategorySlugRedirect } from "@/server/catalog/categorySlugRedirect";
import { noIndexRobots, pageCanonical } from "@/lib/seo";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const redirectTo = await resolveCategorySlugRedirect(slug);
  if (redirectTo && redirectTo !== slug) {
    permanentRedirect(`/category/${redirectTo}`);
  }
  const meta = await loadCategorySeoMetadata(slug);
  if (!meta) notFound();

  return {
    title: meta.seoTitle ?? `${meta.name} — Luma`,
    description: meta.seoDescription ?? meta.description,
    robots: meta.indexable ? undefined : noIndexRobots,
    ...pageCanonical(`/category/${slug}`, meta.canonicalOverride),
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const redirectTo = await resolveCategorySlugRedirect(slug);
  if (redirectTo && redirectTo !== slug) {
    permanentRedirect(`/category/${redirectTo}`);
  }

  const page = await loadStorefrontCategoryPage(slug);
  if (!page) notFound();

  return <CategoryPageClient category={page.category} products={page.products} />;
}
