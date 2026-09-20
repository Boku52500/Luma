const STORAGE_KEY = "luma:checkout-idempotency";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCheckoutIdempotencyKey(value: string): boolean {
  return UUID_V4.test(value);
}

/** Stable per checkout tab until a successful placement rotates it. */
export function getCheckoutIdempotencyKey(): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const existing = window.sessionStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  if (isCheckoutIdempotencyKey(existing)) return existing;
  const next = crypto.randomUUID();
  window.sessionStorage.setItem(STORAGE_KEY, next);
  return next;
}

export function rotateCheckoutIdempotencyKey(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}
