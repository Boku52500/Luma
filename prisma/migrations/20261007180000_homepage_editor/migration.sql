-- AlterTable
ALTER TABLE "HeroSlide" ADD COLUMN "mobileImageUrl" TEXT,
ADD COLUMN "mobileObjectKey" TEXT,
ADD COLUMN "title" TEXT,
ADD COLUMN "subtitle" TEXT,
ADD COLUMN "ctaText" TEXT,
ADD COLUMN "openInNewTab" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "HeroSlide_mobileObjectKey_key" ON "HeroSlide"("mobileObjectKey");

-- CreateEnum
CREATE TYPE "HomepageSectionType" AS ENUM (
  'HERO',
  'SPLIT_BANNERS',
  'BRAND_REEL',
  'CATEGORY_PRODUCT_REEL',
  'FEATURE_BANNER',
  'VISUAL_CATEGORIES'
);

-- CreateEnum
CREATE TYPE "HomepageLinkType" AS ENUM (
  'NONE',
  'CATEGORY',
  'PRODUCT',
  'BRAND',
  'CUSTOM'
);

-- CreateTable
CREATE TABLE "HomepageSection" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" "HomepageSectionType" NOT NULL,
    "position" INTEGER NOT NULL,
    "adminLabel" TEXT NOT NULL,
    "title" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageSection_key_key" ON "HomepageSection"("key");

-- CreateIndex
CREATE INDEX "HomepageSection_enabled_position_idx" ON "HomepageSection"("enabled", "position");

-- CreateIndex
CREATE INDEX "HomepageSection_position_idx" ON "HomepageSection"("position");

-- CreateTable
CREATE TABLE "HomepageBanner" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "slot" TEXT,
    "imageUrl" TEXT,
    "objectKey" TEXT,
    "mobileImageUrl" TEXT,
    "mobileObjectKey" TEXT,
    "alt" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "ctaText" TEXT,
    "linkType" "HomepageLinkType" NOT NULL DEFAULT 'NONE',
    "href" TEXT,
    "categoryId" TEXT,
    "productId" TEXT,
    "brandId" TEXT,
    "openInNewTab" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomepageBanner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageBanner_objectKey_key" ON "HomepageBanner"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "HomepageBanner_mobileObjectKey_key" ON "HomepageBanner"("mobileObjectKey");

-- CreateIndex
CREATE INDEX "HomepageBanner_sectionId_sortOrder_idx" ON "HomepageBanner"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomepageBanner_categoryId_idx" ON "HomepageBanner"("categoryId");

-- CreateIndex
CREATE INDEX "HomepageBanner_productId_idx" ON "HomepageBanner"("productId");

-- CreateIndex
CREATE INDEX "HomepageBanner_brandId_idx" ON "HomepageBanner"("brandId");

-- CreateTable
CREATE TABLE "HomepageBrandItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomepageBrandItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageBrandItem_sectionId_brandId_key" ON "HomepageBrandItem"("sectionId", "brandId");

-- CreateIndex
CREATE INDEX "HomepageBrandItem_sectionId_sortOrder_idx" ON "HomepageBrandItem"("sectionId", "sortOrder");

-- CreateTable
CREATE TABLE "HomepageProductItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomepageProductItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageProductItem_sectionId_productId_key" ON "HomepageProductItem"("sectionId", "productId");

-- CreateIndex
CREATE INDEX "HomepageProductItem_sectionId_sortOrder_idx" ON "HomepageProductItem"("sectionId", "sortOrder");

-- CreateTable
CREATE TABLE "HomepageVisualTile" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "imageUrl" TEXT,
    "objectKey" TEXT,
    "mobileImageUrl" TEXT,
    "mobileObjectKey" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "linkType" "HomepageLinkType" NOT NULL DEFAULT 'CATEGORY',
    "href" TEXT,
    "categoryId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HomepageVisualTile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HomepageVisualTile_objectKey_key" ON "HomepageVisualTile"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "HomepageVisualTile_mobileObjectKey_key" ON "HomepageVisualTile"("mobileObjectKey");

-- CreateIndex
CREATE UNIQUE INDEX "HomepageVisualTile_sectionId_slot_key" ON "HomepageVisualTile"("sectionId", "slot");

-- CreateIndex
CREATE INDEX "HomepageVisualTile_sectionId_sortOrder_idx" ON "HomepageVisualTile"("sectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "HomepageVisualTile_categoryId_idx" ON "HomepageVisualTile"("categoryId");

-- AddForeignKey
ALTER TABLE "HomepageBanner" ADD CONSTRAINT "HomepageBanner_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageBanner" ADD CONSTRAINT "HomepageBanner_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageBanner" ADD CONSTRAINT "HomepageBanner_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageBanner" ADD CONSTRAINT "HomepageBanner_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageBrandItem" ADD CONSTRAINT "HomepageBrandItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageBrandItem" ADD CONSTRAINT "HomepageBrandItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageProductItem" ADD CONSTRAINT "HomepageProductItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageProductItem" ADD CONSTRAINT "HomepageProductItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageVisualTile" ADD CONSTRAINT "HomepageVisualTile_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "HomepageSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomepageVisualTile" ADD CONSTRAINT "HomepageVisualTile_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
