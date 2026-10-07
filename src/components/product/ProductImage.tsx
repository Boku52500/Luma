import Image from "next/image";
import {
  Smartphone,
  Laptop,
  Tablet,
  Tv,
  Monitor,
  Gamepad2,
  Keyboard,
  Cpu,
  Mouse,
  Headphones,
  Lightbulb,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductVisual } from "@/types/product";

/**
 * Product photo when `src` is present; otherwise a brand-consistent Lucide
 * illustration fallback (used when a product has no primary image).
 */

export const iconByVisual: Record<ProductVisual, LucideIcon> = {
  phone: Smartphone,
  laptop: Laptop,
  tablet: Tablet,
  tv: Tv,
  monitor: Monitor,
  gaming: Gamepad2,
  keyboard: Keyboard,
  components: Cpu,
  accessory: Mouse,
  audio: Headphones,
  "smart-home": Lightbulb,
  network: Wifi,
};

export const toneClasses: Record<number, { bg: string; icon: string; plate: string }> = {
  1: { bg: "bg-surface-2", icon: "text-ink-600", plate: "bg-white" },
  2: { bg: "bg-brand-50", icon: "text-brand-700", plate: "bg-white/70" },
  3: { bg: "bg-accent-50", icon: "text-accent-700", plate: "bg-white/70" },
  4: { bg: "bg-success-50", icon: "text-success-600", plate: "bg-white/70" },
  5: { bg: "bg-ink-900", icon: "text-white", plate: "bg-white/8" },
};

export function ProductImage({
  visual,
  tone = 1,
  hoverVisual,
  src,
  alt = "",
  hoverSrc,
  fill = false,
  sizes = "(max-width: 640px) 50vw, 220px",
  className,
}: {
  visual: ProductVisual;
  tone?: number;
  /**
   * Optional second mock "photo" that crossfades in on hover — the same
   * mechanism a real product gallery would use to swap to a lifestyle/angle
   * shot. Requires an ancestor with the `group` class (ProductCard sets this).
   */
  hoverVisual?: ProductVisual;
  src?: string;
  alt?: string;
  hoverSrc?: string;
  /** When true, fills the parent's height instead of forcing a square. */
  fill?: boolean;
  sizes?: string;
  className?: string;
}) {
  const Icon = iconByVisual[visual];
  const HoverIcon = hoverVisual ? iconByVisual[hoverVisual] : null;
  const t = toneClasses[tone] ?? toneClasses[1];

  if (src) {
    return (
      <div
        className={cn(
          "relative flex w-full items-center justify-center overflow-hidden rounded-[var(--radius-md)] bg-surface-2",
          fill ? "h-full" : "aspect-square",
          className,
        )}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className={cn("object-contain", hoverSrc && "transition-opacity duration-200 group-hover:opacity-0")}
        />
        {hoverSrc ? (
          <Image
            src={hoverSrc}
            alt=""
            aria-hidden
            fill
            sizes={sizes}
            className="object-contain opacity-0 transition-opacity duration-200 group-hover:opacity-100"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-[var(--radius-md)]",
        fill ? "h-full" : "aspect-square",
        t.bg,
        className,
      )}
    >
      <div
        className={cn(
          "flex size-[62%] items-center justify-center rounded-full transition-opacity duration-200",
          t.plate,
          HoverIcon && "group-hover:opacity-0",
        )}
      >
        <Icon className={cn("h-[42%] w-[42%]", t.icon)} strokeWidth={1.35} />
      </div>

      {HoverIcon ? (
        <div
          aria-hidden
          className={cn(
            "absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100",
            t.bg,
          )}
        >
          <div className={cn("flex size-[62%] items-center justify-center rounded-full", t.plate)}>
            <HoverIcon className={cn("h-[42%] w-[42%]", t.icon)} strokeWidth={1.35} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
