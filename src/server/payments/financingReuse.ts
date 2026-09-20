/** BOG financing products that must not share a provider order across incompatible terms. */
export function isBogFinancingMethod(method: string | null | undefined): boolean {
  return method === "bnpl" || method === "bog_loan";
}

export type FinancingAttemptSnapshot = {
  method: string | null;
  loanMonth: number | null;
  loanDiscountCode: string | null;
};

export type RequestedFinancingAttempt = {
  method?: string;
  loan?: { month: number; type: string };
};

/**
 * An unpaid Payment (and its BOG Idempotency-Key / provider order) may be
 * reused only when the customer is still asking for the same product and
 * the same `config.loan` terms.
 *
 * Card / wallet retries that never touch financing stay reusable. A
 * financing attempt must not be reused for a different `payment_method`
 * (`bnpl` vs `bog_loan`) or a different month / discount code.
 */
export function canReuseBogPaymentAttempt(
  existing: FinancingAttemptSnapshot,
  requested: RequestedFinancingAttempt,
): boolean {
  const requestedMethod = requested.method;
  if (!requestedMethod) return true;

  const involvesFinancing =
    isBogFinancingMethod(requestedMethod) || isBogFinancingMethod(existing.method);
  if (!involvesFinancing) return true;

  if (existing.method !== requestedMethod) return false;

  if (isBogFinancingMethod(requestedMethod)) {
    const loan = requested.loan;
    if (!loan) return false;
    return existing.loanMonth === loan.month && existing.loanDiscountCode === loan.type;
  }

  return true;
}

/**
 * If the latest unpaid attempt is a different financing product or terms,
 * drop reuse / wait / retry-same so a new Payment + new BOG Idempotency-Key
 * is allocated. Paid and already-`new` plans are left unchanged.
 */
export function overlayIncompatibleFinancingPlan<T extends { kind: string }>(
  plan: T | null,
  latest: FinancingAttemptSnapshot | undefined,
  requested: RequestedFinancingAttempt,
): T | { kind: "new" } | null {
  if (!plan || !latest) return plan;
  if (plan.kind === "paid" || plan.kind === "new") return plan;
  if (canReuseBogPaymentAttempt(latest, requested)) return plan;
  return { kind: "new" };
}

export type CheckoutFinancingReuseDecision = {
  merchantOrder: "reuse" | "new";
  paymentAttempt: "reuse" | "new";
  providerOrder: "reuse" | "new";
};

/**
 * Checkout-key replay should keep the Luma merchant Order. The Payment row
 * and BOG provider order are reused only when the latest unpaid attempt is
 * compatible with the new selection.
 */
export function financingCheckoutReuseDecision(input: {
  existingUnpaidMerchantOrder: boolean;
  latestPayment: (FinancingAttemptSnapshot & {
    status: string;
    providerOrderId: string | null;
  }) | null;
  requested: { method: string; loan: { month: number; type: string } };
}): CheckoutFinancingReuseDecision {
  const merchantOrder = input.existingUnpaidMerchantOrder ? "reuse" : "new";
  const latest = input.latestPayment;
  const unpaid = latest?.status === "pending" || latest?.status === "processing";
  const compatible = Boolean(
    unpaid &&
      canReuseBogPaymentAttempt(
        {
          method: latest.method,
          loanMonth: latest.loanMonth,
          loanDiscountCode: latest.loanDiscountCode,
        },
        input.requested,
      ),
  );
  return {
    merchantOrder,
    paymentAttempt: compatible ? "reuse" : "new",
    providerOrder: compatible && latest?.providerOrderId ? "reuse" : "new",
  };
}
