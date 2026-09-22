"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { scrollHomeLogoToTop } from "@/lib/scrollRestoration";

/** Intrinsic pixel size of `public/Logo.png` — keep in sync with the asset. */
const LOGO_WIDTH = 905;
const LOGO_HEIGHT = 315;

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
        className="h-8 w-auto max-w-[min(100%,11.5rem)] object-contain object-left sm:h-9 sm:max-w-[13rem]"
      />
    </Link>
  );
}
