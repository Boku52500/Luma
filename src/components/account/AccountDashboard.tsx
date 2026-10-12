"use client";

import Link from "next/link";
import { Package, Heart, MapPin, User, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useWishlist";
import { formatPrice, formatGeorgianDate } from "@/lib/utils";
import type { StorefrontOrder } from "@/lib/orderView";
import type { SavedAddress } from "@/types/account";
import { OrderStatusBadge } from "./OrderStatusBadge";

const overviewLinks = [
  { href: "/account/orders", label: "შეკვეთები", description: "ისტორია და სტატუსები", icon: Package },
  { href: "/account/wishlist", label: "რჩეულები", description: "შენახული პროდუქტები", icon: Heart },
  { href: "/account/addresses", label: "მისამართები", description: "მიწოდების მისამართები", icon: MapPin },
  { href: "/account/profile", label: "პროფილი", description: "საკონტაქტო ინფორმაცია", icon: User },
];

export function AccountDashboard({
  orders,
  addresses,
}: {
  orders: StorefrontOrder[];
  addresses: SavedAddress[];
}) {
  const { customer } = useAuth();
  const { count: wishlistCount } = useWishlist();
  const recentOrder = orders[0] ?? null;

  if (!customer) return null;

  const itemCount = recentOrder ? recentOrder.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-h2 text-text">გამარჯობა, {customer.firstName}</h1>
        <p className="text-body mt-1 text-text-muted">მართეთ შეკვეთები, რჩეულები და მისამართები ერთი ადგილიდან.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {overviewLinks.map((link) => {
          const Icon = link.icon;
          const extra =
            link.href === "/account/wishlist" && wishlistCount > 0
              ? `${wishlistCount}`
              : link.href === "/account/orders" && orders.length > 0
                ? `${orders.length}`
                : link.href === "/account/addresses" && addresses.length > 0
                  ? `${addresses.length}`
                  : null;

          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex min-h-[7.5rem] flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:min-h-[8.5rem] sm:p-5"
            >
              <span className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] bg-brand-50 text-brand-700">
                <Icon className="size-[18px]" strokeWidth={1.75} />
              </span>
              <span>
                <span className="text-small flex items-center gap-1.5 font-semibold text-text">
                  {link.label}
                  {extra ? (
                    <span className="tnum rounded-full bg-surface-2 px-1.5 py-0.5 text-[0.6875rem] font-medium text-text-muted">
                      {extra}
                    </span>
                  ) : null}
                </span>
                <span className="text-label mt-0.5 hidden text-text-faint sm:block">{link.description}</span>
              </span>
            </Link>
          );
        })}
      </div>

      {recentOrder ? (
        <section aria-labelledby="recent-order-heading" className="rounded-[var(--radius-md)] border border-border bg-surface p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="recent-order-heading" className="text-h3 text-text">
              ბოლო შეკვეთა
            </h2>
            <Link
              href={`/account/orders/${encodeURIComponent(recentOrder.id)}`}
              className="text-small inline-flex items-center gap-1 font-medium text-brand-800 hover:text-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              დეტალები
              <ChevronRight className="size-4" strokeWidth={2} />
            </Link>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-small tnum font-semibold text-text">{recentOrder.id}</p>
              <p className="text-label mt-0.5 text-text-faint">
                {formatGeorgianDate(recentOrder.createdAt)} · {itemCount} პროდუქტი
              </p>
            </div>
            <div className="flex items-center gap-3">
              <OrderStatusBadge status={recentOrder.status} />
              <span className="tnum text-small font-semibold text-text">{formatPrice(recentOrder.total)}</span>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
