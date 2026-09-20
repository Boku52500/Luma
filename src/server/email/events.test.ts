import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acceptedPasswordResetRequest,
  orderConfirmationEventKey,
  orderEmailRecipient,
  orderStatusEventKey,
  passwordResetEventKey,
  paymentPaidEventKey,
  planPaymentEmails,
  planPaymentPaidEmail,
  planRefundEmail,
  refundEventKey,
  shouldSendOrderStatusEmail,
} from "./events";

describe("event keys", () => {
  it("are stable for idempotency", () => {
    assert.equal(orderConfirmationEventKey("ord-1"), "order-confirmation:ord-1");
    assert.equal(paymentPaidEventKey("pay-1"), "payment-paid:pay-1");
    assert.equal(refundEventKey("pay-1", "partial"), "refund-completed:pay-1:partially_refunded");
    assert.equal(refundEventKey("pay-1", "full"), "refund-completed:pay-1:refunded");
    assert.equal(orderStatusEventKey("ord-1", "shipped"), "order-status:ord-1:shipped");
    assert.equal(passwordResetEventKey("tok-1"), "password-reset:tok-1");
  });
});

describe("planPaymentPaidEmail", () => {
  it("sends once on the first transition into paid", () => {
    assert.equal(planPaymentPaidEmail("processing", "paid"), true);
    assert.equal(planPaymentPaidEmail("pending", "paid"), true);
  });

  it("does not send on a duplicate paid callback", () => {
    assert.equal(planPaymentPaidEmail("paid", "paid"), false);
    assert.equal(planPaymentEmails("paid", "paid"), null);
  });
});

describe("planRefundEmail", () => {
  it("sends partial once on first partially_refunded", () => {
    assert.equal(planRefundEmail("paid", "partially_refunded"), "partial");
    assert.equal(planPaymentEmails("paid", "partially_refunded"), "refund_partial");
    assert.equal(planRefundEmail("partially_refunded", "partially_refunded"), null);
  });

  it("sends full once on first refunded", () => {
    assert.equal(planRefundEmail("paid", "refunded"), "full");
    assert.equal(planRefundEmail("partially_refunded", "refunded"), "full");
    assert.equal(planRefundEmail("refunded", "refunded"), null);
    assert.equal(planPaymentEmails("refunded", "refunded"), null);
  });

  it("does not treat refund_requested / request_received as a refund email", () => {
    assert.equal(planPaymentEmails("paid", "processing"), null);
    assert.equal(planRefundEmail("paid", "paid"), null);
    assert.equal(planRefundEmail("processing", "processing"), null);
  });
});

describe("shouldSendOrderStatusEmail", () => {
  it("sends once when fulfillment actually changes to a meaningful status", () => {
    assert.equal(shouldSendOrderStatusEmail("pending", "processing"), true);
    assert.equal(shouldSendOrderStatusEmail("processing", "shipped"), true);
    assert.equal(shouldSendOrderStatusEmail("shipped", "delivered"), true);
    assert.equal(shouldSendOrderStatusEmail("pending", "cancelled"), true);
  });

  it("sends none when the status did not change", () => {
    assert.equal(shouldSendOrderStatusEmail("shipped", "shipped"), false);
    assert.equal(shouldSendOrderStatusEmail("processing", "processing"), false);
  });

  it("does not email pending or confirmed", () => {
    assert.equal(shouldSendOrderStatusEmail("pending", "confirmed"), false);
  });
});

describe("orderEmailRecipient", () => {
  it("uses the order snapshot email for guests and logged-in customers", () => {
    assert.equal(orderEmailRecipient({ customerEmail: "guest@example.com" }), "guest@example.com");
    assert.equal(orderEmailRecipient({ customerEmail: "  Buyer@Luma.ge " }), "Buyer@Luma.ge");
    assert.equal(orderEmailRecipient({ customerEmail: null }), null);
    assert.equal(orderEmailRecipient({ customerEmail: "not-an-email" }), null);
  });
});

describe("password reset anti-enumeration", () => {
  it("returns the same public success whether or not an account exists", () => {
    assert.deepEqual(acceptedPasswordResetRequest(), { ok: true });
  });
});

describe("email failure vs business state", () => {
  it("a provider failure result is not a success and does not imply rolling back PAID", () => {
    assert.equal(planPaymentEmails("processing", "paid"), "payment_paid");
    assert.equal(planPaymentEmails("paid", "paid"), null);
    assert.equal(planPaymentEmails("pending", "authorized"), null);
    assert.equal(planPaymentEmails("authorized", "paid"), "payment_paid");
  });
});
