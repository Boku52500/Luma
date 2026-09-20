# Luma pre-launch audit

Date: 28 August 2026  
Canonical origin: `https://luma.ge`  
Scope: existing production storefront — audit + targeted fixes, not a redesign.  
No production database operations, seeds, real BOG payments, or real refunds were performed.

**Launch stance:** no BLOCKER or HIGH defects remain in payment authorization, inventory hold/release, promo accounting, checkout idempotency, refunds, email rollback isolation, or admin authorization. Replace placeholder legal copy before treating those pages as official policy.

---

## BLOCKER

None.

---

## HIGH

None remaining. H-01, H-02, and H-03 were implemented (see PASSED).

## MEDIUM

### M-01 — Homepage TrustSection states unapproved legal/ops claims

- **Problem:** marketing copy promises 14-day returns and 1-day Tbilisi delivery. Official `/returns` and `/delivery` pages are placeholders and explicitly do not repeat those numbers.
- **Affected area:** homepage `TrustSection`.
- **Risk:** customers (and regulators) may treat homepage copy as the contract.
- **Fix performed or recommendation:** left TrustSection unchanged (do not rewrite working marketing without legal sign-off). Legal pages use safe placeholders. Admin/legal should either approve the homepage claims or soften them.
- **Verification performed:** read `TrustSection.tsx` and info page copy.

### M-02 — Product reviews on the PDP are mock/UI-only

- **Problem:** `getReviews()` synthesizes reviews. Prisma `Review` exists but is not what the storefront renders. JSON-LD does **not** include `AggregateRating`.
- **Affected area:** PDP, SEO.
- **Risk:** fake social proof; would be a structured-data violation if ratings were marked up.
- **Fix performed or recommendation:** omitted ratings from Product JSON-LD. Hide or replace mock reviews when real reviews ship.
- **Verification performed:** read `src/lib/productDetails.ts` `getReviews`; Product JSON-LD source.

### M-03 — CSP allows `unsafe-inline` and `unsafe-eval`

- **Problem:** `next.config.ts` CSP includes both, typical for Next.js without nonce plumbing.
- **Affected area:** all pages.
- **Risk:** XSS impact is larger if a script-injection bug appears.
- **Fix performed or recommendation:** report only. Nonce-based CSP is a separate hardening project.
- **Verification performed:** read `contentSecurityPolicy()` in `next.config.ts`.

### M-04 — Guest order access depends on `luma_order_confirm` cookie

- **Problem:** payment-success / order confirmation for guests requires that cookie. Another device or a cleared cookie cannot open the order (by design).
- **Affected area:** checkout success, payment return, `customerCanAccessOrder`.
- **Risk:** support load; not an IDOR (other customers still cannot guess-open orders without the cookie or matching `customerId`).
- **Fix performed or recommendation:** keep. Document for support: guest must use the original browser, or create an account before paying.
- **Verification performed:** read `src/server/payments/access.ts` and `getOrderForConfirmation`.

### M-05 — Registration enumerates emails; password reset does not

- **Problem:** register returns “ელ. ფოსტით მომხმარებელი უკვე არსებობს”. Forgot-password is anti-enumeration.
- **Affected area:** `/register`.
- **Risk:** account discovery. Common for shops; still worth a product decision.
- **Fix performed or recommendation:** report only — changing copy would be a product/UX change.
- **Verification performed:** read `registerCustomer` vs `acceptedPasswordResetRequest`.

### M-06 — Proxy only requires a session for `/admin/*`

- **Problem:** any logged-in customer passes `src/proxy.ts` for `/admin`. Pages still call `requireAdmin()` and actions call `requireAdminAction()` (role re-read from DB).
- **Affected area:** edge gate vs server authz.
- **Risk:** extra layout work / redirect churn, not privilege escalation.
- **Fix performed or recommendation:** optional later: check role in proxy if a cheap cached signal exists. Do not put role in the JWT as the only check.
- **Verification performed:** read `proxy.ts` and `src/server/auth/admin.ts`.

### M-07 — Client cart still uses snapshot prices and mock `LUMA10`

- **Problem:** mini-cart/checkout UI can show localStorage prices and `evaluatePromoCode` mock. Server checkout ignores client money and loads catalogue + `Promotion` rows.
- **Affected area:** cart UI vs `createOrder`.
- **Risk:** display mismatch, not payment fraud.
- **Fix performed or recommendation:** comments in `cart.ts` are stale (“future server checkout”) but behavior is already server-authoritative. Optional UI follow-up: preview server totals before pay.
- **Verification performed:** `createOrder` recomputes line totals from DB; client `unitPrice` is not in `orderSubmissionSchema`.

### M-08 — Placeholder legal pages are publicly readable

- **Problem:** `/privacy`, `/terms`, and related routes exist with a review banner. They are `noindex` and omitted from the sitemap, but a visitor can still open them.
- **Affected area:** SEO + legal.
- **Risk:** someone cites unfinished policy text.
- **Fix performed or recommendation:** banner + robots disallow. Replace copy in `src/lib/infoPages.ts` after legal review (or serve a contact-only stub).
- **Verification performed:** metadata `robots`, `robots.ts` disallow list, sitemap skip for `needsAdminReview`.

---

## LOW

### L-01 — Minimum password length is 6

- **Problem:** `MIN_PASSWORD_LENGTH = 6`.
- **Affected area:** register / reset / change password.
- **Risk:** weaker accounts.
- **Fix performed or recommendation:** raise to 8+ when product agrees.
- **Verification performed:** read `src/lib/authValidation.ts` and `passwordSchema`.

### L-02 — Public `GET /api/health`

- **Problem:** unauthenticated health returns `{ ok, db }`.
- **Affected area:** ops.
- **Risk:** trivial reconnaissance. Useful for uptime checks.
- **Fix performed or recommendation:** keep; optionally restrict by IP in the host.
- **Verification performed:** read `src/app/api/health/route.ts`.

### L-03 — PostgreSQL rate-limit increment is not a single atomic predicate

- **Problem:** `upsert` then `count >= limit` then `increment` can theoretically over-admit under concurrency.
- **Affected area:** checkout/auth rate limits (not stock).
- **Risk:** slightly weaker flood control.
- **Fix performed or recommendation:** optional `UPDATE … WHERE count < limit`. Fail-closed if the store errors (`return false`).
- **Verification performed:** read `src/server/auth/rateLimit.ts`.

### L-04 — Footer social networks are not links

- **Problem:** Facebook/Instagram/TikTok/YouTube were `href="#"`; now inert labels.
- **Affected area:** footer.
- **Risk:** none; official URLs were unknown.
- **Fix performed or recommendation:** add real URLs when marketing supplies them.
- **Verification performed:** `Footer.tsx` uses `<span>`, not `#`.

### L-05 — Category nav “ყველა კატეგორია” is a label, not a page

- **Problem:** it was a dead control. Now a non-interactive heading beside category links.
- **Affected area:** desktop category nav.
- **Risk:** none.
- **Fix performed or recommendation:** done.
- **Verification performed:** `CategoryNav.tsx`.

### L-06 — City “შეცვლა” was a non-functional control

- **Problem:** implied city switching that does not exist.
- **Affected area:** top utility bar.
- **Risk:** broken UX.
- **Fix performed or recommendation:** removed. Delivery city remains “თბილისი” as display text.
- **Verification performed:** `TopUtilityBar.tsx`.

### L-07 — Admin order cancel lacked a confirm dialog

- **Problem:** status save could set `cancelled` in one click. Cancel still does not restore stock or change payment status.
- **Affected area:** admin order detail.
- **Risk:** accidental cancel.
- **Fix performed or recommendation:** `AdminConfirmDialog` on cancel, copy states stock is not restored.
- **Verification performed:** `OrderStatusForm.tsx`.

### L-08 — Catalogue error client `console.error(error)`

- **Problem:** error boundaries log the Error object in the browser.
- **Affected area:** `error.tsx` / `CatalogueError`.
- **Risk:** Next.js production errors are digest-oriented; still noisy.
- **Fix performed or recommendation:** optional; UI copy is Georgian and does not render stacks.
- **Verification performed:** read `CatalogueError` and `global-error.tsx`.

---

## PASSED

Only items actually inspected (code and/or existing automated tests) are listed.

| Area | What was verified |
| --- | --- |
| Dead user-facing routes | Footer, top bar, and mobile menu pointed at 11 routes that had no `page.tsx`. Those routes now resolve via `src/app/[slug]/page.tsx` whitelist. Unknown slugs `notFound()`. In-page PDP anchors `#reviews` / `#warranty-delivery` stay on the product page. |
| Checkout money | `orderSubmissionSchema` has no client prices. Lines priced from PostgreSQL; delivery fee from `getDeliveryMethodFee`; totals rounded server-side. |
| Stock concurrency | Decrement uses `updateMany` with `gte` quantity; failed count throws. Cannot go negative on that path. |
| BOG OAuth / create | Credentials only in `src/server/payments/bog/config.ts` (`server-only`). Payment rows created on the server. |
| Redirect ≠ PAID | `/checkout/payment/success` and fail pages load status and may **reconcile Payment Details**; they do not set PAID from the query string. |
| Callback signature | Raw body `Buffer` + `Callback-Signature` verified before JSON parse. Invalid signature → 400. |
| Reconciliation | `reconcileBogPaymentDetails` matches provider order / amount / currency; duplicate callbacks are no-ops via status apply rules. Existing `test:payments` suite. |
| Initiate races | `SELECT … FOR UPDATE` on `Order` before creating/reusing a `Payment`; BOG HTTP remains outside the transaction. Reuse pending redirect; retry same idempotency key if create failed before `providerOrderId`. |
| Refunds | `refundAdminOrderPayment` → `requireAdminAction`. FOR UPDATE on Payment. Cumulative cap in `evaluateRefundRequest`. `request_received` is accept-not-complete (tests). History on `PaymentRefund`. Fulfillment `orderStatus` is independent. |
| Email | Unique `EmailDelivery.eventKey`. `scheduleEmail` / `after()` cannot roll back order/payment/refund. Resend ids sanitized (`re_…`). Reset URL built server-side; token not logged via `log.ts` redaction. Existing `test:email`. |
| Admin authz | Every `src/app/admin/**/page.tsx` calls `requireAdmin`. Mutations use `requireAdminAction`. Role always from `Customer.role` in DB, not JWT/localStorage/hardcoded email. |
| IDOR | Account orders: `customerId` match. Guest: confirm cookie equals `orderNumber`. Payment retry uses `customerCanAccessOrder`. Wishlist/addresses scoped in their actions (same session helper pattern). |
| Open redirects | `safeInternalPath` on login redirect query. |
| Secrets in client | No `NEXT_PUBLIC_*`. No `process.env` in `"use client"` modules. BOG/R2/Resend/DB only under `src/server` or config loaded on the server. |
| Logging | `src/server/log.ts` redacts password/secret/token/api_key/card/PAN/signature keys. |
| R2 | Admin-only upload; 10 MB; magic-byte sniff + Sharp; UUID object keys; credentials in `src/server/storage/config.ts`. |
| `.env.example` | Placeholders only; no live secrets. |
| Prisma integrity | `Order.orderNumber` unique; `Order.checkoutIdempotencyKey` unique; `Payment.idempotencyKey` unique; `(provider, providerOrderId)` unique; money `Decimal(12,2)`; `EmailDelivery.eventKey` unique; `PromotionRedemption.orderId` unique. |
| Inventory hold/release (H-01) | Card orders `inventoryState=held` at placement (`updateMany` `gte` decrement). PAID commits with no second decrement. Failed BOG create, derived order `failed`, and admin cancel of a hold `increment` stock once. Cash/installment stay `committed` at placement (existing behavior — cancel does not restore). Retry after release re-allocates. Duplicate PAID is a no-op. BOG callback/status mapping unchanged; commerce sync runs after reconciliation. |
| Promo usage (H-02) | Card: `PromotionRedemption` held at placement; `usedCount` increments only on first PAID. Failed/cancel releases the hold without decrementing `usedCount`. Limit counts held+consumed (`FOR UPDATE` on `Promotion`). Cash/installment: consume immediately at placement (existing behavior); cancel does not un-consume. |
| Checkout idempotency (H-03) | Client UUID v4 in `sessionStorage`, unique `Order.checkoutIdempotencyKey`. Retries return the existing order (and resume BOG if still unpaid). IP rate limits kept; 20s cart-hash dedupe removed. |
| Errors | Root `not-found.tsx` (Georgian). Catalogue/global errors do not render stacks. Invalid product/category use `notFound()`. |
| SEO baseline | `metadataBase` from `getAppOrigin()`. `robots.ts` + `sitemap.ts`. Canonical helpers. www↔apex 308 via `shouldRedirectToCanonical` when `APP_ORIGIN` is set. Organization JSON-LD (name, url, email, phone — **no street address, no ratings**). Product + BreadcrumbList from live fields only. |
| Auth sessions | Auth.js v5 credentials; `AUTH_SECRET` server-side. Password reset tokens hashed at rest (reset action). |

---

## Fixes performed in this audit

1. Info pages for all previously 404 footer/utility routes, with review banners where legal/ops copy is unknown.
2. Root Georgian 404 (`src/app/not-found.tsx`).
3. Removed dead “შეცვლა” and “ყველა კატეგორია” button semantics; social `href="#"` removed.
4. Mobile menu: `role="dialog"`, Escape to close, overlay is a button.
5. `MAX_CART_LINES = 50` on client cart and Zod; durable checkout UUID idempotency key (`Order.checkoutIdempotencyKey`).
6. Card promo hold until PAID; cash/installment still consume at placement.
7. BOG initiate serialized with `FOR UPDATE`; inventory re-hold on retry after failed release.
8. Admin cancel confirmation; unpaid card cancel restores held stock.
9. Organization / Product / Breadcrumb JSON-LD; JSON escaped for `</script>`.
10. Placeholder legal pages: `noindex`, omitted from sitemap, `robots.txt` disallow.
11. Card inventory hold/release (`inventoryState` + `OrderItem.variantId`).
12. Regression tests for info slugs, inventory/promo state machines, and checkout idempotency.

Migration added: `prisma/migrations/20260828120000_inventory_promo_checkout_idempotency`. Not applied to production in this pass.

---

## Manual production actions (do not guess)

1. **Legal/ops copy:** replace `needsAdminReview` pages in `src/lib/infoPages.ts` (and homepage TrustSection if those claims are not approved).
2. **Social URLs:** add official profile links when they exist.
3. **Migrations:** on production Neon run `npm run db:migrate:deploy` (EmailDelivery if still pending, plus inventory/promo/checkout-idempotency). Do not seed.
4. Confirm `APP_ORIGIN=https://luma.ge` and `AUTH_URL=https://luma.ge` so canonical, sitemap, Auth.js, and www redirects stay consistent.
5. Confirm production `RATE_LIMIT_STORE` is PostgreSQL (default when `NODE_ENV=production`).
6. Existing in-flight card orders remain `inventoryState=committed` after migrate (no retroactive stock restore). New card orders use holds.
7. Do not set `ALLOW_PRODUCTION_SEED`.

---

## Verification commands

| Command | Result |
| --- | --- |
| `npx prisma validate` | Pass |
| `npx prisma generate` | Pass |
| `npm run db:verify` | **Not completed** — Docker Desktop engine still not running (`localhost:5432` unreachable). Local `db:migrate:deploy` was not applied. |
| `npx tsc --noEmit` | Pass |
| `npm run lint` | Pass |
| `npm run test:payments` | Pass — 43 tests |
| `npm run test:email` | Pass — 28 tests |
| `npm run test:commerce` | Pass — 22 tests (inventory/promo state machines, checkout UUID, cart size) |
| `npm run build` | Pass |

Migration `20260828120000_inventory_promo_checkout_idempotency` is in the repo. Apply locally after `npm run db:up` with `npm run db:migrate:deploy`. Do not apply to production until you choose to.
