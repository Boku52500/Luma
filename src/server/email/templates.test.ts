import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNoPrematurePaidCopy,
  containsUnsafeRawHtml,
  orderConfirmationCopy,
  renderOrderConfirmationEmail,
  renderOrderStatusEmail,
  renderPasswordResetEmail,
  renderPaymentPaidEmail,
  renderRefundEmail,
  type OrderEmailSnapshot,
} from "./templates";

const CTA = { href: "https://luma.ge/checkout/success", label: "შეკვეთის ნახვა" };

function snapshot(over: Partial<OrderEmailSnapshot> = {}): OrderEmailSnapshot {
  return {
    orderNumber: "LUMA-1001",
    firstName: "ნინო",
    customerEmail: "guest@example.com",
    paymentMethod: "card",
    paymentStatus: "pending",
    deliveryMethod: "standard",
    city: "tbilisi",
    street: "რუსთაველის 1",
    items: [{ productName: "iPhone 15 Pro", quantity: 1, unitPrice: 3299, lineTotal: 3299 }],
    subtotal: 3299,
    discount: 0,
    deliveryFee: 10,
    total: 3309,
    ...over,
  };
}

describe("password reset email", () => {
  it("uses the Georgian subject and the real reset URL", () => {
    const url = "https://luma.ge/reset-password?token=abc.def";
    const rendered = renderPasswordResetEmail({ resetUrl: url });
    assert.equal(rendered.subject, "Luma — პაროლის აღდგენა");
    assert.match(rendered.html, /პაროლის აღდგენა/);
    assert.match(rendered.html, /https:\/\/luma\.ge\/reset-password\?token=abc\.def/);
    assert.match(rendered.text, /https:\/\/luma\.ge\/reset-password\?token=abc\.def/);
  });
});

describe("order confirmation", () => {
  it("includes snapshot items and totals, not live catalogue prices", () => {
    const rendered = renderOrderConfirmationEmail(
      snapshot({
        items: [{ productName: "Snapshot Phone", quantity: 2, unitPrice: 10, lineTotal: 20 }],
        subtotal: 20,
        discount: 5,
        promoCode: "SAVE5",
        deliveryFee: 4,
        total: 19,
      }),
      CTA,
    );
    assert.equal(rendered.subject, "შეკვეთა მიღებულია — LUMA-1001");
    assert.match(rendered.html, /Snapshot Phone × 2/);
    assert.match(rendered.html, /SAVE5/);
    assert.match(rendered.text, /LUMA-1001/);
  });

  it("does not say the card order is paid at creation", () => {
    const copy = orderConfirmationCopy("card");
    assert.match(copy.body, /ბარათით გადახდის დასრულების შემდეგ/);
    const rendered = renderOrderConfirmationEmail(snapshot({ paymentMethod: "card", paymentStatus: "pending" }), CTA);
    assert.equal(assertNoPrematurePaidCopy(rendered.html, "card"), true);
    assert.equal(rendered.html.includes("გადახდა დადასტურებულია"), false);
  });
});

describe("payment and refund templates", () => {
  it("uses paid amount and Georgian paid subject", () => {
    const rendered = renderPaymentPaidEmail(snapshot(), { amount: 3309, paidAt: new Date("2026-08-27T12:00:00Z") }, CTA);
    assert.equal(rendered.subject, "გადახდა დადასტურებულია — LUMA-1001");
    assert.match(rendered.html, /3 309 ₾/);
  });

  it("uses distinct partial vs full refund subjects", () => {
    const partial = renderRefundEmail(snapshot({ paymentStatus: "partially_refunded" }), {
      kind: "partial",
      refundedAmount: 10,
      cumulativeAmount: 10,
    }, CTA);
    const full = renderRefundEmail(snapshot({ paymentStatus: "refunded" }), {
      kind: "full",
      refundedAmount: 3309,
      cumulativeAmount: 3309,
    }, CTA);
    assert.equal(partial.subject, "თანხის ნაწილი დაბრუნებულია — LUMA-1001");
    assert.equal(full.subject, "თანხა დაბრუნებულია — LUMA-1001");
  });
});

describe("order status templates", () => {
  it("uses Georgian subjects for fulfillment transitions", () => {
    assert.equal(renderOrderStatusEmail(snapshot(), "processing", CTA).subject, "თქვენი შეკვეთა მუშავდება — LUMA-1001");
    assert.equal(renderOrderStatusEmail(snapshot(), "shipped", CTA).subject, "თქვენი შეკვეთა გაიგზავნა — LUMA-1001");
    assert.equal(renderOrderStatusEmail(snapshot(), "delivered", CTA).subject, "შეკვეთა ჩაბარდა — LUMA-1001");
    assert.equal(renderOrderStatusEmail(snapshot(), "cancelled", CTA).subject, "შეკვეთა გაუქმებულია — LUMA-1001");
  });
});

describe("HTML escaping", () => {
  it("escapes names, addresses, and notes", () => {
    const payload = "<script>alert(1)</script>";
    const rendered = renderOrderConfirmationEmail(
      snapshot({
        firstName: payload,
        street: payload,
        additionalInfo: '<img src=x onerror=alert(1)>',
        items: [{ productName: payload, quantity: 1, unitPrice: 1, lineTotal: 1 }],
      }),
      CTA,
    );
    assert.equal(rendered.html.includes(payload), false);
    assert.equal(containsUnsafeRawHtml(rendered.html, payload), false);
    assert.match(rendered.html, /&lt;script&gt;/);
    assert.equal(rendered.html.includes("<script>"), false);
  });
});
