"use client";

import { Truck, Zap } from "lucide-react";
import { deliveryMethods, getDeliveryMethodFee, type DeliveryMethodId } from "@/lib/checkout";
import { formatPrice, cn } from "@/lib/utils";

const iconByMethod: Record<DeliveryMethodId, typeof Truck> = {
  standard: Truck,
  express: Zap,
};

/** Reusable delivery-method radio cards — selecting one immediately updates the order summary via the parent's shared price calculation. */
export function DeliveryMethodSection({
  value,
  onChange,
  payableSubtotal,
  error,
}: {
  value: DeliveryMethodId | null;
  onChange: (value: DeliveryMethodId) => void;
  payableSubtotal: number;
  error?: string;
}) {
  return (
    <section
      id="deliveryMethod"
      aria-labelledby="delivery-method-heading"
      className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5 sm:p-6"
    >
      <h2 id="delivery-method-heading" className="text-h3 text-text">
        მიწოდების მეთოდი
      </h2>

      <div role="radiogroup" aria-label="მიწოდების მეთოდი" aria-required aria-invalid={Boolean(error)} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {deliveryMethods.map((method) => {
          const Icon = iconByMethod[method.id];
          const fee = getDeliveryMethodFee(method, payableSubtotal);
          const selected = value === method.id;

          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(method.id)}
              className={cn(
                "flex flex-col gap-2 rounded-[var(--radius-md)] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                selected ? "border-brand-600 bg-brand-50" : "border-border-strong hover:border-ink-900"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="flex items-center gap-2 text-body font-semibold text-text">
                  <Icon className="size-[18px] text-brand-800" strokeWidth={1.75} />
                  {method.label}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-brand-600 bg-brand-600" : "border-border-strong"
                  )}
                >
                  {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                </span>
              </div>
              <span className="text-small text-text-muted">{method.estimate}</span>
              <span className="text-small tnum font-semibold text-text">{fee === 0 ? "უფასო" : formatPrice(fee)}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-label text-danger-500">
          {error}
        </p>
      ) : null}
    </section>
  );
}
