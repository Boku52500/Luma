import { cn, formatPrice, getDiscountPercent } from "@/lib/utils";
import { availabilityLabel } from "@/lib/productLabels";
import type { Product } from "@/types/product";
import { ProductImage } from "@/components/product/ProductImage";

/** Compact product row used inside the search suggestions dropdown/overlay — a lighter cousin of ProductCard with no add-to-cart/wishlist actions. */
export function SearchProductRow({
  product,
  id,
  active,
  onHover,
  onSelect,
}: {
  product: Product;
  id: string;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  const discount = getDiscountPercent(product.price, product.previousPrice);
  const primaryPhoto = product.images?.find((image) => image.src);

  return (
    <button
      id={id}
      role="option"
      aria-selected={active}
      type="button"
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150",
        active && "bg-surface-2"
      )}
    >
      <ProductImage
        visual={product.visual}
        tone={product.tone}
        src={primaryPhoto?.src}
        alt={primaryPhoto?.alt || product.name}
        sizes="44px"
        className="size-11 shrink-0"
      />

      <span className="min-w-0 flex-1">
        <span className="block truncate text-label text-text-faint">{product.brand}</span>
        <span className="block truncate text-small font-medium text-text">{product.name}</span>
        <span
          className={cn(
            "mt-0.5 inline-flex items-center gap-1 text-label font-medium",
            product.availability === "in-stock" && "text-success-600",
            product.availability === "low-stock" && "text-warning-500",
            product.availability === "out-of-stock" && "text-text-faint"
          )}
        >
          <span
            className={cn(
              "size-1 rounded-full",
              product.availability === "in-stock" && "bg-success-500",
              product.availability === "low-stock" && "bg-warning-500",
              product.availability === "out-of-stock" && "bg-text-faint"
            )}
          />
          {availabilityLabel[product.availability]}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className="tnum block text-small font-semibold text-text">{formatPrice(product.price)}</span>
        {product.previousPrice && discount ? (
          <span className="tnum block text-label text-text-faint line-through">{formatPrice(product.previousPrice)}</span>
        ) : null}
      </span>
    </button>
  );
}
