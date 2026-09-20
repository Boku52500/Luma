"use server";

import { cookies, headers } from "next/headers";
import { prisma } from "@/server/db";
import { getSessionCustomer } from "@/server/auth/session";
import { clientIpFromHeaders, consumeRateLimit } from "@/server/auth/rateLimit";
import { logError } from "@/server/log";
import { orderSubmissionSchema } from "@/server/validation/order";
import { firstZodMessage, isUniqueConstraintError } from "@/server/actions/helpers";
import { GENERIC_SERVER_ERROR, type ActionResult } from "@/server/actions/result";
import { moneyToNumber, numberToMoney } from "@/server/money";
import { bogCalculatorLoanFromSdkSelection } from "@/lib/bogSdk";
import { deliveryMethods, getDeliveryMethodFee } from "@/lib/checkout";
import { DEFAULT_LOCALE } from "@/server/locale";
import { ORDER_CONFIRM_COOKIE } from "@/server/account/orders";
import { asProductVisual, asTone } from "@/lib/orderView";
import { randomBytes } from "node:crypto";
import { bogConfigured, BOG_NOT_CONFIGURED_MESSAGE } from "@/server/payments/bog/config";
import { createPendingCardPayment, PaymentUserError, startBogPaymentForOrder } from "@/server/payments/initiate";
import { scheduleEmail } from "@/server/email/schedule";
import { notifyOrderConfirmation } from "@/server/email/notify";
import { placePromotionRedemption, PromoUserError } from "@/server/commerce/promoRedemption";
import { isPaidLikePaymentStatus } from "@/server/commerce/inventoryState";
import { resolveOrderVariant } from "@/server/commerce/variantResolution";
import { isOnlineBogMethod } from "@/server/payments/methods";
import { getBogMerchantCapabilities } from "@/server/payments/bog/capabilities";
import type { StartBogPaymentOptions } from "@/server/payments/initiate";
import type { OrderSubmissionInput } from "@/server/validation/order";

async function bogStartOptions(
  payload: OrderSubmissionInput,
  customerId: string | null,
): Promise<StartBogPaymentOptions> {
  const options: StartBogPaymentOptions = { method: payload.paymentMethod };
  if (payload.paymentMethod === "google_pay") {
    if (!payload.googlePayToken) throw new OrderUserError("Google Pay ტოკენი ვერ მოიძებნა.");
    options.googlePayToken = payload.googlePayToken;
    options.paymentMethods = ["google_pay"];
  }
  if (payload.paymentMethod === "apple_pay") {
    options.applePayExternal = true;
    options.paymentMethods = ["apple_pay"];
  }
  if (payload.paymentMethod === "bog_loan" || payload.paymentMethod === "bnpl") {
    if (!payload.loanMonth || !payload.loanDiscountCode) {
      throw new OrderUserError("აირჩიეთ განვადების პირობები ბანკის კალკულატორიდან.");
    }
    options.loan = bogCalculatorLoanFromSdkSelection({
      month: payload.loanMonth,
      discount_code: payload.loanDiscountCode,
    });
    options.paymentMethods = [payload.paymentMethod];
  }
  if (payload.paymentMethod === "saved_card") {
    if (!customerId || !payload.savedPaymentMethodId) {
      throw new OrderUserError("შენახული ბარათით გადახდა მხოლოდ ავტორიზებული მომხმარებლისთვისაა.");
    }
    const saved = await prisma.savedPaymentMethod.findFirst({
      where: { id: payload.savedPaymentMethodId, customerId, deletedAt: null, consent: "recurrent" },
    });
    if (!saved) throw new OrderUserError("გადახდის მეთოდი ვერ მოიძებნა");
    options.parentOrderId = saved.parentOrderId;
    options.savedPaymentMethodId = saved.id;
    options.method = "saved_card";
  }
  if (payload.saveCardConsent === "recurrent" && customerId) {
    options.saveCardConsent = "recurrent";
  }
  return options;
}

class OrderUserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderUserError";
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const nonce = randomBytes(2).toString("hex").toUpperCase();
  return `LUMA-${stamp}-${nonce}`;
}

function pickName(translations: { locale: string; name: string }[], fallback: string): string {
  return translations.find((row) => row.locale === DEFAULT_LOCALE)?.name ?? translations[0]?.name ?? fallback;
}

function setConfirmCookie(orderNumber: string) {
  return cookies().then((jar) => {
    jar.set(ORDER_CONFIRM_COOKIE, orderNumber, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60,
    });
  });
}

async function continueCardPayment(
  orderId: string,
  orderNumber: string,
  options?: StartBogPaymentOptions,
) {
  try {
    const started = await startBogPaymentForOrder(orderId, options);
    return {
      ok: true as const,
      data: {
        orderNumber,
        redirectUrl: started.redirectUrl,
        providerOrderId: started.providerOrderId,
        applePay: started.applePay,
      },
    };
  } catch (error) {
    if (error instanceof PaymentUserError) {
      return { ok: false as const, message: error.message, orderNumber };
    }
    logError("order.payment_start_failed", { error, orderNumber });
    return { ok: false as const, message: GENERIC_SERVER_ERROR, orderNumber };
  }
}

async function replayExistingCheckout(
  order: {
    id: string;
    orderNumber: string;
    paymentMethod: string;
    paymentStatus: string;
  },
  options?: StartBogPaymentOptions,
): Promise<ActionResult<{ orderNumber: string; redirectUrl?: string; providerOrderId?: string; applePay?: { providerOrderId: string; result: unknown } }>> {
  await setConfirmCookie(order.orderNumber);
  if (isOnlineBogMethod(order.paymentMethod) && !isPaidLikePaymentStatus(order.paymentStatus)) {
    return continueCardPayment(order.id, order.orderNumber, options ?? { method: order.paymentMethod });
  }
  return { ok: true, data: { orderNumber: order.orderNumber } };
}

export async function createOrder(
  input: unknown,
): Promise<ActionResult<{ orderNumber: string; redirectUrl?: string; providerOrderId?: string; applePay?: { providerOrderId: string; result: unknown } }>> {
  const parsed = orderSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    const { message, fieldErrors } = firstZodMessage(parsed.error);
    return { ok: false, message, fieldErrors };
  }

  const session = await getSessionCustomer();
  const payload = parsed.data;
  const ip = clientIpFromHeaders(await headers());
  if (!(await consumeRateLimit(`checkout:ip:${ip}`, 20, 15 * 60 * 1000))) {
    return { ok: false, message: "ძალიან ბევრი მცდელობაა. სცადეთ მოგვიანებით." };
  }
  if (isOnlineBogMethod(payload.paymentMethod)) {
    if (!(await consumeRateLimit(`payment:ip:${ip}`, 10, 15 * 60 * 1000))) {
      return { ok: false, message: "ძალიან ბევრი მცდელობაა. სცადეთ მოგვიანებით." };
    }
    if (!bogConfigured()) {
      return { ok: false, message: BOG_NOT_CONFIGURED_MESSAGE };
    }
  }
  const promoCode = payload.promoCode?.trim().toUpperCase() || null;
  const cardCheckout = isOnlineBogMethod(payload.paymentMethod);
  const caps = getBogMerchantCapabilities();
  if (payload.paymentMethod === "google_pay" && !caps.externalGooglePay) {
    return { ok: false, message: "Google Pay ამჟამად მიუწვდომელია." };
  }
  if (payload.paymentMethod === "apple_pay" && !caps.externalApplePay) {
    return { ok: false, message: "Apple Pay ამჟამად მიუწვდომელია." };
  }
  if (payload.paymentMethod === "bog_loan" && !caps.installment) {
    return { ok: false, message: "განვადება ამჟამად მიუწვდომელია." };
  }
  if (payload.paymentMethod === "bnpl" && !caps.bnpl) {
    return { ok: false, message: "ნაწილ-ნაწილ ამჟამად მიუწვდომელია." };
  }
  if (payload.paymentMethod === "saved_card" && (!caps.savedCardRecurrent || !session?.id || !payload.savedPaymentMethodId)) {
    return { ok: false, message: "შენახული ბარათით გადახდა მხოლოდ ავტორიზებული მომხმარებლისთვისაა." };
  }
  if (payload.saveCardConsent === "recurrent" && (!caps.savedCardRecurrent || !session?.id)) {
    return { ok: false, message: "ბარათის შენახვა მხოლოდ ავტორიზებული მომხმარებლისთვისაა." };
  }

  const existing = await prisma.order.findUnique({
    where: { checkoutIdempotencyKey: payload.checkoutIdempotencyKey },
    select: { id: true, orderNumber: true, paymentMethod: true, paymentStatus: true },
  });
  if (existing) {
    try {
      return await replayExistingCheckout(existing, await bogStartOptions(payload, session?.id ?? null));
    } catch (error) {
      if (error instanceof OrderUserError) return { ok: false, message: error.message };
      throw error;
    }
  }

  try {
    const placed = await prisma.$transaction(async (tx) => {
      const productIds = [...new Set(payload.items.map((item) => item.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true, deletedAt: null },
        include: {
          translations: true,
          brand: { include: { translations: true } },
          variants: {
            include: {
              options: {
                include: {
                  option: {
                    include: {
                      translations: true,
                      attribute: { include: { translations: true } },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (products.length !== productIds.length) {
        throw new OrderUserError("ერთ-ერთი პროდუქტი აღარ არის ხელმისაწვდომი.");
      }

      const byId = new Map(products.map((product) => [product.id, product]));
      const lineSnapshots: Array<{
        productId: string;
        productName: string;
        sku: string;
        selectedVariants: object;
        unitPrice: number;
        quantity: number;
        lineTotal: number;
        variantId: string | null;
      }> = [];

      for (const item of payload.items) {
        const product = byId.get(item.productId);
        if (!product) throw new OrderUserError("ერთ-ერთი პროდუქტი აღარ არის ხელმისაწვდომი.");

        const selected = item.selectedVariants ?? [];
        const productName = pickName(product.translations, product.slug);
        const brandName = pickName(product.brand.translations, "");
        const visual = asProductVisual(product.illustrationKey);
        const tone = asTone(product.illustrationTone);

        let unitPrice = moneyToNumber(product.price);
        let sku = product.sku;
        let variantId: string | null = null;
        let axes: Array<{ attributeSlug: string; attributeLabel: string; optionSlug: string; optionLabel: string }> =
          [];

        if (product.variants.length > 0) {
          const match = resolveOrderVariant(
            product.variants.filter((variant) => variant.isActive),
            selected,
          );
          if (!match) {
            throw new OrderUserError(`${productName} — არჩეული ვარიანტი აღარ არის ხელმისაწვდომი.`);
          }
          variantId = match.id;
          sku = match.sku;
          unitPrice = moneyToNumber(match.priceOverride ?? product.price);
          axes = match.options.map((entry) => ({
            attributeSlug: entry.option.attribute.slug,
            attributeLabel: pickName(entry.option.attribute.translations, entry.option.attribute.slug),
            optionSlug: entry.option.slug,
            optionLabel: pickName(entry.option.translations, entry.option.slug),
          }));
        }

        lineSnapshots.push({
          productId: product.id,
          productName,
          sku,
          selectedVariants: {
            axes,
            brand: brandName,
            slug: product.slug,
            visual,
            tone,
          },
          unitPrice,
          quantity: item.quantity,
          lineTotal: round2(unitPrice * item.quantity),
          variantId,
        });
      }

      const subtotal = round2(lineSnapshots.reduce((sum, line) => sum + line.lineTotal, 0));
      let discount = 0;
      let storedPromo: string | null = null;
      let promotionId: string | null = null;

      if (promoCode) {
        const promotion = await tx.promotion.findFirst({
          where: { code: promoCode, isActive: true },
        });
        const now = new Date();
        const inWindow =
          Boolean(promotion) &&
          (!promotion?.startsAt || promotion.startsAt <= now) &&
          (!promotion?.endsAt || promotion.endsAt >= now);
        const minOk =
          !promotion?.minOrderAmount || subtotal >= moneyToNumber(promotion.minOrderAmount);

        if (!promotion || !inWindow || !minOk) {
          throw new OrderUserError("პრომოკოდი არასწორია ან ვადაგასულია");
        }

        if (promotion.type === "percentage") {
          discount = round2(subtotal * (moneyToNumber(promotion.value) / 100));
        } else {
          discount = Math.min(subtotal, moneyToNumber(promotion.value));
        }
        storedPromo = promotion.code;
        promotionId = promotion.id;
      }

      const payableSubtotal = Math.max(0, round2(subtotal - discount));
      const delivery = deliveryMethods.find((method) => method.id === payload.deliveryMethod);
      if (!delivery) throw new OrderUserError("აირჩიეთ მიწოდების მეთოდი");
      const deliveryFee = getDeliveryMethodFee(delivery, payableSubtotal);
      const total = Math.max(0, round2(payableSubtotal + deliveryFee));

      let number = generateOrderNumber();
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const clash = await tx.order.findUnique({ where: { orderNumber: number }, select: { id: true } });
        if (!clash) break;
        number = generateOrderNumber();
      }

      const order = await tx.order.create({
        data: {
          orderNumber: number,
          checkoutIdempotencyKey: payload.checkoutIdempotencyKey,
          customerId: session?.id ?? null,
          customerFirstName: payload.customer.firstName,
          customerLastName: payload.customer.lastName,
          customerEmail: payload.customer.email,
          customerPhone: payload.customer.phone,
          city: payload.address.city,
          street: payload.address.street,
          building: payload.address.building,
          apartment: payload.address.apartment,
          entrance: payload.address.entrance,
          floor: payload.address.floor,
          additionalInfo: payload.address.additionalInfo,
          deliveryMethod: payload.deliveryMethod,
          paymentMethod: payload.paymentMethod,
          paymentStatus: cardCheckout ? "pending" : "unpaid",
          orderStatus: "pending",
          inventoryState: cardCheckout ? "held" : "committed",
          subtotal: numberToMoney(subtotal),
          discount: numberToMoney(discount),
          deliveryFee: numberToMoney(deliveryFee),
          total: numberToMoney(total),
          promoCode: storedPromo,
          installmentMonths: payload.paymentMethod === "installment" ? payload.installmentMonths ?? null : null,
          items: {
            create: lineSnapshots.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              sku: line.sku,
              selectedVariants: line.selectedVariants,
              unitPrice: numberToMoney(line.unitPrice),
              quantity: line.quantity,
              lineTotal: numberToMoney(line.lineTotal),
            })),
          },
        },
      });

      if (promotionId) {
        await placePromotionRedemption(tx, {
          promotionId,
          orderId: order.id,
          event: cardCheckout ? "place_card" : "place_immediate",
        });
      }

      if (cardCheckout) {
        await createPendingCardPayment(tx, { id: order.id, total: order.total }, {
          method: payload.paymentMethod,
          loanMonth: payload.loanMonth ?? undefined,
          loanDiscountCode: payload.loanDiscountCode ?? undefined,
        });
      }

      return { orderNumber: order.orderNumber, orderId: order.id, paymentMethod: payload.paymentMethod };
    });

    await setConfirmCookie(placed.orderNumber);
    scheduleEmail(() => notifyOrderConfirmation(placed.orderId));

    if (isOnlineBogMethod(placed.paymentMethod)) {
      return continueCardPayment(placed.orderId, placed.orderNumber, await bogStartOptions(payload, session?.id ?? null));
    }

    return { ok: true, data: { orderNumber: placed.orderNumber } };
  } catch (error) {
    if (isUniqueConstraintError(error, "checkoutIdempotencyKey")) {
      const replay = await prisma.order.findUnique({
        where: { checkoutIdempotencyKey: payload.checkoutIdempotencyKey },
        select: { id: true, orderNumber: true, paymentMethod: true, paymentStatus: true },
      });
      if (replay) return replayExistingCheckout(replay, await bogStartOptions(payload, session?.id ?? null));
    }
    if (error instanceof OrderUserError || error instanceof PromoUserError) {
      return { ok: false, message: error.message };
    }
    logError("order.create_failed", { error });
    return { ok: false, message: GENERIC_SERVER_ERROR };
  }
}
