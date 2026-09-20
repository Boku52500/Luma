import "server-only";

import { cookies } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";
import { moneyToNumber } from "@/server/money";
import { customerRefundSnapshot } from "@/server/payments/refundable";
import {
  asProductVisual,
  asTone,
  toUiOrderStatus,
  toUiPaymentMethod,
  type StorefrontOrder,
  type StorefrontOrderItem,
} from "@/lib/orderView";
import { DEFAULT_LOCALE } from "@/server/locale";

export const ORDER_CONFIRM_COOKIE = "luma_order_confirm";

type VariantAxis = {
  attributeSlug?: string;
  attributeLabel?: string;
  optionSlug?: string;
  optionLabel?: string;
  groupLabel?: string;
};

type ItemSnapshot = {
  axes?: VariantAxis[];
  brand?: string;
  slug?: string;
  visual?: string;
  tone?: number;
};

function parseSnapshot(value: unknown): ItemSnapshot {
  if (!value || typeof value !== "object") return {};
  return value as ItemSnapshot;
}

function mapItem(item: {
  productId: string | null;
  productName: string;
  unitPrice: unknown;
  quantity: number;
  lineTotal: unknown;
  selectedVariants: unknown;
}): StorefrontOrderItem {
  const snapshot = parseSnapshot(item.selectedVariants);
  const axes = Array.isArray(snapshot.axes) ? snapshot.axes : [];
  return {
    productId: item.productId ?? "",
    slug: snapshot.slug,
    name: item.productName,
    brand: snapshot.brand ?? "",
    visual: asProductVisual(snapshot.visual),
    tone: asTone(snapshot.tone),
    unitPrice: moneyToNumber(item.unitPrice as never),
    quantity: item.quantity,
    variants: axes.map((axis) => ({
      groupLabel: axis.attributeLabel || axis.groupLabel || axis.attributeSlug || "",
      optionLabel: axis.optionLabel || axis.optionSlug || "",
    })),
    lineTotal: moneyToNumber(item.lineTotal as never),
  };
}

type OrderRow = Awaited<ReturnType<typeof prisma.order.findFirst>> & {
  items?: Array<{
    productId: string | null;
    productName: string;
    unitPrice: unknown;
    quantity: number;
    lineTotal: unknown;
    selectedVariants: unknown;
  }>;
  payments?: Array<{
    status: string;
    providerRefundAmount?: Prisma.Decimal | string | number | null;
    refunds?: Array<{ status: string; amount: Prisma.Decimal | string | number }>;
  }>;
};

export function mapOrderToStorefront(order: NonNullable<OrderRow>): StorefrontOrder {
  return {
    id: order.orderNumber,
    createdAt: order.createdAt.getTime(),
    customerId: order.customerId,
    status: toUiOrderStatus(order.orderStatus),
    paymentStatus: order.paymentStatus,
    items: (order.items ?? []).map(mapItem),
    subtotal: moneyToNumber(order.subtotal),
    discount: moneyToNumber(order.discount),
    promoCode: order.promoCode,
    deliveryFee: moneyToNumber(order.deliveryFee),
    deliveryMethodId: order.deliveryMethod,
    total: moneyToNumber(order.total),
    customer: {
      firstName: order.customerFirstName,
      lastName: order.customerLastName,
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    delivery: {
      city: order.city,
      address: order.street,
      building: order.building ?? "",
      apartment: order.apartment ?? "",
      entrance: order.entrance ?? "",
      floor: order.floor ?? "",
      notes: order.additionalInfo ?? "",
    },
    paymentMethod: toUiPaymentMethod(order.paymentMethod),
    installmentMonths: order.installmentMonths,
  };
}

const orderInclude = {
  items: true,
  payments: { include: { refunds: true } },
} as const;

function toStorefront(order: NonNullable<OrderRow>) {
  return {
    ...mapOrderToStorefront(order),
    ...customerRefundSnapshot(order.payments ?? []),
  };
}

export async function listCustomerOrders(customerId: string): Promise<StorefrontOrder[]> {
  const rows = await prisma.order.findMany({
    where: { customerId },
    include: orderInclude,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toStorefront);
}

export async function getCustomerOrder(customerId: string, orderNumber: string): Promise<StorefrontOrder | null> {
  const row = await prisma.order.findFirst({
    where: { customerId, orderNumber },
    include: orderInclude,
  });
  return row ? toStorefront(row) : null;
}

export async function getOrderForConfirmation(
  orderNumber: string | null | undefined,
  customerId: string | null,
): Promise<StorefrontOrder | null> {
  if (!orderNumber) return null;

  const row = await prisma.order.findUnique({
    where: { orderNumber },
    include: orderInclude,
  });
  if (!row) return null;

  if (customerId && row.customerId === customerId) {
    return toStorefront(row);
  }

  const jar = await cookies();
  const token = jar.get(ORDER_CONFIRM_COOKIE)?.value;
  if (token && token === row.orderNumber) {
    return toStorefront(row);
  }

  return null;
}

export function translationName(
  translations: { locale: string; name: string }[],
  fallback = "",
): string {
  return translations.find((row) => row.locale === DEFAULT_LOCALE)?.name ?? translations[0]?.name ?? fallback;
}
