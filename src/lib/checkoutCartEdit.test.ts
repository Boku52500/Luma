import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluatePromoCode, getCartSubtotal, getCartTotal, getLineTotal } from "./cart";

describe("checkout cart line removal", () => {
  it("drops a line from the cart totals", () => {
    const lines = [
      { id: "a", lineTotal: getLineTotal(100, 1) },
      { id: "b", lineTotal: getLineTotal(50, 2) },
    ];
    assert.equal(getCartSubtotal(lines), 200);
    const remaining = lines.filter((line) => line.id !== "a");
    assert.equal(getCartSubtotal(remaining), 100);
  });

  it("recalculates promo discount after the subtotal changes", () => {
    const before = evaluatePromoCode("LUMA10", 200);
    assert.equal(before.valid, true);
    assert.equal(before.discount, 20);

    const after = evaluatePromoCode("LUMA10", 100);
    assert.equal(after.valid, true);
    assert.equal(after.discount, 10);
    assert.equal(getCartTotal(100, after.discount, 9.9), 99.9);
  });

  it("treats an empty cart as a zero total that cannot be submitted", () => {
    assert.equal(getCartSubtotal([]), 0);
    assert.equal(getCartTotal(0, 0, 0), 0);
  });
});
