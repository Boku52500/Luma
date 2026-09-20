import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoPageShell } from "@/components/info/InfoPageShell";
import { getInfoPage, INFO_PAGE_SLUGS } from "@/lib/infoPages";
import { noIndexRobots, pageCanonical } from "@/lib/seo";

export function generateStaticParams() {
  return INFO_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getInfoPage(slug);
  if (!page) notFound();
  return {
    title: `${page.title} — Luma`,
    description: page.description,
    robots: page.needsAdminReview ? noIndexRobots : undefined,
    ...pageCanonical(`/${page.slug}`),
  };
}

export default async function InfoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getInfoPage(slug);
  if (!page) notFound();
  return <InfoPageShell page={page} />;
}
