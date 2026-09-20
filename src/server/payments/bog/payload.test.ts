import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@/generated/prisma/client";
import { amountsMatch, buildBogCreateOrderBody, parseBogAmount } from "./payload";

describe("buildBogCreateOrderBody", () => {
  it("maps Luma order fields to documented BOG keys", () => {
    const body = buildBogCreateOrderBody({
      callbackUrl: "https://luma.example/api/payments/bog/callback",
      externalOrderId: "LUMA-TEST-1",
      successUrl: "https://luma.example/checkout/payment/success?order=LUMA-TEST-1",
      failUrl: "https://luma.example/checkout/payment/fail?order=LUMA-TEST-1",
      currency: "GEL",
      total: "12.50",
      discount: "1.50",
      deliveryFee: "5.00",
      items: [
        {
          productId: "p-1",
          productName: "iPhone",
          quantity: 2,
          unitPrice: "4.00",
          lineTotal: "8.00",
        },
      ],
      buyerName: "ნინო კაპანაძე",
    });

    assert.equal(body.callback_url, "https://luma.example/api/payments/bog/callback");
    assert.equal(body.external_order_id, "LUMA-TEST-1");
    assert.deepEqual(body.payment_method, ["card"]);
    assert.equal(body.capture, "automatic");
    assert.equal(body.purchase_units.currency, "GEL");
    assert.equal(body.purchase_units.total_amount, 12.5);
    assert.equal(body.purchase_units.total_discount_amount, 1.5);
    assert.equal(body.purchase_units.delivery?.amount, 5);
    assert.equal(body.purchase_units.basket[0]?.product_id, "p-1");
    assert.equal(body.purchase_units.basket[0]?.quantity, 2);
    assert.equal(body.purchase_units.basket[0]?.unit_price, 4);
    assert.equal(body.redirect_urls.success.includes("LUMA-TEST-1"), true);
  });
});

describe("amountsMatch", () => {
  it("compares tetri, not floats", () => {
    assert.equal(amountsMatch("10.50", "10.50"), true);
    assert.equal(amountsMatch("10.50", "10.5"), true);
    assert.equal(amountsMatch("10.50", "10.51"), false);
    assert.equal(amountsMatch(new Prisma.Decimal("3.00"), parseBogAmount("3.0")), true);
  });

  it("rejects malformed BOG amounts", () => {
    assert.equal(parseBogAmount("nope"), null);
    assert.equal(parseBogAmount(undefined), null);
  });
});
