"use client";

type GooglePayCapabilities = {
  environment: "TEST" | "PRODUCTION";
  gateway: string;
  gatewayMerchantId: string;
};

function loadGooglePayScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (document.querySelector("script[data-google-pay]")) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://pay.google.com/gp/p/js/pay.js";
    script.async = true;
    script.dataset.googlePay = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Pay script failed"));
    document.head.appendChild(script);
  });
}

export async function requestGooglePayToken(
  caps: GooglePayCapabilities,
  amount: string,
): Promise<string> {
  await loadGooglePayScript();
  const googleNs = (window as unknown as { google?: { payments?: { api?: { PaymentsClient: new (opts: { environment: string }) => GooglePayClient } } } }).google;
  if (!googleNs?.payments?.api) throw new Error("Google Pay is unavailable");
  const client = new googleNs.payments.api.PaymentsClient({ environment: caps.environment });
  const request = {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [
      {
        type: "CARD",
        parameters: {
          allowedAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
          allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX"],
        },
        tokenizationSpecification: {
          type: "PAYMENT_GATEWAY",
          parameters: {
            gateway: caps.gateway,
            gatewayMerchantId: caps.gatewayMerchantId,
          },
        },
      },
    ],
    transactionInfo: {
      totalPriceStatus: "FINAL",
      totalPrice: amount,
      currencyCode: "GEL",
      countryCode: "GE",
    },
    merchantInfo: { merchantName: "Luma" },
  };
  const paymentData = await client.loadPaymentData(request);
  const token = paymentData?.paymentMethodData?.tokenizationData?.token;
  if (typeof token !== "string" || !token) {
    throw new Error("Google Pay token missing");
  }
  return token;
}

type GooglePayClient = {
  loadPaymentData: (request: unknown) => Promise<{
    paymentMethodData?: { tokenizationData?: { token?: string } };
  }>;
};
