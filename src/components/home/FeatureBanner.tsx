import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { isExternalMerchHref } from "@/lib/merchHref";
import type { HomepageBannerDTO } from "@/server/homepage/storefront";

export function FeatureBanner({ banner }: { banner: HomepageBannerDTO }) {
  const content = (
    <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface-2 sm:aspect-[21/9]">
      <Image src={banner.imageUrl} alt={banner.alt} fill sizes="100vw" className="object-cover" />
      {banner.title || banner.subtitle || banner.ctaText ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/70 via-ink-950/10 to-transparent p-5 sm:p-8">
          {banner.title ? <p className="text-h2 font-bold text-white">{banner.title}</p> : null}
          {banner.subtitle ? <p className="text-body mt-1.5 max-w-xl text-white/85">{banner.subtitle}</p> : null}
          {banner.ctaText ? (
            <span className="text-btn mt-4 inline-flex items-center rounded-[var(--radius-sm)] bg-white px-5 py-2.5 text-ink-900">
              {banner.ctaText}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="py-8 sm:py-12">
      <Container>
        {banner.href ? (
          isExternalMerchHref(banner.href) || banner.openInNewTab ? (
            <a href={banner.href} target="_blank" rel="noopener noreferrer" className="block">
              {content}
            </a>
          ) : (
            <Link href={banner.href} className="block">
              {content}
            </Link>
          )
        ) : (
          content
        )}
      </Container>
    </section>
  );
}
