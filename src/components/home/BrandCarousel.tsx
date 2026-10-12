"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import type { HomepageBrandSlide } from "@/server/catalog/homepage";

export function BrandCarousel({ brands }: { brands: HomepageBrandSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = useCallback((direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * Math.min(320, track.clientWidth * 0.7), behavior: "smooth" });
  }, []);

  if (brands.length === 0) return null;

  return (
    <section className="border-y border-border bg-surface py-5 sm:py-6">
      <Container>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-label font-semibold text-brand-800">ბრენდები</p>
            <h2 className="text-h3 mt-0.5 text-text">ოფიციალური ბრენდები</h2>
          </div>
          {brands.length > 4 ? (
            <div className="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                aria-label="წინა ბრენდები"
                onClick={() => scrollBy(-1)}
                className="flex size-9 items-center justify-center rounded-full border border-border text-ink-700 hover:bg-surface-2"
              >
                <ChevronLeft className="size-4" strokeWidth={2.25} />
              </button>
              <button
                type="button"
                aria-label="შემდეგი ბრენდები"
                onClick={() => scrollBy(1)}
                className="flex size-9 items-center justify-center rounded-full border border-border text-ink-700 hover:bg-surface-2"
              >
                <ChevronRight className="size-4" strokeWidth={2.25} />
              </button>
            </div>
          ) : null}
        </div>

        <div
          ref={trackRef}
          className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth pb-1 sm:gap-4"
        >
          {brands.map((brand) => (
            <Link
              key={brand.id}
              href={brand.href}
              className="group flex h-20 w-[7.5rem] shrink-0 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-border bg-surface-2/50 px-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-surface hover:shadow-sm sm:h-[5.5rem] sm:w-36"
            >
              {brand.logoUrl ? (
                <span className="relative h-8 w-full sm:h-9">
                  <Image
                    src={brand.logoUrl}
                    alt={brand.name}
                    fill
                    sizes="144px"
                    className="object-contain"
                  />
                </span>
              ) : (
                <span className="text-small line-clamp-2 text-center font-semibold text-brand-700">{brand.name}</span>
              )}
              {brand.logoUrl ? (
                <span className="text-label line-clamp-1 text-center text-text-muted group-hover:text-brand-900">
                  {brand.name}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
