import { getDeliveryFee } from "@/lib/cart";

/**
 * Static checkout reference data + pure helpers. Kept separate from
 * `lib/cart.ts` (generic cart math) and from the checkout form hook (UI
 * state) so a future backend can replace any one of the three without
 * touching the others.
 */

export interface CustomerInfo {
  firstName: string;
  lastName: string;
  /** Local part only, e.g. "555 12 34 56" — the "+995" prefix is a fixed UI element, not part of the stored value. */
  phone: string;
  email: string;
}

export interface DeliveryAddress {
  /** One of `georgianCities`' values. */
  city: string;
  address: string;
  /** კორპუსი / სახლის ნომერი — optional. */
  building: string;
  /** ბინა — optional. */
  apartment: string;
  /** სადარბაზო — optional. */
  entrance: string;
  /** სართული — optional. */
  floor: string;
  /** დამატებითი ინფორმაცია — optional. */
  notes: string;
}

/** The subset of checkout state that validation and order creation actually need — excludes purely UI-only bits like `touched`/`submitted`. */
export interface CheckoutData {
  customer: CustomerInfo;
  delivery: DeliveryAddress;
  deliveryMethod: DeliveryMethodId | null;
  paymentMethod: PaymentMethodId | null;
}

export interface CityOption {
  value: string;
  label: string;
}

/** Structured so real delivery-zone logic (pricing/coverage per city) can replace this flat list later. */
export const georgianCities: CityOption[] = [
  { value: "tbilisi", label: "თბილისი" },
  { value: "batumi", label: "ბათუმი" },
  { value: "kutaisi", label: "ქუთაისი" },
  { value: "rustavi", label: "რუსთავი" },
  { value: "gori", label: "გორი" },
  { value: "zugdidi", label: "ზუგდიდი" },
  { value: "other", label: "სხვა" },
];

export function getCityLabel(cityValue: string): string {
  return georgianCities.find((city) => city.value === cityValue)?.label ?? cityValue;
}

export type DeliveryMethodId = "standard" | "express";

export interface DeliveryMethodOption {
  id: DeliveryMethodId;
  label: string;
  estimate: string;
  /** Flat mock fee — no courier API yet. */
  price: number;
}

export const deliveryMethods: DeliveryMethodOption[] = [
  { id: "standard", label: "სტანდარტული მიწოდება", estimate: "1–3 სამუშაო დღე", price: 5 },
  { id: "express", label: "სწრაფი მიწოდება", estimate: "იმავე დღეს ან მომდევნო სამუშაო დღეს", price: 15 },
];

/**
 * Standard delivery still benefits from the cart's free-shipping threshold;
 * express is a premium service and always keeps its flat fee. Reuses
 * `getDeliveryFee` from `lib/cart.ts` instead of re-deriving the
 * free-shipping rule, per the "one source of truth" requirement.
 */
export function getDeliveryMethodFee(method: DeliveryMethodOption, payableSubtotal: number): number {
  if (method.id === "standard") return getDeliveryFee(payableSubtotal);
  return method.price;
}

export type PaymentMethodId =
  | "card"
  | "installment"
  | "cash-on-delivery"
  | "google_pay"
  | "apple_pay"
  | "bog_loan"
  | "bnpl"
  | "saved_card";

export interface PaymentMethodOption {
  id: PaymentMethodId;
  label: string;
  description: string;
}

export const paymentMethods: PaymentMethodOption[] = [
  { id: "card", label: "ბარათით გადახდა", description: "გადახდა საქართველოს ბანკის უსაფრთხო გადახდის გვერდზე" },
  { id: "bnpl", label: "ნაწილ-ნაწილ", description: "გადაიხადეთ ნაწილ-ნაწილ საქართველოს ბანკის პირობებით" },
  { id: "bog_loan", label: "განვადება", description: "საქართველოს ბანკის სტანდარტული განვადება" },
  { id: "cash-on-delivery", label: "კურიერთან გადახდა", description: "გადაიხადეთ მიღებისას — ნაღდი ან ბარათით" },
  { id: "installment", label: "განვადება", description: "გადაანაწილეთ თანხა თვეებში ბანკის მეშვეობით" },
];

function methodById(id: PaymentMethodId): PaymentMethodOption {
  const found = paymentMethods.find((method) => method.id === id);
  if (!found) throw new Error(`Unknown payment method ${id}`);
  return found;
}

/** Card + flagged BOG calculator options. Cash stays as the existing non-BOG path. No Luma wallet buttons. */
export function visibleCheckoutPaymentMethods(
  caps: PublicCheckoutCapabilities | null | undefined,
): PaymentMethodOption[] {
  const methods = [methodById("card")];
  if (caps?.bnpl) methods.push(methodById("bnpl"));
  if (caps?.bogLoan) methods.push(methodById("bog_loan"));
  methods.push(methodById("cash-on-delivery"));
  return methods;
}

/** Official SDK: `true` = payment-in-installments only; `false` = standard installment only. Never omit. */
export function bogCalculatorBnplFlag(method: "bnpl" | "bog_loan"): boolean {
  return method === "bnpl";
}

export type PublicCheckoutCapabilities = {
  card: boolean;
  hostedGooglePay: boolean;
  externalGooglePay: boolean;
  externalApplePay: boolean;
  bogLoan: boolean;
  bnpl: boolean;
  savedCard: boolean;
  saveCardRecurrent: boolean;
  googlePay: {
    environment: "TEST" | "PRODUCTION";
    gateway: string;
    gatewayMerchantId: string;
  } | null;
  bogClientId: string | null;
};

export type SavedCheckoutCard = {
  id: string;
  maskedPan: string | null;
  cardType: string | null;
  cardExpiry: string | null;
};
