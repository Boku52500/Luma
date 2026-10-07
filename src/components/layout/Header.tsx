"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Heart } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";
import { MobileSearchTrigger } from "./MobileSearchTrigger";
import { MobileSearchOverlay } from "./MobileSearchOverlay";
import { CategoryMegaMenu } from "./CategoryMegaMenu";
import { MobileMenu } from "./MobileMenu";
import { HeaderAccountMenu } from "./HeaderAccountMenu";
import { HeaderCartArea } from "@/components/cart/HeaderCartArea";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { HEADER_SEARCH_STACK_CLASS } from "@/lib/headerStack";
import { useWishlist } from "@/hooks/useWishlist";
import { useIsClient } from "@/hooks/useIsClient";
import type { CategoryNavNode, MainNavItem } from "@/lib/categoryNav";

function IconLink({
  href,
  label,
  count,
  children,
}: {
  href: string;
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="relative flex size-10 items-center justify-center rounded-[var(--radius-md)] text-ink-700 transition-colors duration-150 hover:bg-black/[0.05] hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      {children}
      {typeof count === "number" && count > 0 ? (
        <span className="tnum absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[0.625rem] font-bold leading-none text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

export function Header({
  mainNav = [],
  categoryTree = [],
}: {
  mainNav?: MainNavItem[];
  categoryTree?: CategoryNavNode[];
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { count: wishlistCount } = useWishlist();
  const isClient = useIsClient();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className={cn(
          "overflow-visible border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80",
          HEADER_SEARCH_STACK_CLASS,
        )}
      >
        <Container>
          <div className="flex h-16 min-w-0 items-center gap-2.5 lg:h-[4.25rem] lg:gap-4 xl:gap-5">
            <button
              type="button"
              aria-label="მენიუს გახსნა"
              onClick={() => setMobileOpen(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-ink-800 transition-colors duration-150 hover:bg-black/[0.05] lg:hidden"
            >
              <Menu className="size-5" strokeWidth={2} />
            </button>

            <Logo className="shrink-0" />

            <div className="hidden min-w-0 flex-1 items-center gap-3 lg:flex">
              <CategoryMegaMenu tree={categoryTree} variant="header" />
              <SearchBar className="relative z-20 min-w-0 flex-1" />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5 lg:ml-0 lg:gap-1">
              <HeaderAccountMenu />
              <IconLink href="/account/wishlist" label="სურვილების სია" count={isClient ? wishlistCount : 0}>
                <Heart className="size-[21px]" strokeWidth={1.75} />
              </IconLink>
              <HeaderCartArea />
            </div>
          </div>

          <div className="pb-3 lg:hidden">
            <MobileSearchTrigger onOpen={() => setSearchOpen(true)} />
          </div>
        </Container>
      </div>

      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} mainNav={mainNav} categoryTree={categoryTree} />
      <MobileSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
    </header>
  );
}
