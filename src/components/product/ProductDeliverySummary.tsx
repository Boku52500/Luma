import { ShieldCheck, Truck } from "lucide-react";
import type { ProductDelivery } from "@/types/product";
import { cn } from "@/lib/utils";

/** Compact warranty + delivery summary shown between price and purchase actions. */
export function ProductDeliverySummary({
  warranty,
  delivery,
  className,
}: {
  warranty: string;
  delivery: ProductDelivery;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2 p-4", className)}>
      <div className="flex items-start gap-2.5">
        <Truck className="mt-0.5 size-4 shrink-0 text-brand-800" strokeWidth={1.75} />
        <p className="text-small text-text">
          {delivery.estimate}
          <a href="#warranty-delivery" className="ml-1.5 text-text-muted underline decoration-border-strong underline-offset-2 hover:text-brand-800">
            დეტალურად
          </a>
        </p>
      </div>
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-800" strokeWidth={1.75} />
        <p className="text-small text-text">{warranty}</p>
      </div>
    </div>
  );
}
