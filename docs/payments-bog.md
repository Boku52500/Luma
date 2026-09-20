# Bank of Georgia card payments

Luma keeps merchant orders (`LUMA-…`) separate from BOG payment attempts. A Luma `Order` is created first; each card checkout or retry creates a `Payment` row and then a BOG ecommerce order. Redirect pages are UX only. Authoritative status comes from the signed callback and/or `GET /payments/v1/receipt/:order_id`.

Official docs: [Introduction](https://api.bog.ge/docs/en/payments/introduction), [Authentication](https://api.bog.ge/docs/en/payments/authentication), [Create order](https://api.bog.ge/docs/en/payments/standard-process/create-order), [Payment details](https://api.bog.ge/docs/en/payments/standard-process/get-payment-details), [Callback](https://api.bog.ge/docs/en/payments/standard-process/callback), [Refund](https://api.bog.ge/docs/en/payments/refund), [Response codes](https://api.bog.ge/docs/en/payments/response-codes).

This step covers **standard card payment** and **admin-only card refunds**. Saved cards, Apple Pay, Google Pay, installments, BNPL, and customer self-service refunds are not implemented.

## Architecture

1. Checkout revalidates prices/stock and creates `Order` + `OrderItem` snapshots (existing flow).
2. For `საბანკო ბარათი`, a `Payment` attempt is stored (`pending`, UUID v4 `idempotencyKey`).
3. Server calls BOG `POST /payments/v1/ecommerce/orders` with that idempotency key.
4. Customer is redirected to the `redirect` URL BOG returned. The cart is **not** cleared yet.
5. BOG `POST /api/payments/bog/callback` (raw body + `Callback-Signature`) updates the attempt.
6. Success/fail pages and admin refresh call payment details and run the same reconciliation.
7. When status is `paid`, the return page clears the cart.

Cash on delivery and the installment UI are unchanged and do not call BOG.

## Environment

```
BOG_CLIENT_ID=
BOG_CLIENT_SECRET=
BOG_OAUTH_URL=https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token
BOG_API_BASE_URL=https://api.bog.ge
BOG_PAYMENTS_ENABLED=true
```

Optional: `BOG_CALLBACK_PUBLIC_KEY` (PEM) to override the documented verification key in tests.

Never put `BOG_CLIENT_SECRET` in client components, HTML, or logs. Put secrets in Vercel env or local `.env` yourself — do not paste them into chat.

If credentials are missing, the shop still runs. Choosing card payment returns a Georgian configuration error. Payments are not faked.

`callback_url` and redirect URLs are built from `APP_ORIGIN` (then `AUTH_URL`). BOG cannot call `http://localhost:3000`. End-to-end callback QA needs a public HTTPS origin.

## Auth

`POST` token URL with HTTP Basic (`client_id:client_secret`) and `grant_type=client_credentials`. Bearer tokens are cached in process memory until shortly before `expires_in`. They are not stored in PostgreSQL.

## Create order

Bearer auth, `Accept-Language: ka`, `Idempotency-Key` UUID v4, `payment_method: ["card"]` plus flagged hosted methods (`google_pay`, `apple_pay`, `bog_p2p`, `bog_loyalty`), no `config.google_pay` / `config.apple_pay` on Card checkout, `capture: automatic`, `purchase_units.currency: GEL`, server-calculated `total_amount` and basket. `external_order_id` is the Luma order number.

Retries of the **same** attempt reuse the stored idempotency key. A new retry after failure creates a new `Payment` and a new key. The Luma order is not duplicated.

## Callback

`POST /api/payments/bog/callback` is unauthenticated for customers. It verifies `SHA256withRSA` against the **raw body** before JSON parse, using BOG’s published public key. Invalid signatures are not marked paid. Processing is idempotent. This route is not rate-limited (protection is the signature).

## Status mapping

| BOG `order_status.key` | Luma attempt | Order `paymentStatus` |
| --- | --- | --- |
| `created` | `pending` | `pending` |
| `processing` | `processing` | `processing` |
| `completed` | `paid` | `paid` |
| `rejected` | `failed` | `failed` |
| `refund_requested` | attempt stays `paid` if already paid; `PaymentRefund` is `processing` | unchanged until details confirm |
| `refunded` | `refunded` | `refunded` |
| `refunded_partially` | `partially_refunded` | `partially_refunded` |

Paid attempts are not overwritten by a later `rejected`. Order fulfillment status (`Order.status`) does not change because payment succeeded.

## Reconciliation

`reconcileBogPaymentDetails` is shared by the callback, the customer return pages, and admin **გადახდის სტატუსის განახლება**. It checks provider order id, Luma order number, currency, and amounts (tetri). Admins cannot toggle a BOG payment to paid or refunded by hand.

The first transition into `paid` / `partially_refunded` / `refunded` also schedules the matching customer email. Duplicate callbacks do not resend. See `docs/email.md`.

## Admin refunds

Admins can request a full or partial card refund from `/admin/orders/[id]` (**თანხის დაბრუნება**). The action calls `requireAdminAction()`, creates a `PaymentRefund` row with a UUID v4 `Idempotency-Key`, then `POST /payments/v1/payment/refund/:order_id`.

- Full refund omits `amount` (BOG refunds the processed payment).
- Partial refund sends documented `amount` and cannot exceed remaining refundable (`processed − refund_amount − in-flight`).
- BOG `request_received` only means the request was accepted. Persist `action_id` and set the refund to `processing`. Final `REFUNDED` / `PARTIALLY_REFUNDED` comes from Payment Details / the signed callback (`refunded`, `refunded_partially`).
- Refunds cannot be cancelled after initiation. Order fulfillment status is not changed to cancelled.
- Without BOG credentials, the admin UI still shows history; submitting a refund returns that refunds are unavailable. Success is not faked.

Use the existing **გადახდის სტატუსის განახლება** after a refund to pull current BOG state.

## Customer URLs

- Success: `/checkout/payment/success?order=LUMA-…`
- Fail: `/checkout/payment/fail?order=LUMA-…`
- Existing `/checkout/success` remains for cash / installment

Landing on success does **not** mark the order paid.

## Production setup

1. Set BOG env vars on Vercel (never commit `.env`).
2. Set `APP_ORIGIN` to the public HTTPS origin so callback/redirect URLs are correct.
3. Apply Prisma migrations with `npm run db:migrate:deploy` (not `migrate dev` against Neon).
4. Confirm `/api/payments/bog/callback` is reachable over HTTPS.

## Live QA checklist (needs real BOG credentials + public HTTPS)

1. Create a Luma order with card payment.
2. Confirm a `Payment` row and BOG id / redirect URL are stored.
3. Complete payment on BOG’s page.
4. Callback verifies and status becomes `paid`.
5. Luma order number is unchanged.
6. Success page, account order, and admin show paid + transaction data.
7. Duplicate callback does not duplicate effects.
8. Failed/unpaid retry starts a new attempt on the same Luma order.
9. Cart clears after confirmed `paid`, not after redirect creation.

## Local tests

`npm run test:payments` — mapping, payload, amounts, refund request body, remaining refundable amount, signature (local test keys only), rejected callback behavior. Does not call live BOG.
