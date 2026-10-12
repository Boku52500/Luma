"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { scrollHomeLogoToTop } from "@/lib/scrollRestoration";

/** Intrinsic pixel size of `public/Logo.png` — keep in sync with the asset. */
const LOGO_WIDTH = 1400;
const LOGO_HEIGHT = 480;

export function Logo({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <Link
      href="/"
      aria-label="Luma — მთავარი გვერდი"
      className={cn("group inline-flex shrink-0 items-center", className)}
      onClick={(event) => {
        if (pathname !== "/") return;
        event.preventDefault();
        scrollHomeLogoToTop();
      }}
    >
      <Image
        src="/Logo.png"
        alt="Luma"
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        priority
        unoptimized
        className="h-10 w-auto max-w-[min(100%,13.5rem)] object-contain object-left sm:h-11 sm:max-w-[15.5rem] lg:h-12 lg:max-w-[17.5rem]"
      />
    </Link>
  );
}
