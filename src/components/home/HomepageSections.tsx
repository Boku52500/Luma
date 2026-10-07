import { Hero } from "@/components/home/Hero";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import { ProductSection } from "@/components/product/ProductSection";
import { SplitBanners } from "@/components/home/SplitBanners";
import { FeatureBanner } from "@/components/home/FeatureBanner";
import { VisualCategoryShowcase } from "@/components/home/VisualCategoryShowcase";
import type { HomepageSectionDTO } from "@/server/homepage/storefront";

/** Renders the admin-ordered homepage sections. Each DTO already excludes empty/disabled content. */
export function HomepageSections({ sections }: { sections: HomepageSectionDTO[] }) {
  return (
    <>
      {sections.map((section) => {
        switch (section.type) {
          case "HERO":
            return <Hero key={section.id} slides={section.slides} />;
          case "SPLIT_BANNERS":
            return <SplitBanners key={section.id} banners={section.banners} />;
          case "BRAND_REEL":
            return <BrandCarousel key={section.id} brands={section.brands} />;
          case "CATEGORY_PRODUCT_REEL":
            return (
              <ProductSection
                key={section.id}
                title={section.title ?? ""}
                href={section.href ?? undefined}
                products={section.products}
              />
            );
          case "FEATURE_BANNER":
            return <FeatureBanner key={section.id} banner={section.banner} />;
          case "VISUAL_CATEGORIES":
            return <VisualCategoryShowcase key={section.id} title={section.title} tiles={section.tiles} />;
          default:
            return null;
        }
      })}
    </>
  );
}
