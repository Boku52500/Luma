"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Award,
  ShoppingBag,
  Percent,
  ListChecks,
  ImageIcon,
  Menu,
  X,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/layout/Logo";
import { adminSignOut } from "@/server/actions/admin";
import type { AdminUser } from "@/server/auth/admin";

const NAV: { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { href: "/admin", label: "მიმოხილვა", icon: LayoutDashboard, exact: true },
  { href: "/admin/homepage", label: "მთავარი გვერდი", icon: ImageIcon },
  { href: "/admin/products", label: "პროდუქტები", icon: Package },
  { href: "/admin/categories", label: "კატეგორიები", icon: FolderTree },
  { href: "/admin/specifications", label: "სპეციფიკაციები", icon: ListChecks },
  { href: "/admin/brands", label: "ბრენდები", icon: Award },
  { href: "/admin/orders", label: "შეკვეთები", icon: ShoppingBag },
  { href: "/admin/promotions", label: "აქციები", icon: Percent },
] as const;

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="ადმინისტრაცია" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-2.5 rounded-[var(--radius-sm)] px-3 text-[0.875rem] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              active ? "bg-white/12 text-white" : "text-white/75 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ admin, children }: { admin: AdminUser; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const displayName = `${admin.firstName} ${admin.lastName}`.trim();

  return (
    <div className="min-h-full bg-bg">
      <div className="lg:grid lg:grid-cols-[240px_1fr]">
        <aside className="hidden min-h-screen flex-col bg-ink-900 px-3 py-5 lg:flex">
          <div className="px-2 pb-6">
            <span className="inline-flex rounded-[var(--radius-sm)] bg-white px-2 py-1.5">
              <Logo />
            </span>
            <p className="text-label mt-2 text-white/50">ადმინისტრაცია</p>
          </div>
          <NavLinks pathname={pathname} />
          <div className="mt-auto px-2 pt-6">
            <Link
              href="/"
              className="text-label inline-flex items-center gap-1.5 text-white/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              მაღაზია
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] border border-border lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              aria-expanded={open}
              aria-controls="admin-mobile-nav"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">ნავიგაცია</span>
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-small font-semibold text-text">{displayName}</p>
              <p className="truncate text-label text-text-faint">{admin.email}</p>
            </div>
            <form action={adminSignOut}>
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-3 text-small font-medium text-text-muted hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <LogOut className="size-4" />
                გასვლა
              </button>
            </form>
          </header>

          {open ? (
            <div id="admin-mobile-nav" className="border-b border-border bg-ink-900 px-3 py-4 lg:hidden">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
          ) : null}

          <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
