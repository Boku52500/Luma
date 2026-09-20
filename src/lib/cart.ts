import type { Product } from "@/types/product";

/**
 * Pure cart-calculation logic, kept framework-agnostic and independent from
 * the persistence layer (`cartStore.ts`) so the same math can run in the
 * mini-cart drawer, the full `/cart` page, and — later — a real
 * backend/checkout without being duplicated or re-derived per component.
 *
 * Line totals currently use the **cart-line price snapshot** (the displayed
 * unit price at add time). That is UI-only. A future server checkout must
 * revalidate live PostgreSQL prices before creating a payable order.
 *
 * Everything here works with plain numbers; formatting to GEL only happens
 * at render time via `formatPrice` from `lib/utils`.
 */

export const FREE_DELIVERY_THRESHOLD = 50;
export const STANDARD_DELIVERY_FEE = 9.9;
export const MAX_CART_LINES = 50;

/** Rounds to cents — guards against floating point drift when summing many lines. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function getLineTotal(unitPrice: number, quantity: number): number {
  return round2(unitPrice * quantity);
}

export function getCartItemCount(items: { quantity: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartSubtotal(items: { lineTotal: number }[]): number {
  return round2(items.reduce((sum, item) => sum + item.lineTotal, 0));
}

/** Placeholder delivery pricing — free above the threshold, flat fee otherwise. Replace with real shipping rates later. */
export function getDeliveryFee(payableSubtotal: number): number {
  if (payableSubtotal <= 0) return 0;
  return payableSubtotal >= FREE_DELIVERY_THRESHOLD ? 0 : STANDARD_DELIVERY_FEE;
}

export function getCartTotal(subtotal: number, discount: number, delivery: number): number {
  return Math.max(0, round2(subtotal - discount + delivery));
}

export interface PromoCodeResult {
  valid: boolean;
  code: string;
  /** Absolute GEL amount to subtract from the subtotal. */
  discount: number;
  message: string;
}

/**
 * Mock promo codes for UI/local testing only — no backend promotion engine.
 * Structured as a simple lookup so swapping this for a real API call later
 * only touches this one function, not any component.
 */
const MOCK_PROMO_CODES: Record<string, number> = {
  LUMA10: 0.1,
};

export function evaluatePromoCode(rawCode: string, subtotal: number): PromoCodeResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, code, discount: 0, message: "შეიყვანეთ პრომოკოდი" };
  }
  const percentOff = MOCK_PROMO_CODES[code];
  if (!percentOff) {
    return { valid: false, code, discount: 0, message: "პრომოკოდი არასწორია ან ვადაგასულია" };
  }
  return {
    valid: true,
    code,
    discount: round2(subtotal * percentOff),
    message: `პრომოკოდი "${code}" გააქტიურებულია — ${Math.round(percentOff * 100)}% ფასდაკლება`,
  };
}

/** First option of every variant group — used as the implicit selection when a product is added from a surface with no variant picker (product cards/lists). */
export function getDefaultVariants(product: Product): Record<string, string> {
  const entries = (product.variants ?? [])
    .map((group): [string, string] | null => (group.options[0] ? [group.id, group.options[0].value] : null))
    .filter((entry): entry is [string, string] => entry !== null);
  return Object.fromEntries(entries);
}

/** Human-readable "ფერი: შავი" pairs for a cart line's stored variant selection, used to render it under the product name. */
export function formatSelectedVariants(
  product: Product,
  selected: Record<string, string>
): { groupLabel: string; optionLabel: string }[] {
  return (product.variants ?? [])
    .filter((group) => selected[group.id] !== undefined)
    .map((group) => {
      const option = group.options.find((o) => o.value === selected[group.id]);
      return { groupLabel: group.label, optionLabel: option?.label ?? selected[group.id] };
    });
}
