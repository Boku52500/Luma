import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@/generated/prisma/client";
import { buildBogCreateOrderBody } from "./payload";
import { classifyBogActionCode, classifyBogPaymentCode, DOCUMENTED_ACTION_CODES, DOCUMENTED_PAYMENT_CODES } from "./responseCodes";
import { BOG_SPLIT_MAX_ENTRIES, validateBogSplitPayments } from "./split";
import { mapBogStatusToAttempt, shouldApplyAttemptStatus, deriveOrderPaymentStatus } from "./status";
import { matchBogDetailsToLocal } from "./match";
import { bogCreateOrderResponseSchema, canonicalizeBogPaymentDetails, bogPaymentDetailsSchema } from "./schemas";
import { isOnlineBogMethod, supportsBogPartialRefund, isSplitCompatibleMethod, supportsPreauthorization } from "@/server/payments/methods";
import { supportsPartialRefund, remainingRefundableTetri } from "@/server/payments/refundable";
import {
  bogApplePayAcceptUrl,
  bogAutomaticSavedCardPaymentUrl,
  bogDeleteSavedCardUrl,
  bogEcommerceOrdersUrl,
  bogPaymentDetailsUrl,
  bogPreauthApproveUrl,
  bogPreauthRejectUrl,
  bogRefundUrl,
  bogSaveAutomaticCardUrl,
  bogSaveRecurrentCardUrl,
  bogSavedCardEnrollUrl,
  bogSavedCardPaymentUrl,
} from "./endpoints";
import {
  automaticChargeWorkflowAllowed,
  BOG_REQUEST_RECEIVED,
  hasInFlightProviderAction,
  refundReversesExecutedSplit,
  resolveCaptureMode,
  resolveCreateOrderPaymentMethods,
  savedCardConsentFromType,
  savedMethodOwnedBy,
} from "./policy";

describe("BOG response codes", () => {
  it("covers every documented payment and action code", () => {
    assert.deepEqual(DOCUMENTED_PAYMENT_CODES.sort(), ["100","101","102","103","104","105","106","107","108","109","110","111","112","122","199","200"]);
    assert.deepEqual(DOCUMENTED_ACTION_CODES.sort(), ["161","162","163","164","165","166","167","168","169","179"]);
  });

  it("maps success vs unknown without treating unknown as permanent failure", () => {
    const ok = classifyBogPaymentCode("100");
    assert.equal(ok.success, true);
    assert.equal(ok.known, true);
    const unknown = classifyBogPaymentCode("999");
    assert.equal(unknown.known, false);
    assert.equal(unknown.retryable, null);
    assert.equal(unknown.customerMessageKa.includes("დაზუსტებას"), true);
    const funds = classifyBogPaymentCode(107);
    assert.equal(funds.retryable, true);
    const actionUnknown = classifyBogActionCode("179");
    assert.equal(actionUnknown.known, true);
    assert.equal(actionUnknown.retryable, null);
  });
});

describe("split validation", () => {
  it("rejects more than 10 destinations and mixed amount+percent", () => {
    const tooMany = validateBogSplitPayments({
      entries: Array.from({ length: BOG_SPLIT_MAX_ENTRIES + 1 }, () => ({ iban: "GE29NB0000000101904917", percent: 1 })),
      currency: "GEL",
      paymentMethod: "card",
    });
    assert.equal(tooMany.ok, false);
    if (!tooMany.ok) assert.equal(tooMany.code, "too_many");

    const both = validateBogSplitPayments({
      entries: [{ iban: "GE29NB0000000101904917", amount: 10, percent: 10 }],
      currency: "GEL",
    });
    assert.equal(both.ok, false);
    if (!both.ok) assert.equal(both.code, "amount_and_percent");
  });

  it("rejects USD and incompatible methods, accepts percent split", () => {
    const usd = validateBogSplitPayments({
      entries: [{ iban: "GE29NB0000000101904917", percent: 40 }],
      currency: "USD",
    });
    assert.equal(usd.ok, false);
    const loan = validateBogSplitPayments({
      entries: [{ iban: "GE29NB0000000101904917", percent: 40 }],
      currency: "GEL",
      paymentMethod: "bog_loan",
    });
    assert.equal(loan.ok, false);
    const ok = validateBogSplitPayments({
      entries: [
        { iban: "GE29NB0000000101904917", percent: 40 },
        { iban: "GE11TB0000000000000001", percent: 60, description: "partner" },
      ],
      currency: "GEL",
      paymentMethod: "card",
    });
    assert.equal(ok.ok, true);
  });

  it("rejects split amounts above partial capture", () => {
    const result = validateBogSplitPayments({
      entries: [{ iban: "GE29NB0000000101904917", amount: 80 }],
      currency: "GEL",
      paymentMethod: "card",
      captureAmount: 50,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "amount_sum");
  });
});

describe("create-order payload extensions", () => {
  const base = {
    callbackUrl: "https://luma.example/api/payments/bog/callback",
    externalOrderId: "LUMA-1",
    successUrl: "https://luma.example/ok",
    failUrl: "https://luma.example/fail",
    currency: "GEL",
    total: "10.00",
    discount: "0",
    deliveryFee: "0",
    items: [{ productId: "p", productName: "Phone", quantity: 1, unitPrice: "10.00", lineTotal: "10.00" }],
  };

  it("keeps standard card automatic capture by default", () => {
    const body = buildBogCreateOrderBody(base);
    assert.equal(body.capture, "automatic");
    assert.deepEqual(body.payment_method, ["card"]);
    assert.equal(body.config, undefined);
  });

  it("builds hosted google pay, external google pay, apple pay, loan, and split configs", () => {
    const hosted = buildBogCreateOrderBody({ ...base, paymentMethods: ["card", "google_pay"] });
    assert.deepEqual(hosted.payment_method, ["card", "google_pay"]);

    const gpay = buildBogCreateOrderBody({
      ...base,
      paymentMethods: ["google_pay"],
      config: { google_pay: { external: true, google_pay_token: "{\"signature\":\"x\"}" } },
    });
    assert.equal(gpay.config?.google_pay?.external, true);
    assert.equal(gpay.config?.google_pay?.google_pay_token, "{\"signature\":\"x\"}");

    const apple = buildBogCreateOrderBody({
      ...base,
      paymentMethods: ["apple_pay"],
      applicationType: "web",
      config: { apple_pay: { external: true } },
    });
    assert.equal(apple.application_type, "web");
    assert.equal(apple.config?.apple_pay?.external, true);

    const loan = buildBogCreateOrderBody({
      ...base,
      paymentMethods: ["bog_loan"],
      config: { loan: { month: 12, type: "DISC" } },
    });
    assert.equal(loan.config?.loan?.month, 12);
    assert.equal(loan.config?.loan?.type, "DISC");

    const bnpl = buildBogCreateOrderBody({
      ...base,
      paymentMethods: ["bnpl"],
      config: { loan: { month: 4, type: "BNPL" } },
    });
    assert.deepEqual(bnpl.payment_method, ["bnpl"]);
    assert.equal(bnpl.config?.loan?.month, 4);
    assert.equal(bnpl.config?.loan?.type, "BNPL");

    const split = buildBogCreateOrderBody({
      ...base,
      capture: "manual",
      config: { split: { split_payments: [{ iban: "GE29NB0000000101904917", percent: 50 }] } },
    });
    assert.equal(split.capture, "manual");
    assert.equal(split.config?.split?.split_payments[0]?.percent, 50);
  });
});

describe("preauthorization status mapping", () => {
  it("maps blocked to authorized and partial_completed to paid", () => {
    assert.equal(mapBogStatusToAttempt("blocked"), "authorized");
    assert.equal(mapBogStatusToAttempt("partial_completed"), "paid");
    assert.equal(mapBogStatusToAttempt("auth_requested"), "processing");
    assert.equal(deriveOrderPaymentStatus([{ status: "authorized" }]), "authorized");
    assert.equal(shouldApplyAttemptStatus("authorized", "paid"), true);
    assert.equal(shouldApplyAttemptStatus("paid", "authorized"), false);
    assert.equal(shouldApplyAttemptStatus("voided", "paid"), false);
  });
});

describe("payment details for new methods", () => {
  it("accepts saved-card and split fields and google pay 3DS create response without forcing PAID", () => {
    const details = bogPaymentDetailsSchema.parse({
      order_id: "ord-1",
      capture: "manual",
      external_order_id: "LUMA-1",
      order_status: { key: "blocked", value: "blocked" },
      purchase_units: { request_amount: "10.00", transfer_amount: "0", currency_code: "GEL" },
      payment_detail: {
        transfer_method: { key: "apple_pay" },
        saved_card_type: "recurrent",
        parent_order_id: "parent-1",
        payment_option: "recurrent",
        payer_identifier: "548888xxxxxx9893",
        code: "200",
      },
      split: { split_status: "created", currency: "GEL" },
    });
    const canonical = canonicalizeBogPaymentDetails(details);
    assert.equal(canonical.payment_detail?.saved_card_type, "recurrent");
    assert.equal(canonical.split?.split_status, "created");

    const created = bogCreateOrderResponseSchema.parse({
      id: "gpay-1",
      status: "processing",
      _links: {
        details: { href: "https://api.bog.ge/payments/v1/receipt/gpay-1" },
        redirect: { href: "https://payment.bog.ge/api/3ds/post-form?x=1" },
      },
    });
    assert.equal(created.status, "processing");
    assert.ok(created._links?.redirect?.href?.includes("3ds"));

    const apple = bogCreateOrderResponseSchema.parse({
      id: "ap-1",
      result: { countryCode: "GE" },
      _links: { accept: { href: "https://api.bog.ge/payments/v1/ecommerce/orders/ap-1/payment" } },
    });
    assert.ok(apple._links?.accept?.href?.endsWith("/payment"));
  });

  it("allows partial capture transfer below request amount", () => {
    const details = canonicalizeBogPaymentDetails(
      bogPaymentDetailsSchema.parse({
        order_id: "ord-1",
        external_order_id: "LUMA-1",
        order_status: { key: "partial_completed" },
        purchase_units: { request_amount: "100.00", transfer_amount: "40.00", currency_code: "GEL" },
      }),
    );
    const match = matchBogDetailsToLocal(details, {
      providerOrderId: "ord-1",
      amount: new Prisma.Decimal("100.00"),
      currency: "GEL",
      orderNumber: "LUMA-1",
    });
    assert.equal(match.ok, true);
  });
});

describe("method compatibility", () => {
  it("treats wallet and loan methods as online BOG checkout", () => {
    assert.equal(isOnlineBogMethod("card"), true);
    assert.equal(isOnlineBogMethod("google_pay"), true);
    assert.equal(isOnlineBogMethod("apple_pay"), true);
    assert.equal(isOnlineBogMethod("bog_loan"), true);
    assert.equal(isOnlineBogMethod("installment"), false);
    assert.equal(supportsBogPartialRefund("apple_pay"), true);
    assert.equal(supportsPartialRefund("google_pay"), true);
    assert.equal(supportsPartialRefund("bog_loan"), false);
    assert.equal(isSplitCompatibleMethod("bog_p2p"), true);
    assert.equal(isSplitCompatibleMethod("bnpl"), false);
    assert.equal(supportsPreauthorization("card"), true);
    assert.equal(supportsPreauthorization("bog_loan"), false);
  });
});

describe("documented BOG endpoints", () => {
  it("matches official paths for every Payments module that has an HTTP API", () => {
    const base = "https://api.bog.ge";
    assert.equal(bogEcommerceOrdersUrl(base), "https://api.bog.ge/payments/v1/ecommerce/orders");
    assert.equal(bogPaymentDetailsUrl(base, "ord-1"), "https://api.bog.ge/payments/v1/receipt/ord-1");
    assert.equal(bogRefundUrl(base, "ord-1"), "https://api.bog.ge/payments/v1/payment/refund/ord-1");
    assert.equal(bogSaveRecurrentCardUrl(base, "ord-1"), "https://api.bog.ge/payments/v1/orders/ord-1/cards");
    assert.equal(bogSaveAutomaticCardUrl(base, "ord-1"), "https://api.bog.ge/payments/v1/orders/ord-1/subscriptions");
    assert.equal(bogDeleteSavedCardUrl(base, "parent-1"), "https://api.bog.ge/payments/v1/charges/card/parent-1");
    assert.equal(bogSavedCardPaymentUrl(base, "parent-1"), "https://api.bog.ge/payments/v1/ecommerce/orders/parent-1");
    assert.equal(
      bogAutomaticSavedCardPaymentUrl(base, "parent-1"),
      "https://api.bog.ge/payments/v1/ecommerce/orders/parent-1/subscribe",
    );
    assert.equal(
      bogPreauthApproveUrl(base, "ord-1"),
      "https://api.bog.ge/payments/v1/payment/authorization/approve/ord-1",
    );
    assert.equal(
      bogPreauthRejectUrl(base, "ord-1"),
      "https://api.bog.ge/payments/v1/payment/authorization/cancel/ord-1",
    );
    assert.equal(
      bogApplePayAcceptUrl(base, "ord-1"),
      "https://api.bog.ge/payments/v1/ecommerce/orders/ord-1/payment",
    );
    assert.equal(bogSavedCardEnrollUrl(base, "ord-1", "recurrent").endsWith("/cards"), true);
    assert.equal(bogSavedCardEnrollUrl(base, "ord-1", "subscription").endsWith("/subscriptions"), true);
  });
});

describe("saved-card consent and ownership", () => {
  it("does not treat recurrent save as automatic-charge permission", () => {
    assert.equal(savedCardConsentFromType("recurrent"), "recurrent");
    assert.equal(savedCardConsentFromType("subscription"), "subscription");
    assert.equal(savedCardConsentFromType("card"), null);
    assert.equal(automaticChargeWorkflowAllowed({ automaticChargeWorkflow: false, savedCardAutomatic: true }), false);
    assert.equal(automaticChargeWorkflowAllowed({ automaticChargeWorkflow: true, savedCardAutomatic: false }), false);
    assert.equal(automaticChargeWorkflowAllowed({ automaticChargeWorkflow: true, savedCardAutomatic: true }), true);
  });

  it("rejects delete/charge of another customer's saved method", () => {
    const owned = { customerId: "c1", deletedAt: null };
    assert.equal(savedMethodOwnedBy(owned, "c1"), true);
    assert.equal(savedMethodOwnedBy(owned, "c2"), false);
    assert.equal(savedMethodOwnedBy({ customerId: "c1", deletedAt: new Date() }, "c1"), false);
    assert.equal(savedMethodOwnedBy(null, "c1"), false);
  });
});

describe("preauthorization policy", () => {
  it("uses manual capture only for documented methods when the merchant flag is on", () => {
    assert.equal(resolveCaptureMode({ method: "card", preauthorizationEnabled: true }), "manual");
    assert.equal(resolveCaptureMode({ method: "google_pay", preauthorizationEnabled: true }), "manual");
    assert.equal(resolveCaptureMode({ method: "apple_pay", preauthorizationEnabled: true }), "manual");
    assert.equal(resolveCaptureMode({ method: "bog_loan", preauthorizationEnabled: true }), "automatic");
    assert.equal(resolveCaptureMode({ method: "card", preauthorizationEnabled: false }), "automatic");
    assert.equal(resolveCaptureMode({ method: "card", preauthorizationEnabled: true, explicit: "automatic" }), "automatic");
  });

  it("blocks duplicate capture/reject while request_received is in flight", () => {
    const inflight = [{ type: "capture", status: "accepted" }];
    assert.equal(hasInFlightProviderAction(inflight, ["capture", "reject_authorization"]), true);
    assert.equal(hasInFlightProviderAction([{ type: "capture", status: "failed" }], ["capture"]), false);
    assert.equal(BOG_REQUEST_RECEIVED, "request_received");
  });
});

describe("split and refund independence", () => {
  it("does not treat refund as reversing an executed partner split", () => {
    assert.equal(refundReversesExecutedSplit(), false);
    const remaining = remainingRefundableTetri({
      paymentAmount: "100.00",
      paymentStatus: "paid",
      refunds: [],
    });
    assert.equal(remaining, 10000);
  });
});

describe("create-order payment_method selection", () => {
  const caps = {
    hostedGooglePay: true,
    hostedApplePay: false,
    hostedP2p: false,
    hostedLoyalty: false,
    hostedGiftCard: false,
  };

  it("keeps hosted card+google_pay for standard card and isolates webpage/loan methods", () => {
    assert.deepEqual(resolveCreateOrderPaymentMethods({ method: "card", caps }), ["card", "google_pay"]);
    assert.deepEqual(resolveCreateOrderPaymentMethods({ method: "google_pay", caps }), ["google_pay"]);
    assert.deepEqual(resolveCreateOrderPaymentMethods({ method: "apple_pay", caps }), ["apple_pay"]);
    assert.deepEqual(resolveCreateOrderPaymentMethods({ method: "bog_loan", caps }), ["bog_loan"]);
    assert.deepEqual(resolveCreateOrderPaymentMethods({ method: "bnpl", caps }), ["bnpl"]);
  });

  it("adds only flagged hosted methods on Card checkout and never loan/BNPL", () => {
    const flagsOff = {
      hostedGooglePay: false,
      hostedApplePay: false,
      hostedP2p: false,
      hostedLoyalty: false,
      hostedGiftCard: false,
    };
    assert.deepEqual(resolveCreateOrderPaymentMethods({ method: "card", caps: flagsOff }), ["card"]);
    assert.deepEqual(
      resolveCreateOrderPaymentMethods({
        method: "card",
        caps: {
          hostedGooglePay: true,
          hostedApplePay: true,
          hostedP2p: true,
          hostedLoyalty: true,
          hostedGiftCard: false,
        },
      }),
      ["card", "google_pay", "apple_pay", "bog_p2p", "bog_loyalty"],
    );
  });
});


