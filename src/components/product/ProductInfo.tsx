import Link from "next/link";
import type { Product } from "@/types/product";
import { cn } from "@/lib/utils";
import { availabilityLabel } from "@/lib/productLabels";

/** Brand / title / SKU / availability block — top of the PDP right column. */
export function ProductInfo({
  product,
  sku,
  shortDescription,
  className,
}: {
  product: Product;
  sku: string;
  shortDescription?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <Link
          href={`/category/${product.category}`}
          className="text-label text-brand-800 transition-colors hover:text-brand-900"
        >
          {product.brand}
        </Link>
        <h1 className="text-h2 mt-1 text-text lg:text-[1.75rem]">{product.name}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-small text-text-muted">
          კოდი: <span className="tnum font-medium text-text">{sku}</span>
        </span>
      </div>

      <span
        className={cn(
          "text-small inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
          product.availability === "in-stock" && "bg-success-50 text-success-700",
          product.availability === "low-stock" && "bg-warning-50 text-warning-700",
          product.availability === "out-of-stock" && "bg-surface-2 text-text-faint"
        )}
      >
        <span
          className={cn(
            "size-1.5 rounded-full",
            product.availability === "in-stock" && "bg-success-500",
            product.availability === "low-stock" && "bg-warning-500",
            product.availability === "out-of-stock" && "bg-text-faint"
          )}
        />
        {availabilityLabel[product.availability]}
      </span>

      {shortDescription ? <p className="text-body max-w-prose text-text-muted">{shortDescription}</p> : null}
    </div>
  );
}
