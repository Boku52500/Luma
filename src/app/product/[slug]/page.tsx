import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Package, ShieldCheck, Truck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductPrice } from "@/components/product/ProductPrice";
import { ProductDeliverySummary } from "@/components/product/ProductDeliverySummary";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { ProductKeyFeatures } from "@/components/product/ProductKeyFeatures";
import { ProductSpecs } from "@/components/product/ProductSpecs";
import { ProductRecommendations } from "@/components/product/ProductRecommendations";
import { JsonLd } from "@/components/seo/JsonLd";
import { getAppOriginString } from "@/lib/appUrl";
import { noIndexRobots, pageCanonical } from "@/lib/seo";
import { loadStorefrontProductCore } from "@/server/catalog/storefront";
import { loadProductSeoMetadata } from "@/server/catalog/metadata";
import {
  getDelivery,
  getDescription,
  getGalleryImages,
  getInstallmentOptions,
  getKeyFeatures,
  getSku,
  getSpecGroups,
  getVariantGroups,
  getWarranty,
  getWhatsIncluded,
} from "@/lib/productDetails";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = await loadProductSeoMetadata(slug);
  if (!meta) notFound();

  return {
    title: meta.seoTitle ?? `${meta.name} — Luma`,
    description: meta.seoDescription ?? meta.shortDescription ?? undefined,
    robots: meta.indexable ? undefined : noIndexRobots,
    ...pageCanonical(`/product/${slug}`, meta.canonicalOverride),
    openGraph: meta.ogImage
      ? {
          title: meta.seoTitle ?? meta.name,
          description: meta.seoDescription ?? meta.shortDescription ?? undefined,
          images: [{ url: meta.ogImage }],
        }
      : undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await loadStorefrontProductCore(slug);
  if (!page) notFound();

  const { product, categoryName, categoryHref } = page;
  const sku = getSku(product);
  const images = getGalleryImages(product);
  const installmentOptions = getInstallmentOptions(product);
  const warranty = getWarranty(product);
  const delivery = getDelivery(product);
  const whatsIncluded = getWhatsIncluded(product);
  const description = getDescription(product);
  const keyFeatures = getKeyFeatures(product);
  const specGroups = getSpecGroups(product);
  const variantGroups = getVariantGroups(product);
  const outOfStock = product.availability === "out-of-stock";
  const origin = getAppOriginString();
  const imageUrls = images.map((image) => image.src).filter((src): src is string => Boolean(src));
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku,
    url: `${origin}/product/${slug}`,
    ...(imageUrls.length > 0 ? { image: imageUrls } : {}),
    offers: {
      "@type": "Offer",
      url: `${origin}/product/${slug}`,
      priceCurrency: "GEL",
      price: String(product.price),
      availability: outOfStock ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "მთავარი", item: origin },
      { "@type": "ListItem", position: 2, name: categoryName, item: `${origin}${categoryHref}` },
      { "@type": "ListItem", position: 3, name: product.name, item: `${origin}/product/${slug}` },
    ],
  };

  const sections = [
    { id: "key-features", label: "ძირითადი მახასიათებლები", show: keyFeatures.length > 0 },
    { id: "specs", label: "ტექნიკური მახასიათებლები", show: specGroups.length > 0 },
    { id: "description", label: "აღწერა", show: true },
    { id: "whats-included", label: "კომპლექტაცია", show: whatsIncluded.length > 0 },
    { id: "warranty-delivery", label: "გარანტია და მიწოდება", show: true },
  ].filter((section) => section.show);

  return (
    <>
      <JsonLd data={[productJsonLd, breadcrumbJsonLd]} />
      <Container className="py-4">
        <Breadcrumbs items={[{ label: categoryName, href: categoryHref }, { label: product.name }]} />
      </Container>

      <Container>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <ProductGallery images={images} productName={product.name} outOfStock={outOfStock} />

          <div className="flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            <ProductInfo product={product} sku={sku} shortDescription={product.shortDescription} />

            <ProductPrice
              price={product.price}
              previousPrice={product.previousPrice}
              installmentOptions={installmentOptions}
              size="lg"
            />

            <ProductDeliverySummary warranty={warranty} delivery={delivery} />

            <ProductPurchasePanel product={product} variants={variantGroups} sentinelId="buy-box-sentinel" />

            <div id="buy-box-sentinel" />
          </div>
        </div>
      </Container>

      {sections.length ? (
        <Container className="mt-12 lg:mt-16">
          <nav
            aria-label="პროდუქტის სექციები"
            className="no-scrollbar -mx-4 flex gap-6 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
          >
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="-mb-px shrink-0 whitespace-nowrap border-b-2 border-transparent py-3 text-small font-medium text-text-muted transition-colors hover:border-border-strong hover:text-text"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </Container>
      ) : null}

      <Container className="flex flex-col gap-14 py-10 sm:py-14">
        {keyFeatures.length ? (
          <section id="key-features" className="scroll-mt-32">
            <h2 className="text-h3 mb-5 text-text">ძირითადი მახასიათებლები</h2>
            <ProductKeyFeatures features={keyFeatures} />
          </section>
        ) : null}

        {specGroups.length ? (
          <section id="specs" className="scroll-mt-32">
            <h2 className="text-h3 mb-5 text-text">ტექნიკური მახასიათებლები</h2>
            <ProductSpecs groups={specGroups} />
          </section>
        ) : null}

        <section id="description" className="scroll-mt-32">
          <h2 className="text-h3 mb-4 text-text">აღწერა</h2>
          <p className="text-body max-w-3xl whitespace-pre-line text-text-muted">{description}</p>
        </section>

        {whatsIncluded.length ? (
          <section id="whats-included" className="scroll-mt-32">
            <h2 className="text-h3 mb-5 text-text">კომპლექტაცია</h2>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {whatsIncluded.map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-small text-text">
                  <Package className="size-4 shrink-0 text-brand-600" strokeWidth={1.75} />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section id="warranty-delivery" className="scroll-mt-32">
          <h2 className="text-h3 mb-5 text-text">გარანტია და მიწოდება</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-5">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-600" strokeWidth={1.75} />
              <div>
                <p className="text-body font-semibold text-text">გარანტია</p>
                <p className="text-small mt-1 text-text-muted">{warranty}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-5">
              <Truck className="mt-0.5 size-5 shrink-0 text-brand-600" strokeWidth={1.75} />
              <div>
                <p className="text-body font-semibold text-text">მიწოდება</p>
                <p className="text-small mt-1 text-text-muted">{delivery.estimate}</p>
                <p className="text-small mt-1 text-text-muted">დაბრუნება — {delivery.returnDays} დღის განმავლობაში</p>
              </div>
            </div>
          </div>
        </section>
      </Container>

      <ProductRecommendations slug={slug} />
    </>
  );
}
