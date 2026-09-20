import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapBogStatusToAttempt } from "./status";
import { matchBogDetailsToLocal } from "./match";
import {
  bogCallbackEnvelopeSchema,
  bogPaymentDetailsSchema,
  bogZodIssues,
  canonicalizeBogPaymentDetails,
} from "./schemas";

/** Official documented payment-details sample (GET /payments/v1/receipt/:order_id). */
const officialReceiptSample = {
  order_id: "a767a276-cddd-43ec-9db3-9f9b39eee02d",
  industry: "ecommerce",
  capture: "automatic",
  external_order_id: "123456",
  client: {
    id: "10000",
    brand_ka: "საქართველოს ბანკი",
    brand_en: "BOG",
    url: "https://api.bog.ge",
  },
  create_date: "2022-11-01T13:19:43.021178",
  zoned_create_date: "2022-11-01T13:19:43.021178Z",
  expire_date: "2022-11-01T13:39:43.021178",
  zoned_expire_date: "2022-11-01T13:39:43.021178Z",
  order_status: {
    key: "refunded",
    value: "დაბრუნებული",
  },
  buyer: {
    full_name: "John Doe",
    email: "johndoe@gmail.com",
    phone_number: "+995555000000",
  },
  purchase_units: {
    request_amount: "100.5",
    transfer_amount: "0.0",
    refund_amount: "100.5",
    currency_code: "GEL",
    items: [
      {
        external_item_id: "id_1",
        description: "product 1",
        quantity: "1",
        unit_price: "25.35",
        unit_discount_price: "0",
        vat: "0",
        vat_percent: "0",
        total_price: "25.35",
        package_code: "A000123",
        tin: null,
        pinfl: null,
        product_discount_id: "BF222R5",
      },
    ],
  },
  redirect_links: {
    success: "https://payment.bog.ge/receipt?order_id=a767a276-cddd-43ec-9db3-9f9b39eee02d",
    fail: "https://payment.bog.ge/receipt?order_id=a767a276-cddd-43ec-9db3-9f9b39eee02d",
  },
  payment_detail: {
    transfer_method: {
      key: "card",
      value: "ბარათით გადახდა",
    },
    code: "100",
    code_description: "Successful payment",
    transaction_id: "230513868679",
    payer_identifier: "548888xxxxxx9893",
    payment_option: "direct_debit",
    card_type: "mc",
    card_expiry_date: "03/24",
    request_account_tag: "1212",
    transfer_account_tag: "gev2",
    saved_card_type: "recurrent",
    parent_order_id: "8d52130d-cb1b-45ea-b048-0f040a44e2a3",
    pg_trx_id: "K4T2XMAZ9EBVQ3WN",
    auth_code: "483921",
  },
  discount: {
    bank_discount_amount: "string",
    bank_discount_desc: "string",
    discounted_amount: "string",
    original_order_amount: "string",
    system_discount_amount: "string",
    system_discount_desc: "string",
  },
  actions: [
    {
      action_id: "b70968ca-eda9-47ae-8811-26fd1ab733f8",
      request_channel: "public_api",
      action: "authorize",
      status: "completed",
      action_date: "2022-11-28T13:42:40.668439",
      zoned_action_date: "2022-11-28T13:42:40.668439Z",
      amount: "100.5",
      code: null,
      code_description: null,
    },
  ],
  disputes: null,
  split: null,
  lang: "ka",
  reject_reason: null,
};

const completedCardPayment = {
  order_id: "bog-completed-1",
  external_order_id: "LUMA-1",
  capture: "automatic",
  order_status: { key: "completed", value: "გადახდილი" },
  purchase_units: {
    request_amount: "10.90",
    transfer_amount: "10.90",
    refund_amount: "0.0",
    currency_code: "GEL",
    items: [],
  },
  payment_detail: {
    transfer_method: { key: "card", value: "ბარათით გადახდა" },
    transaction_id: "230513868679",
    auth_code: "483921",
    code: "100",
    code_description: "Successful payment",
    payment_option: "direct_debit",
    card_type: "mc",
  },
  reject_reason: null,
};

describe("bogPaymentDetailsSchema", () => {
  it("accepts the official documented receipt sample", () => {
    const parsed = bogPaymentDetailsSchema.safeParse(officialReceiptSample);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const data = canonicalizeBogPaymentDetails(parsed.data);
    assert.equal(data.order_id, "a767a276-cddd-43ec-9db3-9f9b39eee02d");
    assert.equal(data.order_status.key, "refunded");
    assert.equal(data.purchase_units?.refund_amount, "100.5");
    assert.equal(data.actions?.[0]?.action_id, "b70968ca-eda9-47ae-8811-26fd1ab733f8");
    assert.equal(data.payment_detail?.transfer_method?.key, "card");
    assert.equal(data.payment_detail?.transaction_id, "230513868679");
    assert.equal(data.reject_reason, undefined);
  });

  it("maps a completed card payment to paid and matches local money", () => {
    const parsed = bogPaymentDetailsSchema.safeParse(completedCardPayment);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const data = canonicalizeBogPaymentDetails(parsed.data);
    assert.equal(data.order_status.key, "completed");
    assert.equal(mapBogStatusToAttempt(data.order_status.key), "paid");
    assert.equal(data.payment_detail?.transfer_method?.key, "card");
    assert.equal(data.payment_detail?.code, "100");
    assert.equal(
      matchBogDetailsToLocal(data, {
        providerOrderId: "bog-completed-1",
        amount: "10.90",
        currency: "GEL",
        orderNumber: "LUMA-1",
      }).ok,
      true,
    );
    assert.equal(
      matchBogDetailsToLocal(data, {
        providerOrderId: "bog-completed-1",
        amount: "10.9",
        currency: "GEL",
        orderNumber: "LUMA-1",
      }).ok,
      true,
    );
  });

  it("accepts a processing payment with null optional payment fields", () => {
    const parsed = bogPaymentDetailsSchema.safeParse({
      order_id: "bog-processing-1",
      external_order_id: "LUMA-1",
      order_status: { key: "processing", value: null },
      purchase_units: {
        request_amount: "289.00",
        transfer_amount: "0.0",
        refund_amount: null,
        currency_code: "GEL",
      },
      payment_detail: {
        transfer_method: { key: "card", value: "ბარათით გადახდა" },
        transaction_id: null,
        auth_code: null,
        code: null,
        code_description: null,
        payment_option: null,
        card_type: null,
      },
      reject_reason: null,
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const data = canonicalizeBogPaymentDetails(parsed.data);
    assert.equal(data.order_status.key, "processing");
    assert.equal(mapBogStatusToAttempt(data.order_status.key), "processing");
    assert.equal(data.payment_detail?.transaction_id, undefined);
    assert.equal(data.payment_detail?.code, undefined);
  });

  it("accepts a rejected payment", () => {
    const parsed = bogPaymentDetailsSchema.safeParse({
      order_id: "bog-rejected-1",
      external_order_id: "LUMA-1",
      order_status: { key: "rejected", value: "უარყოფილი" },
      purchase_units: {
        request_amount: "10.90",
        transfer_amount: "0.0",
        currency_code: "GEL",
      },
      payment_detail: {
        transfer_method: { key: "card" },
        code: "105",
        code_description: "Insufficient funds",
      },
      reject_reason: "unknown",
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const data = canonicalizeBogPaymentDetails(parsed.data);
    assert.equal(mapBogStatusToAttempt(data.order_status.key), "failed");
    assert.equal(data.reject_reason, "unknown");
    assert.equal(data.payment_detail?.code, "105");
  });

  it("accepts monetary strings, numeric codes, and a string transfer_method", () => {
    const parsed = bogPaymentDetailsSchema.safeParse({
      order_id: "bog-loose-1",
      external_order_id: "LUMA-1",
      order_status: "completed",
      purchase_units: {
        request_amount: "10.90",
        transfer_amount: 10.9,
        currency_code: "GEL",
      },
      payment_detail: {
        transfer_method: "card",
        transaction_id: 230513868679,
        auth_code: 483921,
        code: 100,
        code_description: "Successful payment",
      },
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const data = canonicalizeBogPaymentDetails(parsed.data);
    assert.equal(data.order_status.key, "completed");
    assert.equal(data.payment_detail?.transfer_method?.key, "card");
    assert.equal(data.payment_detail?.code, "100");
    assert.equal(data.payment_detail?.auth_code, "483921");
    assert.equal(data.purchase_units?.transfer_amount, "10.90");
  });
});

describe("bogCallbackEnvelopeSchema", () => {
  it("parses the documented wrapper and exposes body for reconciliation", () => {
    const parsed = bogCallbackEnvelopeSchema.safeParse({
      event: "order_payment",
      zoned_request_time: "2022-11-23T18:06:37.240559Z",
      body: completedCardPayment,
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const body = canonicalizeBogPaymentDetails(parsed.data.body);
    assert.equal(parsed.data.event, "order_payment");
    assert.equal(body.order_id, "bog-completed-1");
    assert.equal(body.order_status.key, "completed");
    assert.equal(mapBogStatusToAttempt(body.order_status.key), "paid");
    assert.equal(
      matchBogDetailsToLocal(body, {
        providerOrderId: "bog-completed-1",
        amount: "10.90",
        currency: "GEL",
        orderNumber: "LUMA-1",
      }).ok,
      true,
    );
  });

  it("parses refunded_partially callback bodies for reconciliation", () => {
    const parsed = bogCallbackEnvelopeSchema.safeParse({
      event: "order_payment",
      zoned_request_time: "2022-11-23T18:06:37.240559Z",
      body: {
        ...completedCardPayment,
        order_status: { key: "refunded_partially", value: "ნაწილობრივ დაბრუნებული" },
        purchase_units: {
          ...completedCardPayment.purchase_units,
          transfer_amount: "5.40",
          refund_amount: "5.50",
        },
      },
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const body = canonicalizeBogPaymentDetails(parsed.data.body);
    assert.equal(mapBogStatusToAttempt(body.order_status.key), "partially_refunded");
    assert.equal(body.purchase_units?.refund_amount, "5.50");
  });

  it("parses refund_requested callback bodies without treating them as paid/refunded", () => {
    const parsed = bogCallbackEnvelopeSchema.safeParse({
      event: "order_payment",
      zoned_request_time: "2022-11-23T18:06:37.240559Z",
      body: {
        ...completedCardPayment,
        order_status: { key: "refund_requested", value: "დაბრუნება მოთხოვნილია" },
      },
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const body = canonicalizeBogPaymentDetails(parsed.data.body);
    assert.equal(mapBogStatusToAttempt(body.order_status.key), "processing");
  });

  it("rejects a root-level payment object that is not wrapped", () => {
    const parsed = bogCallbackEnvelopeSchema.safeParse(completedCardPayment);
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    const paths = bogZodIssues(parsed.error).map((issue) => issue.path);
    assert.equal(paths.includes("body") || paths.includes("event") || paths.includes("zoned_request_time"), true);
  });

  it("rejects an empty callback body", () => {
    const parsed = bogCallbackEnvelopeSchema.safeParse({
      event: "order_payment",
      zoned_request_time: "2022-11-23T18:06:37.240559Z",
      body: {},
    });
    assert.equal(parsed.success, false);
  });
});

describe("bogZodIssues", () => {
  it("reports path and type without received values", () => {
    const parsed = bogPaymentDetailsSchema.safeParse({ order_id: "x" });
    assert.equal(parsed.success, false);
    if (parsed.success) return;
    const issues = bogZodIssues(parsed.error);
    assert.equal(issues.length > 0, true);
    assert.equal(
      issues.some((issue) => issue.path.includes("order_status")),
      true,
    );
    const serialized = JSON.stringify(issues);
    assert.equal(serialized.includes("548888"), false);
  });
});
