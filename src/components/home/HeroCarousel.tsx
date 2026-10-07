"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { closestSlideIndex, scrollLeftForSlide, wrapCarouselIndex } from "@/lib/heroCarousel";
import { isExternalMerchHref } from "@/lib/merchHref";
import { cn } from "@/lib/utils";
import type { StorefrontHeroSlide } from "@/server/catalog/hero";

const SCROLL_SYNC_MS = 80;
const PROGRAMMATIC_SCROLL_MS = 450;

export function HeroCarousel({ slides }: { slides: StorefrontHeroSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const programmaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);

  const goTo = useCallback(
    (index: number) => {
      const track = trackRef.current;
      const clamped = wrapCarouselIndex(index, slides.length);
      const slide = slideRefs.current[clamped];
      if (!track || !slide) return;

      programmaticScrollRef.current = true;
      if (programmaticTimerRef.current) window.clearTimeout(programmaticTimerRef.current);
      programmaticTimerRef.current = window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, PROGRAMMATIC_SCROLL_MS);

      setActive(clamped);
      track.scrollTo({ left: scrollLeftForSlide(track, slide), behavior: "smooth" });
    },
    [slides.length],
  );

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let syncTimer: number | null = null;
    const syncActiveFromScroll = () => {
      if (programmaticScrollRef.current) return;
      const offsets = slideRefs.current.map((slide) => slide?.offsetLeft ?? 0);
      const index = closestSlideIndex(track.scrollLeft, offsets);
      setActive(index);
    };

    const onScroll = () => {
      if (syncTimer) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(syncActiveFromScroll, SCROLL_SYNC_MS);
    };

    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      if (syncTimer) window.clearTimeout(syncTimer);
      if (programmaticTimerRef.current) window.clearTimeout(programmaticTimerRef.current);
    };
  }, []);

  if (slides.length === 0) return null;

  return (
    <div className="relative overflow-x-hidden">
      <div
        ref={trackRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth sm:gap-4"
      >
        {slides.map((slide, index) => {
          const hasOverlayCopy = Boolean(slide.title || slide.subtitle || slide.ctaText);
          const content = (
            <div className="relative aspect-[9/13] w-full overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface-2 shadow-sm sm:aspect-[28/9]">
              {slide.mobileImageUrl ? (
                <Image
                  src={slide.mobileImageUrl}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="100vw"
                  className="object-contain object-center sm:hidden"
                />
              ) : null}
              <Image
                src={slide.imageUrl}
                alt=""
                fill
                priority={index === 0}
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1200px"
                className={`object-contain object-center ${slide.mobileImageUrl ? "hidden sm:block" : ""}`}
              />
              {hasOverlayCopy ? (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/70 via-ink-950/10 to-transparent p-4 sm:p-6">
                  {slide.title ? <p className="text-h3 font-bold text-white sm:text-h2">{slide.title}</p> : null}
                  {slide.subtitle ? <p className="text-small mt-1 text-white/85 sm:text-body">{slide.subtitle}</p> : null}
                  {slide.ctaText ? (
                    <span className="text-btn mt-3 inline-flex items-center rounded-[var(--radius-sm)] bg-white px-4 py-2 text-ink-900">
                      {slide.ctaText}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );

          return (
            <div
              key={slide.id}
              ref={(el) => {
                slideRefs.current[index] = el;
              }}
              className="w-full shrink-0 snap-start"
            >
              {slide.href ? (
                isExternalMerchHref(slide.href) || slide.openInNewTab ? (
                  <a href={slide.href} target="_blank" rel="noopener noreferrer" className="block">
                    {content}
                  </a>
                ) : (
                  <Link href={slide.href} className="block">
                    {content}
                  </Link>
                )
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {slides.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="წინა სლაიდი"
            onClick={() => goTo(active - 1)}
            className="absolute left-2 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-ink-800 shadow-md transition-transform hover:scale-105 sm:flex"
          >
            <ChevronLeft className="size-5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            aria-label="შემდეგი სლაიდი"
            onClick={() => goTo(active + 1)}
            className="absolute right-2 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface text-ink-800 shadow-md transition-transform hover:scale-105 sm:flex"
          >
            <ChevronRight className="size-5" strokeWidth={2.25} />
          </button>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`სლაიდი ${index + 1}`}
                aria-current={index === active ? true : undefined}
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200",
                  index === active ? "w-6 bg-brand-600" : "w-1.5 bg-brand-600/20 hover:bg-brand-600/35",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
