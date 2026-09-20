import type { Metadata } from "next";
import { Search } from "lucide-react";
import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SearchPageClient } from "@/components/search/SearchPageClient";
import { sanitizeSearchQuery } from "@/lib/search";
import { loadStorefrontSearchPage } from "@/server/search";

export const dynamic = "force-dynamic";

type SearchPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function extractQuery(q: string | string[] | undefined): string {
  return sanitizeSearchQuery(Array.isArray(q) ? q[0] ?? "" : q ?? "");
}

const searchRobots = { index: false, follow: true } as const;

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const query = extractQuery((await searchParams).q);
  return {
    title: query ? `ძიების შედეგები: "${query}" — Luma` : "ძიება — Luma",
    robots: searchRobots,
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = extractQuery((await searchParams).q);

  if (!query) {
    return (
      <>
        <StorefrontHeader />
        <main className="flex-1">
          <div className="py-16 sm:py-24">
            <Container>
              <Breadcrumbs items={[{ label: "ძიება" }]} className="mb-6" />
              <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-10 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-surface-2">
                  <Search className="size-8 text-text-faint" strokeWidth={1.5} />
                </span>
                <h1 className="text-h2 text-text">მოძებნეთ სასურველი პროდუქტი</h1>
                <p className="text-body text-text-muted">
                  გამოიყენეთ ზედა საძიებო ველი პროდუქტის, ბრენდის ან კატეგორიის საპოვნელად.
                </p>
              </div>
            </Container>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const page = await loadStorefrontSearchPage(query);

  return (
    <>
      <StorefrontHeader />
      <main className="flex-1">
        <SearchPageClient
          key={page.query}
          query={page.query}
          products={page.products}
          browseCategories={page.browseCategories}
        />
      </main>
      <Footer />
    </>
  );
}
