"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { formatPrice, formatGeorgianDate } from "@/lib/utils";
import type { StorefrontOrder } from "@/lib/orderView";
import { AccountEmptyState } from "./AccountEmptyState";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { PaymentStatusBadge } from "@/components/payments/PaymentStatusBadge";
import { customerFacingPaymentStatus } from "@/lib/paymentCopy";

export function OrdersPageClient({ orders }: { orders: StorefrontOrder[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-h2 text-text">შეკვეთები</h1>
        <p className="text-body mt-1 text-text-muted">თქვენი შეკვეთების ისტორია.</p>
      </div>

      {orders.length === 0 ? (
        <AccountEmptyState
          icon={Package}
          title="შეკვეთები ჯერ არ გაქვთ"
          description="როცა შეკვეთას გააფორმებთ, ის აქ გამოჩნდება."
          secondaryHref="/"
          secondaryLabel="მთავარზე დაბრუნება"
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const quantity = Array.isArray(order.items)
              ? order.items.reduce((sum, item) => sum + (item?.quantity || 0), 0)
              : 0;

            return (
              <li key={order.id}>
                <Link
                  href={`/account/orders/${encodeURIComponent(order.id)}`}
                  className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="text-small tnum font-semibold text-text">{order.id}</p>
                    <p className="text-label mt-0.5 text-text-faint">
                      {formatGeorgianDate(order.createdAt)} · {quantity} პროდუქტი
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={customerFacingPaymentStatus(order.paymentStatus, order.refundInProgress)} />
                    <span className="tnum text-small font-semibold text-text">{formatPrice(order.total)}</span>
                    <span className="text-small font-medium text-brand-800">დეტალების ნახვა</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
