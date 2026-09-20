import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";
import { describe, it } from "node:test";
import { verifyBogCallbackSignature } from "./signature";
import { bogCallbackEnvelopeSchema } from "./schemas";
import { matchBogDetailsToLocal } from "./match";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

function sign(raw: Buffer): string {
  const signer = createSign("RSA-SHA256");
  signer.update(raw);
  signer.end();
  return signer.sign(privatePem).toString("base64");
}

describe("verifyBogCallbackSignature", () => {
  it("accepts a valid SHA256withRSA signature over raw bytes", () => {
    const raw = Buffer.from('{"event":"order_payment","body":{"order_id":"abc"}}', "utf8");
    assert.equal(verifyBogCallbackSignature(raw, sign(raw), publicPem), true);
  });

  it("rejects tampered bodies and missing signatures", () => {
    const raw = Buffer.from('{"event":"order_payment"}', "utf8");
    const signature = sign(raw);
    const tampered = Buffer.from('{"event":"order_payment","x":1}', "utf8");
    assert.equal(verifyBogCallbackSignature(tampered, signature, publicPem), false);
    assert.equal(verifyBogCallbackSignature(raw, "", publicPem), false);
  });
});

describe("callback payload matching", () => {
  it("requires provider id, external order id, currency, and amount", () => {
    const details = {
      order_id: "bog-1",
      external_order_id: "LUMA-1",
      order_status: { key: "completed" },
      purchase_units: { request_amount: "10.00", transfer_amount: "10.00", currency_code: "GEL" },
    };
    const parsed = bogCallbackEnvelopeSchema.safeParse({
      event: "order_payment",
      zoned_request_time: "2022-11-23T18:06:37.240559Z",
      body: details,
    });
    assert.equal(parsed.success, true);

    assert.equal(
      matchBogDetailsToLocal(details, {
        providerOrderId: "bog-1",
        amount: "10.00",
        currency: "GEL",
        orderNumber: "LUMA-1",
      }).ok,
      true,
    );
    assert.equal(
      matchBogDetailsToLocal(details, {
        providerOrderId: "bog-1",
        amount: "9.00",
        currency: "GEL",
        orderNumber: "LUMA-1",
      }).ok,
      false,
    );
    assert.equal(
      matchBogDetailsToLocal(details, {
        providerOrderId: "bog-other",
        amount: "10.00",
        currency: "GEL",
        orderNumber: "LUMA-1",
      }).ok,
      false,
    );
  });

  it("rejects a malformed callback envelope", () => {
    const parsed = bogCallbackEnvelopeSchema.safeParse({
      event: "order_payment",
      zoned_request_time: "2022-11-23T18:06:37.240559Z",
      body: {},
    });
    assert.equal(parsed.success, false);
  });
});
