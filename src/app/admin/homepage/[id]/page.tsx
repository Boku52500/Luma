import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/server/auth/admin";
import { isStorageConfigured } from "@/server/storage";
import { listAdminHeroSlides } from "@/server/admin/hero";
import { HeroAdminManager } from "@/components/admin/HeroAdminManager";
import { SplitBannersEditor } from "@/components/admin/homepage/SplitBannersEditor";
import { FeatureBannerEditor } from "@/components/admin/homepage/FeatureBannerEditor";
import { BrandReelEditor } from "@/components/admin/homepage/BrandReelEditor";
import { CategoryReelEditor } from "@/components/admin/homepage/CategoryReelEditor";
import { VisualTilesEditor } from "@/components/admin/homepage/VisualTilesEditor";
import {
  getAdminBrandReelSection,
  getAdminCategoryReelSection,
  getAdminFeatureBannerSection,
  getAdminHomepageSectionMeta,
  getAdminSplitBannersSection,
  getAdminVisualTilesSection,
  getProductLabelsByIds,
  listHomepageBrandOptions,
  listHomepageCategoryOptions,
} from "@/server/homepage/admin";
import { HOMEPAGE_SECTION_TYPE_LABELS } from "@/lib/homepage/types";

export const metadata: Metadata = { title: "სექციის რედაქტირება" };

export default async function AdminHomepageSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`/admin/homepage/${id}`);

  const meta = await getAdminHomepageSectionMeta(id);
  if (!meta) notFound();

  const storageConfigured = isStorageConfigured();

  const header = (
    <div>
      <Link href="/admin/homepage" className="text-label mb-2 inline-flex items-center gap-1 text-text-muted hover:text-text">
        <ArrowLeft className="size-3.5" /> მთავარი გვერდის სექციები
      </Link>
      <h1 className="text-2xl font-extrabold tracking-tight text-text">{meta.adminLabel}</h1>
      <p className="text-small mt-1 text-text-muted">{HOMEPAGE_SECTION_TYPE_LABELS[meta.type]}</p>
    </div>
  );

  if (meta.type === "HERO") {
    const slides = await listAdminHeroSlides();
    return (
      <div className="flex flex-col gap-5">
        {header}
        <HeroAdminManager initialSlides={slides} storageConfigured={storageConfigured} />
      </div>
    );
  }

  if (meta.type === "SPLIT_BANNERS") {
    const [data, categories, brands] = await Promise.all([
      getAdminSplitBannersSection(id),
      listHomepageCategoryOptions(),
      listHomepageBrandOptions(),
    ]);
    if (!data) notFound();
    return (
      <div className="flex flex-col gap-5">
        {header}
        <SplitBannersEditor
          sectionId={id}
          initialBanners={data.banners}
          storageConfigured={storageConfigured}
          categories={categories.map((row) => ({ id: row.id, label: row.label }))}
          brands={brands.map((row) => ({ id: row.id, label: row.label }))}
        />
      </div>
    );
  }

  if (meta.type === "FEATURE_BANNER") {
    const [data, categories, brands] = await Promise.all([
      getAdminFeatureBannerSection(id),
      listHomepageCategoryOptions(),
      listHomepageBrandOptions(),
    ]);
    if (!data) notFound();
    return (
      <div className="flex flex-col gap-5">
        {header}
        <FeatureBannerEditor
          sectionId={id}
          initialBanner={data.banner}
          storageConfigured={storageConfigured}
          categories={categories.map((row) => ({ id: row.id, label: row.label }))}
          brands={brands.map((row) => ({ id: row.id, label: row.label }))}
        />
      </div>
    );
  }

  if (meta.type === "BRAND_REEL") {
    const [data, brands] = await Promise.all([getAdminBrandReelSection(id), listHomepageBrandOptions()]);
    if (!data) notFound();
    return (
      <div className="flex flex-col gap-5">
        {header}
        <BrandReelEditor
          sectionId={id}
          initialTitle={data.meta.title}
          initialBrandIds={data.brandIds}
          allBrands={brands.map((row) => ({ id: row.id, label: row.label }))}
        />
      </div>
    );
  }

  if (meta.type === "CATEGORY_PRODUCT_REEL") {
    const [data, categories] = await Promise.all([getAdminCategoryReelSection(id), listHomepageCategoryOptions()]);
    if (!data) notFound();
    const manualProducts = await getProductLabelsByIds(data.manualProductIds);
    const manualById = new Map(manualProducts.map((row) => [row.id, row.label]));
    return (
      <div className="flex flex-col gap-5">
        {header}
        <CategoryReelEditor
          sectionId={id}
          initialTitle={data.meta.title}
          initialCategoryId={data.config.categoryId ?? ""}
          initialProductSource={data.config.productSource}
          initialLimit={data.config.limit}
          initialViewAllHref={data.config.viewAllHref ?? ""}
          initialManualProducts={data.manualProductIds.map((pid) => ({ id: pid, label: manualById.get(pid) ?? pid }))}
          categories={categories.map((row) => ({ id: row.id, label: row.label }))}
        />
      </div>
    );
  }

  if (meta.type === "VISUAL_CATEGORIES") {
    const [data, categories] = await Promise.all([getAdminVisualTilesSection(id), listHomepageCategoryOptions()]);
    if (!data) notFound();
    return (
      <div className="flex flex-col gap-5">
        {header}
        <VisualTilesEditor
          sectionId={id}
          initialTiles={data.tiles}
          storageConfigured={storageConfigured}
          categories={categories.map((row) => ({ id: row.id, label: row.label }))}
        />
      </div>
    );
  }

  notFound();
}
