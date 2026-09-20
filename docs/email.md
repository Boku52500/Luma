# Transactional email (Resend)

Luma sends **transactional** mail only: password reset, order confirmation, BOG payment confirmation, refund confirmation, and admin fulfillment-status updates. There is no newsletter, subscription, abandoned-cart, SMS, or push layer.

The shop, checkout, and auth keep working if Resend is unconfigured. Sends then log `email.not_configured` and are stored as **failed** deliveries. Success is never faked.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Production | Resend API key. Server-only. Never expose to client components. |
| `EMAIL_FROM` | Production | Verified sender, e.g. `Luma <noreply@luma.ge>` |
| `EMAIL_REPLY_TO` | Optional | Reply address (e.g. `info@luma.ge`) |
| `APP_ORIGIN` | Production | Canonical origin for links (`https://luma.ge`). Local: `http://localhost:3000` via `AUTH_URL` / fallback. |
| `EMAIL_OVERRIDE_TO` | Local only | Redirects every transactional recipient. **Ignored in production** unless `EMAIL_ALLOW_OVERRIDE=true`. |
| `EMAIL_ALLOW_OVERRIDE` | Dangerous | Must be `true` to honor `EMAIL_OVERRIDE_TO` when `NODE_ENV=production`. Leave unset on Vercel. |

Do not put API keys in this file or in git.

Sender domain `luma.ge` must stay verified in the Resend dashboard. Links are built with `getAppOrigin()` / `getAppOriginString()` — templates do not hardcode `luma.ge`.

## Architecture

Server-only module: `src/server/email/`.

- `config.ts` — env validation
- `send.ts` — Resend client (one place) + `sendTransactionalEmail`
- `deliver.ts` — persist `EmailDelivery`, skip if `eventKey` already `sent`
- `notify.ts` — load **order snapshots** (not live product prices) and render
- `schedule.ts` — run after the HTTP response
- `templates.ts` / `html.ts` — Georgian HTML with escaped user values

Callers (auth, checkout, BOG reconcile, admin status) must not construct Resend clients.

### After the response

Email runs through `scheduleEmail()`:

1. Prefer Next.js `after()` (Server Actions, Route Handlers, Vercel). The platform keeps the function alive until the callback finishes (route `maxDuration`).
2. If `after()` cannot be scheduled (tests / non-request context), a detached promise runs instead.
3. Failures are logged and **never thrown back** into the action that already committed order/payment/refund/auth state.

Awaiting the send inside `after()` is acceptable. Do not add a separate job queue in this step.

## Events

| Type | When | Event key |
| --- | --- | --- |
| `password_reset` | Reset token created for an existing customer | `password-reset:{tokenId}` |
| `order_confirmation` | Luma `Order` created (guest or signed-in) | `order-confirmation:{orderId}` |
| `payment_paid` | First authoritative transition into Payment `paid` | `payment-paid:{paymentId}` |
| `refund_partial` | First transition into `partially_refunded` | `refund-completed:{paymentId}:partially_refunded` |
| `refund_full` | First transition into `refunded` | `refund-completed:{paymentId}:refunded` |
| `order_status` | Admin changes fulfillment to processing / shipped / delivered / cancelled | `order-status:{orderId}:{status}` |

Payment and refund mail is triggered only from `reconcileBogPaymentDetails` (signed callback, return-page refresh, admin refresh) — **not** from the browser success page by itself.

BOG `request_received` on a refund request is not a confirmation. Refund email waits for Payment Details / callback `refunded` / `refunded_partially`.

Card **order confirmation** says the order was received and that payment confirmation will follow. It must not say the card charge is paid.

## Recipients

Use the email stored on the **order snapshot** (`Order.customerEmail`) for order/payment/refund/status mail. Guest checkout uses that guest address. Do not substitute the customer's current profile email for historical orders.

Password reset uses the customer account email and a one-hour hashed token. The public forgot-password action always returns the same success so accounts cannot be enumerated — including when Resend fails.

## Idempotency

`EmailDelivery.eventKey` is unique. A row already `sent` is skipped. Duplicate BOG callbacks therefore do not send a second paid/refund email. Admin retry reuses the same key; it does not create a second SENT event. Password-reset rows cannot be retried from admin (the raw token is not stored).

Bodies and secrets are not stored. `providerMessageId` (Resend id), sanitized `lastError`, recipient, and subject are.

## Failure behavior

| Business event | If Resend fails |
| --- | --- |
| Order created | Order stays created |
| Payment becomes `paid` | Payment stays `paid` |
| Refund confirmed | Refund stays completed |
| Admin status change | Status stays changed |
| Password reset requested | Generic success; token still created when the account exists |

Admin order detail shows a compact delivery history and can retry **failed** order/payment/refund/status events.

## Local testing

1. Unconfigured: request a password reset and place an order. UX stays generic; logs show `email.not_configured`.
2. Configured: set `RESEND_API_KEY` + `EMAIL_FROM`. Optionally `EMAIL_OVERRIDE_TO=you@example.com` so you never mail a real customer from Docker.
3. Automated tests mock the provider (`npm run test:email`). They must not call live Resend.

## Production

1. Confirm Vercel has `RESEND_API_KEY` and `EMAIL_FROM`.
2. Apply the `EmailDelivery` migration with `npm run db:migrate:deploy` (not `migrate dev` against Neon). Do not seed production.
3. Deploy. `npm run prod:verify` requires the email env vars when `NODE_ENV=production`.

### QA (use an address you control)

1. Forgot password arrives; reset link is `https://luma.ge/reset-password?token=…`
2. Order confirmation arrives after checkout
3. BOG PAID confirmation arrives from reconciliation, not only from the redirect page
4. Duplicate callback does not duplicate the paid email
5. Partial refund confirmation; then full refund if tested
6. Admin processing / shipped / delivered / cancelled sends the matching Georgian mail
7. Resend dashboard shows accepted messages
8. Admin delivery status matches the provider result
9. Check spam/junk rendering

## Security

Never email password hashes, Auth.js secrets, BOG secrets, full card numbers, or the database token hash. Reset links contain the raw token by design. User-supplied name/address/notes are HTML-escaped.
