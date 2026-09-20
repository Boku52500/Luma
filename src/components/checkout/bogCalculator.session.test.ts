import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { openBogInstallmentCalculator, resetBogCalculatorSdkLoader } from "./bogCalculator";

type OpenArgs = {
  amount: number;
  bnpl: boolean;
  onClose: () => void;
  onRequest: (
    selected: { month?: number; discount_code?: string; amount?: number },
    successCb: (orderId: string) => void,
    closeCb: () => void,
  ) => unknown;
  onComplete: (info: { redirectUrl?: string }) => unknown;
};

let lastOpen: OpenArgs | undefined;
let orderCalls = 0;

const mockCalculator = {
  open(opts: OpenArgs) {
    lastOpen = opts;
  },
};

const orderResult = {
  providerOrderId: "bog-order-1",
  orderNumber: "LUMA-1",
  redirectUrl: "https://example.test/success",
};

function installReadyCalculator() {
  const root = globalThis as Record<string, unknown>;
  root.BOG = { Calculator: mockCalculator };
}

async function openSession(bnpl: boolean, amount = 100) {
  return openBogInstallmentCalculator({
    clientId: "public-client",
    amount,
    bnpl,
    onRequest: async () => {
      orderCalls += 1;
      return orderResult;
    },
  });
}

before(() => {
  installReadyCalculator();
});

afterEach(() => {
  lastOpen = undefined;
  orderCalls = 0;
  installReadyCalculator();
  resetBogCalculatorSdkLoader();
});

describe("openBogInstallmentCalculator", () => {
  it("opens BNPL and standard installment with a finite GEL amount and the documented bnpl flag", async () => {
    const bnplSession = openSession(true, 59.9);
    await Promise.resolve();
    assert.equal(lastOpen?.amount, 59.9);
    assert.equal(typeof lastOpen?.amount, "number");
    assert.equal(lastOpen?.bnpl, true);
    assert.deepEqual(Object.keys(lastOpen ?? {}).sort(), [
      "amount",
      "bnpl",
      "onClose",
      "onComplete",
      "onRequest",
    ]);
    lastOpen?.onClose();
    assert.deepEqual(await bnplSession, { cancelled: true });

    const loanSession = openSession(false, 249.99);
    await Promise.resolve();
    assert.equal(lastOpen?.amount, 249.99);
    assert.equal(lastOpen?.bnpl, false);
    lastOpen?.onClose();
    assert.deepEqual(await loanSession, { cancelled: true });
  });

  it("cancels silently when the customer closes before selecting terms", async () => {
    const session = openSession(true);
    await Promise.resolve();
    lastOpen?.onClose();
    assert.deepEqual(await session, { cancelled: true });
    assert.equal(orderCalls, 0);
  });

  it("does not cancel a valid order if onClose fires while onRequest is running", async () => {
    let finishOrder: (value: typeof orderResult) => void = () => undefined;
    const session = openBogInstallmentCalculator({
      clientId: "public-client",
      amount: 100,
      bnpl: true,
      onRequest: () =>
        new Promise((resolve) => {
          finishOrder = resolve;
        }),
    });
    await Promise.resolve();
    lastOpen?.onRequest({ month: 4, discount_code: "BNPL", amount: 25 }, () => undefined, () => undefined);
    lastOpen?.onClose();
    finishOrder(orderResult);
    await Promise.resolve();
    lastOpen?.onComplete({ redirectUrl: "https://example.test/complete" });
    const finished = await session;
    assert.equal(finished.cancelled, false);
    if (!finished.cancelled) {
      assert.equal(finished.providerOrderId, "bog-order-1");
      assert.equal(finished.sdkRedirectUrl, "https://example.test/complete");
    }
  });

  it("treats onClose after successCb as an SDK transition, not a failure", async () => {
    const session = openSession(false);
    await Promise.resolve();
    let receivedId = "";
    lastOpen?.onRequest({ month: 12, discount_code: "ZERO" }, (orderId) => {
      receivedId = orderId;
    }, () => undefined);
    await Promise.resolve();
    lastOpen?.onClose();
    lastOpen?.onComplete({ redirectUrl: "https://example.test/complete" });
    const finished = await session;
    assert.equal(receivedId, "bog-order-1");
    assert.equal(finished.cancelled, false);
  });

  it("surfaces create-order failure and closes the calculator", async () => {
    const session = openBogInstallmentCalculator({
      clientId: "public-client",
      amount: 100,
      bnpl: true,
      onRequest: async () => {
        throw new Error("ბანკმა შეკვეთა ვერ მიიღო.");
      },
    });
    await Promise.resolve();
    let closed = false;
    lastOpen?.onRequest({ month: 4, discount_code: "BNPL" }, () => undefined, () => {
      closed = true;
    });
    await assert.rejects(session, /ბანკმა შეკვეთა ვერ მიიღო/);
    assert.equal(closed, true);
  });

  it("passes the provider order id to successCb and follows onComplete", async () => {
    const session = openSession(true);
    await Promise.resolve();
    lastOpen?.onRequest({ month: 4, discount_code: "BNPL" }, (orderId) => {
      assert.equal(orderId, "bog-order-1");
    }, () => undefined);
    await Promise.resolve();
    const completeReturn = lastOpen?.onComplete({ redirectUrl: "https://example.test/complete" });
    assert.equal(completeReturn, false);
    const finished = await session;
    assert.deepEqual(finished, {
      cancelled: false,
      providerOrderId: "bog-order-1",
      orderNumber: "LUMA-1",
      redirectUrl: "https://example.test/success",
      sdkRedirectUrl: "https://example.test/complete",
    });
  });

  it("ignores a duplicate onComplete and a second onRequest while the first is in flight", async () => {
    let finishOrder: (value: typeof orderResult) => void = () => undefined;
    const session = openBogInstallmentCalculator({
      clientId: "public-client",
      amount: 100,
      bnpl: false,
      onRequest: () =>
        new Promise((resolve) => {
          orderCalls += 1;
          finishOrder = resolve;
        }),
    });
    await Promise.resolve();
    lastOpen?.onRequest({ month: 12, discount_code: "ZERO" }, () => undefined, () => undefined);
    lastOpen?.onRequest({ month: 6, discount_code: "OTHER" }, () => undefined, () => undefined);
    assert.equal(orderCalls, 1);
    finishOrder(orderResult);
    await Promise.resolve();
    lastOpen?.onComplete({ redirectUrl: "https://example.test/one" });
    lastOpen?.onComplete({ redirectUrl: "https://example.test/two" });
    const finished = await session;
    assert.equal(finished.cancelled, false);
    if (!finished.cancelled) {
      assert.equal(finished.sdkRedirectUrl, "https://example.test/one");
    }
  });

  it("sends only month and discount_code from onRequest, never selected.amount", async () => {
    let received: { month: number; discount_code: string } | undefined;
    const session = openBogInstallmentCalculator({
      clientId: "public-client",
      amount: 199.5,
      bnpl: true,
      onRequest: async (selected) => {
        received = selected;
        return orderResult;
      },
    });
    await Promise.resolve();
    lastOpen?.onRequest(
      { month: 4, discount_code: "BNPL", amount: 25 },
      () => undefined,
      () => undefined,
    );
    await Promise.resolve();
    lastOpen?.onComplete({ redirectUrl: "https://example.test/complete" });
    await session;
    assert.deepEqual(received, { month: 4, discount_code: "BNPL" });
    assert.equal(received && "amount" in received, false);
  });

  it("rejects an invalid calculator amount before talking to the SDK", async () => {
    await assert.rejects(
      () =>
        openBogInstallmentCalculator({
          clientId: "public-client",
          amount: 0,
          bnpl: true,
          onRequest: async () => orderResult,
        }),
      /გადახდის დაწყება ვერ მოხერხდა/,
    );
    assert.equal(lastOpen, undefined);
  });

  it("fails when the SDK client id is missing", async () => {
    await assert.rejects(
      () =>
        openBogInstallmentCalculator({
          clientId: "  ",
          amount: 100,
          bnpl: true,
          onRequest: async () => orderResult,
        }),
      /BOG calculator is unavailable/,
    );
  });

  it("fails when the official SDK script cannot load", async () => {
    resetBogCalculatorSdkLoader();
    const root = globalThis as Record<string, unknown>;
    delete root.BOG;
    const script: Record<string, unknown> = {
      id: "",
      src: "",
      async: false,
      onload: null,
      onerror: null,
      setAttribute() {
        return undefined;
      },
    };
    root.document = {
      getElementById: () => null,
      createElement: () => script,
      head: {
        appendChild() {
          queueMicrotask(() => {
            const onerror = script.onerror;
            if (typeof onerror === "function") onerror();
          });
        },
      },
    };

    await assert.rejects(
      () =>
        openBogInstallmentCalculator({
          clientId: "public-client",
          amount: 100,
          bnpl: false,
          onRequest: async () => orderResult,
        }),
      /BOG SDK failed/,
    );
  });
});
