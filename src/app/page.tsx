import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { HomepageSections } from "@/components/home/HomepageSections";
import { ensureHomepageInitialized } from "@/server/homepage/init";
import { getHomepagePageData } from "@/server/homepage/storefront";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAppOriginString } from "@/lib/appUrl";

/** Catalogue sections are safe to revalidate; session/cart stay client-driven. */
export const revalidate = 60;

export default async function Home() {
  const origin = getAppOriginString();
  let sections: Awaited<ReturnType<typeof getHomepagePageData>> = [];
  try {
    await ensureHomepageInitialized();
    sections = await getHomepagePageData();
  } catch {
    // Pre-migration / temporary DB issues — render header/footer without sections.
    sections = [];
  }

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Luma",
          url: origin,
          email: "info@luma.ge",
          telephone: "+995322000000",
          logo: `${origin}/Logo.png`,
        }}
      />
      <StorefrontHeader />

      <main className="flex-1">
        <HomepageSections sections={sections} />
      </main>

      <Footer />
    </>
  );
}
