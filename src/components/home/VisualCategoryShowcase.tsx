import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import type { HomepageVisualTileDTO } from "@/server/homepage/storefront";

const AREA_BY_SLOT: Record<string, string> = {
  largeA: "largeA",
  wide: "wide",
  smallC: "smallC",
  smallD: "smallD",
  largeB: "largeB",
};

function Tile({ tile }: { tile: HomepageVisualTileDTO }) {
  const content = (
    <div className="relative h-full min-h-40 w-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface-2">
      <Image src={tile.imageUrl} alt={tile.title ?? ""} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" />
      {tile.title || tile.subtitle ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/70 via-ink-950/10 to-transparent p-4">
          {tile.title ? <p className="text-body font-bold text-white sm:text-h3">{tile.title}</p> : null}
          {tile.subtitle ? <p className="text-label mt-0.5 text-white/85">{tile.subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  );

  const area = AREA_BY_SLOT[tile.slot];
  const wrapped = tile.href ? (
    <Link href={tile.href} className="block h-full">
      {content}
    </Link>
  ) : (
    content
  );

  return (
    <div className="h-56 sm:h-auto" style={area ? { gridArea: area } : undefined}>
      {wrapped}
    </div>
  );
}

export function VisualCategoryShowcase({ title, tiles }: { title: string | null; tiles: HomepageVisualTileDTO[] }) {
  if (tiles.length === 0) return null;

  return (
    <section className="py-8 sm:py-12">
      <Container>
        {title ? (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-h2 text-text">{title}</h2>
          </div>
        ) : null}
        <div
          className="flex flex-col gap-4 sm:grid sm:grid-cols-5 sm:grid-rows-2"
          style={{ gridTemplateAreas: `"largeA largeA wide wide largeB" "largeA largeA smallC smallD largeB"` }}
        >
          {tiles.map((tile) => (
            <Tile key={tile.id} tile={tile} />
          ))}
        </div>
      </Container>
    </section>
  );
}
