import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { isExternalMerchHref } from "@/lib/merchHref";
import type { HomepageBannerDTO } from "@/server/homepage/storefront";

function BannerTile({ banner }: { banner: HomepageBannerDTO }) {
  const content = (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface-2 sm:aspect-[16/11]">
      <Image src={banner.imageUrl} alt={banner.alt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
      {banner.title || banner.subtitle || banner.ctaText ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/70 via-ink-950/10 to-transparent p-4 sm:p-6">
          {banner.title ? <p className="text-h3 font-bold text-white">{banner.title}</p> : null}
          {banner.subtitle ? <p className="text-small mt-1 text-white/85">{banner.subtitle}</p> : null}
          {banner.ctaText ? (
            <span className="text-btn mt-3 inline-flex items-center rounded-[var(--radius-sm)] bg-white px-4 py-2 text-ink-900">
              {banner.ctaText}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (!banner.href) return content;
  if (isExternalMerchHref(banner.href) || banner.openInNewTab) {
    return (
      <a href={banner.href} target="_blank" rel="noopener noreferrer" className="block">
        {content}
      </a>
    );
  }
  return (
    <Link href={banner.href} className="block">
      {content}
    </Link>
  );
}

export function SplitBanners({ banners }: { banners: HomepageBannerDTO[] }) {
  if (banners.length === 0) return null;

  return (
    <section className="py-8 sm:py-12">
      <Container>
        <div className="grid gap-4 sm:grid-cols-2">
          {banners.map((banner) => (
            <BannerTile key={banner.id} banner={banner} />
          ))}
        </div>
      </Container>
    </section>
  );
}
