import { StorefrontHeader } from "@/components/layout/StorefrontHeader";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import { CategoryShortcuts } from "@/components/home/CategoryShortcuts";
import { PromoBanner } from "@/components/home/PromoBanner";
import { ProductSection } from "@/components/product/ProductSection";
import {
  getHomepageFeaturedProducts,
  getHomepageNewArrivals,
} from "@/server/catalog";
import { getStorefrontHeroSlides } from "@/server/catalog/hero";
import { getHomepageBrandSlides, getHomepageCategoryCards } from "@/server/catalog/homepage";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAppOriginString } from "@/lib/appUrl";

/** Catalogue sections are safe to revalidate; session/cart stay client-driven. */
export const revalidate = 60;

export default async function Home() {
  const [featuredProducts, newArrivals, heroSlides, brandSlides, categoryCards] = await Promise.all([
    getHomepageFeaturedProducts(),
    getHomepageNewArrivals(),
    getStorefrontHeroSlides(),
    getHomepageBrandSlides(),
    getHomepageCategoryCards(),
  ]);
  const origin = getAppOriginString();

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
        <Hero slides={heroSlides} />
        <BrandCarousel brands={brandSlides} />
        <CategoryShortcuts categories={categoryCards} />

        <ProductSection
          eyebrow="შერჩეული ჩვენს მიერ"
          title="რჩეული პროდუქტები"
          description="ყველაზე მოთხოვნადი მოდელები საუკეთესო ფასად"
          href="/category/deals"
          products={featuredProducts}
        />

        <PromoBanner />

        <ProductSection
          eyebrow="ახალი კოლექცია"
          title="ახალი შემოსული"
          description="უახლესი მოდელები, რომლებიც ახლახან შემოვიდა მაღაზიაში"
          href="/category/new"
          products={newArrivals}
        />
      </main>

      <Footer />
    </>
  );
}
