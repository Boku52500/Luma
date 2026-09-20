# BOG Payments feature matrix

Source of truth: the official Payments sidebar at [Introduction](https://api.bog.ge/docs/en/payments/introduction) (inspected 2026-08-28).

Header products **Payment Manager**, **Link Payment**, **Billing**, and **Open Banking** are separate BOG products, not Payments documentation sections. They are out of scope for this matrix.

Classification (after implementation):

- `IMPLEMENTED + TESTED` — in Luma, covered by mocked tests
- `IMPLEMENTED + REQUIRES BOG ACTIVATION` — coded, default-off until Business Manager / support enables it
- `IMPLEMENTED + REQUIRES APPLE/GOOGLE ACTIVATION` — coded, default-off until Apple/Google + BOG merchant setup
- `NOT APPLICABLE TO LUMA` — documented reason

Luma architecture (unchanged): `Order` is the merchant order; `Payment` is one financial attempt. Redirects, wallet sheets, and frontend tokens never mark `PAID`. Authoritative path is signed callback and/or Payment Details → validate → DB transaction → financial state → inventory/promo → email.

---

## 1. Introduction

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/introduction |
| Official endpoint(s) | None (protocol overview) |
| HTTP method | — |
| Authentication | OAuth 2.0 / JWT described at protocol level |
| Important request fields | — |
| Important response fields | — |
| Idempotency-Key | — |
| payment_method | — |
| Callback / reconciliation | Callbacks are asynchronous; API calls are synchronous |
| Merchant activation | Business registration |
| Current Luma status | Followed by existing card integration |
| Implementation | `docs/payments-bog.md`, this matrix |
| DB / checkout / admin | N/A |
| Production test status | N/A |
| **Classification** | **NOT APPLICABLE TO LUMA** — conceptual overview only; no API to implement |

---

## 2. Authentication Method

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/authentication |
| Official endpoint(s) | `https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token` |
| HTTP method | `POST` |
| Authentication | HTTP Basic (`client_id:client_secret`), body `grant_type=client_credentials` |
| Important request fields | `grant_type=client_credentials` |
| Important response fields | `access_token`, `token_type=Bearer`, `expires_in` |
| Idempotency-Key | Not documented |
| payment_method | — |
| Callback / reconciliation | — |
| Merchant activation | `client_id` / `client_secret` issued after business registration |
| Current Luma status | Production-tested |
| Implementation | `src/server/payments/bog/auth.ts`, `config.ts` |
| DB | Tokens are process-memory only |
| Checkout / admin | Hidden; missing creds return Georgian config error |
| Production test status | Tested in live card checkout |
| **Classification** | **IMPLEMENTED + TESTED** |

---

## 3. Standard Process (index)

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/standard-process/ |
| Official endpoint(s) | Index of Order Request, Payment Details, Callback |
| **Classification** | **NOT APPLICABLE TO LUMA** — navigation index; covered by child pages |

---

## 4. Order Request (standard card + shared create-order)

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/standard-process/create-order |
| Official endpoint(s) | `POST https://api.bog.ge/payments/v1/ecommerce/orders` |
| HTTP method | `POST` |
| Authentication | Bearer JWT |
| Important request fields | `callback_url`, `external_order_id`, `capture` (`automatic` \| `manual`), `purchase_units` (basket, `total_amount`, `currency`), `redirect_urls`, `ttl`, `payment_method[]`, `config` (`loan`, `google_pay`, `apple_pay`, `split`, `account`, `campaign`), `application_type` (`web` \| `mobile`), `buyer` |
| Important response fields | `id`, `_links.details.href`, `_links.redirect.href` (hosted); additional `_links.accept` / `status` / `order_details` / `result` on webpage wallet flows |
| Idempotency-Key | Optional UUID v4; same key returns same response |
| payment_method | `card`, `google_pay`, `apple_pay`, `bog_p2p`, `bog_loyalty`, `bnpl`, `bog_loan`, `gift_card` |
| Callback / reconciliation | `callback_url` required HTTPS; customer redirect is not final |
| Merchant activation | Each listed `payment_method` must be activated for the shop |
| Current Luma status | Card checkout: `capture: automatic` + `payment_method: ["card"]` plus flagged hosted methods (`google_pay`, `apple_pay`, `bog_p2p`, `bog_loyalty`). No `config.*.external`. Loan/BNPL are separate checkout options |
| Implementation | `src/server/payments/bog/payload.ts`, `client.ts`, `initiate.ts` |
| DB | `Payment` attempt + `Order.checkoutIdempotencyKey` |
| Checkout UI | Card always (when BOG configured). Luma does not draw wallet / P2P / loyalty buttons. Those appear on BOG's hosted page when flagged |
| Admin UI | Payment attempt list |
| Production test status | Card: live. Other create-order configs: mocked tests only |
| **Classification** | **IMPLEMENTED + TESTED** (card automatic). Hosted extras: **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

### 4a. Hosted `bog_p2p` / `bog_loyalty` / `gift_card`

These values exist only on the Order Request `payment_method` list (no dedicated sidebar page). Luma can include them on the BOG-hosted page when the matching env flag is on. No Luma-native UI. Default off.

**Classification:** **IMPLEMENTED + REQUIRES BOG ACTIVATION**

---

## 5. Payment Details

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/standard-process/get-payment-details |
| Official endpoint(s) | `GET https://api.bog.ge/payments/v1/receipt/:order_id` |
| HTTP method | `GET` |
| Authentication | Bearer JWT |
| Important request fields | Path `order_id` |
| Important response fields | `order_id`, `capture`, `external_order_id`, `order_status.key` (`created`, `processing`, `completed`, `rejected`, `refund_requested`, `refunded`, `refunded_partially`, `auth_requested`, `blocked`, `partial_completed`), `purchase_units` amounts/currency, `payment_detail` (`transfer_method`, `payment_option`, `saved_card_type`, `parent_order_id`, `code`, `payer_identifier`, `card_type`, `card_expiry_date`, `auth_code`), `actions[]`, `split`, `reject_reason` |
| Idempotency-Key | Not documented |
| payment_method | `payment_detail.transfer_method.key` |
| Callback / reconciliation | Used when callback was missed; same parser as callback `body` |
| Merchant activation | — |
| Current Luma status | Parser accepts real payloads; extended for saved-card / split / preauth fields |
| Implementation | `src/server/payments/bog/schemas.ts`, `client.ts`, `reconcile.ts`, `match.ts` |
| DB | Payment + refund + saved-method + split snapshot fields |
| Checkout / admin | Success/fail pages and admin refresh |
| Production test status | Card live; new fields mocked |
| **Classification** | **IMPLEMENTED + TESTED** |

---

## 6. Callback

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/standard-process/callback |
| Official endpoint(s) | Merchant `callback_url` (`POST`) |
| HTTP method | `POST` from BOG |
| Authentication | `Callback-Signature` SHA256withRSA over **raw body** before JSON parse |
| Important request fields | Header `Callback-Signature`; body `event=order_payment`, `zoned_request_time`, `body` = payment details. Also used for refunds, preauth approvals, and split updates |
| Important response fields | Merchant must return HTTP 200 |
| Idempotency-Key | Luma idempotent reconcile; not a BOG request header |
| payment_method | Inside `body.payment_detail` |
| Callback / reconciliation | Authoritative with Payment Details fallback |
| Merchant activation | Public HTTPS `callback_url` |
| Current Luma status | Production-tested signed callback |
| Implementation | `src/app/api/payments/bog/callback/route.ts`, `src/server/payments/bog/signature.ts` |
| DB | Same reconcile path |
| Checkout UI | Must not mark paid |
| Admin UI | Refresh uses Payment Details, not callback spoofing |
| Production test status | Live for card |
| **Classification** | **IMPLEMENTED + TESTED** |

---

## 7. Save Card (index)

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/saved-card/ |
| **Classification** | **NOT APPLICABLE TO LUMA** — navigation index; covered by child pages |

---

## 8. Save Card for Recurring Payments

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/saved-card/recurrent |
| Official endpoint(s) | `PUT https://api.bog.ge/payments/v1/orders/:order_id/cards` |
| HTTP method | `PUT` |
| Authentication | Bearer JWT |
| Important request fields | Path `order_id` (BOG order id from create-order). Call **before** redirect. Customer consent required |
| Important response fields | HTTP 202 Accepted |
| Idempotency-Key | Optional UUID v4 |
| payment_method | Card payment on the parent order. Details `saved_card_type=recurrent`, `payment_option=recurrent` on later charges |
| Callback / reconciliation | Parent order still reconciles as a normal payment; Luma stores the BOG `order_id` as the saved-card reference after successful paid parent |
| Merchant activation | Saved-card product in Business Manager |
| Current Luma status | Implemented, default-off |
| Implementation | `src/server/payments/bog/savedCard.ts`, Account → Payment Methods, checkout consent |
| DB | `SavedPaymentMethod` (`consent=recurrent`, `parentOrderId`) |
| Checkout UI | Authenticated customers only; checkbox does **not** grant automatic-charge consent |
| Admin UI | Saved-card relationship on the payment |
| Production test status | Mocked only |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 9. Save Card for Automatic Payments

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/saved-card/offline |
| Official endpoint(s) | `PUT https://api.bog.ge/payments/v1/orders/:order_id/subscriptions` |
| HTTP method | `PUT` |
| Authentication | Bearer JWT |
| Important request fields | Path `order_id`. Distinct consent from recurrent |
| Important response fields | HTTP 202 Accepted |
| Idempotency-Key | Optional UUID v4 |
| payment_method | Later charges: `payment_option=subscription`, `saved_card_type=subscription` |
| Callback / reconciliation | Same payment-details path |
| Merchant activation | Automatic-payment permission from BOG |
| Current Luma status | Provider API implemented. **Business workflow disabled** (no checkout/admin trigger) unless `BOG_AUTOMATIC_CHARGE_WORKFLOW_ENABLED=true` |
| Implementation | `src/server/payments/bog/savedCard.ts` |
| DB | `SavedPaymentMethod.consent=subscription` |
| Checkout UI | Automatic-charge consent is not offered |
| Admin UI | Capability visible; no charge button unless workflow flag |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 10. Delete Saved Card

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/saved-card/delete |
| Official endpoint(s) | `DELETE https://api.bog.ge/payments/v1/charges/card/:order_id` |
| HTTP method | `DELETE` |
| Authentication | Bearer JWT |
| Important request fields | Path `order_id` = parent BOG order id used when the card was saved |
| Important response fields | HTTP 202 Accepted |
| Idempotency-Key | Optional UUID v4 |
| payment_method | — |
| Callback / reconciliation | Local row soft-deleted; BOG 202 is request accepted |
| Merchant activation | Saved-card product |
| Current Luma status | Implemented; customer may delete only own methods |
| Implementation | `src/server/payments/bog/savedCard.ts`, account actions |
| DB | `SavedPaymentMethod.deletedAt` |
| Checkout / admin | Account → Payment Methods |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 11. Payment by the Saved Card

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/saved-card/recurrent-payment |
| Official endpoint(s) | `POST https://api.bog.ge/payments/v1/ecommerce/orders/:parent_order_id` |
| HTTP method | `POST` |
| Authentication | Bearer JWT; headers/body/response same as Order Request |
| Important request fields | Path `parent_order_id`; same body as create-order (`callback_url`, `purchase_units`, …) |
| Important response fields | `id`, `_links.redirect` (customer still pays on BOG page without re-entering PAN) |
| Idempotency-Key | Same as Order Request (UUID v4) |
| payment_method | Inherited from order request body; details `payment_option=recurrent` |
| Callback / reconciliation | Same signed callback + Payment Details |
| Merchant activation | Saved-card product |
| Current Luma status | Implemented for authenticated owners of a recurrent method |
| Implementation | `src/server/payments/initiate.ts`, `client.ts` |
| DB | `Payment.parentProviderOrderId`, `savedPaymentMethodId` |
| Checkout UI | Shown only when customer has an active recurrent card and capability is on |
| Admin UI | Shows parent BOG order id |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 12. Automatic Payment by the Saved Card

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/saved-card/offline-payment |
| Official endpoint(s) | `POST https://api.bog.ge/payments/v1/ecommerce/orders/:parent_order_id/subscribe` |
| HTTP method | `POST` |
| Authentication | Bearer JWT |
| Important request fields | Path `parent_order_id`. Optional `callback_url`, `external_order_id`. Remaining amount/currency/buyer taken from the **parent** order by BOG |
| Important response fields | `id`, `_links.details` (no redirect; off-session) |
| Idempotency-Key | Optional UUID v4 |
| payment_method | `payment_option=subscription` |
| Callback / reconciliation | Callback + Payment Details; never mark paid from the 202/create response alone |
| Merchant activation | Automatic-payment permission |
| Current Luma status | Provider function implemented and tested with mocks. **No storefront/admin workflow** unless `BOG_AUTOMATIC_CHARGE_WORKFLOW_ENABLED=true` (default false). Luma has no subscription product |
| Implementation | `src/server/payments/bog/savedCard.ts` |
| DB | `ProviderAction` type `automatic_charge` |
| Checkout UI | Hidden |
| Admin UI | Hidden unless workflow flag |
| Production test status | Mocked; not live |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 13. Complete Pre-Authorization (index)

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/preauthorization/ |
| **Classification** | **NOT APPLICABLE TO LUMA** — navigation index |

---

## 14. Pre-authorization introduction

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/preauthorization/introduction |
| Official endpoint(s) | Uses Order Request `capture=manual` plus confirm/reject |
| HTTP method | See children |
| Authentication | Bearer |
| Important request fields | `capture: manual` on create-order. Allowed only for card, Apple Pay, Google Pay. Hold lasts 30 days if not completed |
| Important response fields | Payment Details `order_status.key`: `auth_requested`, `blocked`, `partial_completed` |
| Idempotency-Key | On create-order and subsequent actions |
| payment_method | `card`, `google_pay`, `apple_pay` |
| Callback / reconciliation | Callback covers preauth approvals; `blocked` is **AUTHORIZED**, not PAID |
| Merchant activation | Pre-authorization / manual capture |
| Current Luma status | Implemented; `capture=manual` only for card / Apple Pay / Google Pay when `BOG_PREAUTHORIZATION_ENABLED` |
| Implementation | `src/server/payments/bog/preauth.ts`, `status.ts`, admin capture/void |
| DB | `Payment.captureMode`, `authorizedAmount`, `capturedAmount`; attempt status `authorized` / `voided` |
| Checkout UI | No separate “preauth” button |
| Admin UI | Authorized vs captured; capture/reject with confirmation |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 15. Confirm Pre-Authorization

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/preauthorization/approve |
| Official endpoint(s) | `POST https://api.bog.ge/payments/v1/payment/authorization/approve/:order_id` |
| HTTP method | `POST` |
| Authentication | Bearer JWT |
| Important request fields | Optional `amount` (omit = full capture; send amount for partial), optional `description`. Split object may be included per Split Payment docs when capturing |
| Important response fields | `key=request_received`, `message`, `action_id`. **Not final** — wait for Payment Details / callback (`completed` or `partial_completed`) |
| Idempotency-Key | Optional UUID v4 |
| payment_method | Same authorized payment |
| Callback / reconciliation | Required; duplicate capture rejected locally |
| Merchant activation | Preauth |
| Current Luma status | Implemented |
| Implementation | `src/server/payments/bog/preauth.ts`, admin actions |
| DB | `ProviderAction` type `capture` |
| Admin UI | Full / partial capture when status is `authorized` |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 16. Reject Pre-Authorization

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/preauthorization/reject |
| Official endpoint(s) | `POST https://api.bog.ge/payments/v1/payment/authorization/cancel/:order_id` |
| HTTP method | `POST` |
| Authentication | Bearer JWT |
| Important request fields | Optional `description` |
| Important response fields | `key=request_received`, `action_id`. Final via details (`rejected`) |
| Idempotency-Key | Optional UUID v4 |
| payment_method | — |
| Callback / reconciliation | Associated split request becomes `canceled` (Split Payment docs) |
| Merchant activation | Preauth |
| Current Luma status | Implemented |
| Implementation | `src/server/payments/bog/preauth.ts` |
| DB | Attempt `voided`; inventory/promo release |
| Admin UI | Reject with confirmation |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 17. Pay From Business' Webpage (index)

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/external-orders/ |
| **Classification** | **NOT APPLICABLE TO LUMA** — navigation index |

---

## 18. Online Installment Plan Modal

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/external-orders/modal |
| Official endpoint(s) | SDK `https://webstatic.bog.ge/bog-sdk/bog-sdk.js?client_id={client_id}` (do not pass `version=2`; the live SDK treats it as an API selector and 405s on v2 calculate). Order still `POST /payments/v1/ecommerce/orders` with `payment_method: ["bog_loan"]` or `["bnpl"]` and `config.loan` (`type` = calculator `discount_code`, `month`) |
| HTTP method | SDK + standard create-order `POST` |
| Authentication | SDK uses public `client_id`; order uses Bearer |
| Important request fields | Calculator: `amount`, optional `bnpl`. `onRequest` returns `{ amount, month, discount_code }`. Luma must **not** compute interest or monthly amounts |
| Important response fields | BOG terms only; after server-side order creation Luma calls `successCb(providerOrderId)` so the official SDK can continue |
| Idempotency-Key | On create-order UUID v4 |
| payment_method | `bog_loan` or `bnpl` |
| Callback / reconciliation | Same as standard process |
| Merchant activation | Installment / BNPL agreement and calculator |
| Current Luma status | Implemented, default-off. Existing Luma `installment` (non-BOG, stock committed at placement) is unchanged |
| Implementation | `src/components/checkout/BogInstallmentModal.tsx`, payload `config.loan` |
| DB | `Payment.loanMonth`, `loanDiscountCode` |
| Checkout UI | Shown only when `BOG_INSTALLMENT_ENABLED` / `BOG_BNPL_ENABLED` |
| Admin UI | Shows loan month/code on the attempt |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 19. Google Pay™ on Business' Webpage

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/external-orders/external-googlepay |
| Official endpoint(s) | Standard `POST /payments/v1/ecommerce/orders` with webpage Google Pay config |
| HTTP method | `POST` |
| Authentication | Bearer JWT |
| Important request fields | `payment_method: ["google_pay"]`, `config.google_pay.external=true`, `config.google_pay.google_pay_token` = full Google Pay token string unmodified. Gateway tokenization: `type=PAYMENT_GATEWAY`, `gateway=georgiancard`, `gatewayMerchantId=BCR2DN4TXKPITITV` (documented constant; overridable by env) |
| Important response fields | `id`, `status`, optional `order_details`, `_links.details`, `_links.redirect` (3DS). Token ≠ PAID |
| Idempotency-Key | UUID v4 |
| payment_method | `google_pay` |
| Callback / reconciliation | Always reconcile via details/callback; 3DS redirect is UX |
| Merchant activation | Google Pay on merchant page + BOG method + Google Pay console |
| Current Luma status | Implemented, default-off; token never logged or stored |
| Implementation | `src/server/payments/bog/googlePay.ts`, checkout Google Pay button |
| DB | Payment method `google_pay` |
| Checkout UI | Official Google Pay button only when capability on |
| Admin UI | Method + provider state |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES APPLE/GOOGLE ACTIVATION** |

---

## 20. Apple Pay™ on Business' Webpage

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/external-orders/external-applepay |
| Official endpoint(s) | `POST /payments/v1/ecommerce/orders` with `payment_method: ["apple_pay"]`, `config.apple_pay.external=true`, `application_type=web` |
| HTTP method | `POST` |
| Authentication | Bearer JWT |
| Important request fields | As above |
| Important response fields | `id`, `result` (Apple Pay initiation payload), `_links.accept.href` |
| Idempotency-Key | UUID v4 |
| payment_method | `apple_pay` |
| Callback / reconciliation | After Accept Payment |
| Merchant activation | Apple Pay certificate on domain; email `ecommercemerchants@bog.ge` with domain + API public key; Apple merchant onboarding |
| Current Luma status | Implemented, default-off |
| Implementation | `src/server/payments/bog/applePay.ts` |
| DB | Payment method `apple_pay` |
| Checkout UI | Hidden until Apple + BOG flags |
| Admin UI | Method + provider state |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES APPLE/GOOGLE ACTIVATION** |

---

## 21. Apple Pay™ Accept Payment

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/external-orders/complete-external-applepay |
| Official endpoint(s) | `POST https://api.bog.ge/payments/v1/ecommerce/orders/{order_id}/payment` |
| HTTP method | `POST` |
| Authentication | Bearer JWT |
| Important request fields | `apple_pay_token` full encrypted Apple Pay payload, unmodified |
| Important response fields | `id`, `status`, `order_details`, `_links.details`. Token ≠ PAID |
| Idempotency-Key | Optional UUID v4 |
| payment_method | `apple_pay` |
| Callback / reconciliation | Required |
| Merchant activation | Same as Apple Pay webpage |
| Current Luma status | Implemented; token never logged/stored |
| Implementation | `src/server/payments/bog/applePay.ts` |
| DB | `ProviderAction` `apple_pay_accept` |
| Checkout UI | Completes the Apple sheet |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES APPLE/GOOGLE ACTIVATION** |

---

## 22. Refund

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/refund |
| Official endpoint(s) | `POST https://api.bog.ge/payments/v1/payment/refund/:order_id` |
| HTTP method | `POST` |
| Authentication | Bearer JWT |
| Important request fields | Optional `amount` (omit = full). Partial only for card, Apple Pay, Google Pay. Full also for “BOG authorization”. Cannot cancel once initiated |
| Important response fields | `key=request_received`, `action_id` — **not final** |
| Idempotency-Key | Optional UUID v4 |
| payment_method | Refundability depends on transfer method |
| Callback / reconciliation | `refunded` / `refunded_partially` via details/callback |
| Merchant activation | Refunds on the shop |
| Current Luma status | Full + partial + cumulative protection production-tested for card; extended to Apple/Google Pay methods; loan/BNPL/p2p/loyalty/gift_card not partially refunded |
| Implementation | `src/server/payments/refund.ts`, `refundable.ts`, `refundReconcile.ts` |
| DB | `PaymentRefund` |
| Admin UI | Existing refund form; only legal actions |
| Production test status | Card live; other methods mocked |
| **Classification** | **IMPLEMENTED + TESTED** |

---

## 23. Response Codes

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/response-codes |
| Official endpoint(s) | None — catalog of `payment_detail.code` and action `code` |
| HTTP method | — |
| Authentication | — |
| Important request fields | — |
| Important response fields | Payment: `100` success, `101`–`112`, `122`, `199` unknown, `200` successful preauthorization. Action: `161`–`169`, `179` unknown |
| Idempotency-Key | — |
| payment_method | — |
| Callback / reconciliation | Codes stored on Payment; unknown codes are not treated as permanent failure by themselves |
| Merchant activation | — |
| Current Luma status | Centralized normalizer; Georgian customer copy vs admin diagnostic |
| Implementation | `src/server/payments/bog/responseCodes.ts` |
| DB | Existing `responseCode` / `responseDescription` |
| Checkout / admin | Customer sees safe Georgian text; admin sees code + EN diagnostic |
| Production test status | Mocked catalog tests |
| **Classification** | **IMPLEMENTED + TESTED** |

---

## 24. Split Payment

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/split-payment |
| Official endpoint(s) | `config.split` on create-order; split object on preauth capture |
| HTTP method | Via create-order / approve |
| Authentication | Bearer JWT |
| Important request fields | `split_payments[]`: `iban` + **either** `amount` **or** `percent` (not both). Max 10 parts. GEL only. Methods: `card`, `google_pay`, `apple_pay`, `bog_loyalty`, `bog_p2p`. Other methods: full amount to main account, split not executed |
| Important response fields | Payment Details `split.split_status`: `created`, `processing`, `canceled`, `completed`, `rejected` |
| Idempotency-Key | On parent create/capture |
| payment_method | Compatibility as above |
| Callback / reconciliation | Callback includes split updates. **Refund does not reverse** a completed/in-progress split |
| Merchant activation | Split product; GEL IBANs; sufficient main-account balance |
| Current Luma status | Implemented; destinations from admin/system config only (never customer-submitted) |
| Implementation | `src/server/payments/bog/split.ts`, `BogSplitRecipient` |
| DB | Recipients + `Payment.splitStatus` / `splitSnapshot` |
| Checkout UI | None (customer cannot choose IBANs) |
| Admin UI | Split status + note that refund does not reverse partner transfers |
| Production test status | Mocked |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 25. Google Pay™ (BOG-hosted)

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/googlepay |
| Official endpoint(s) | No extra API — enable in Business Manager; Google Pay appears on the BOG payment window. Create-order may pass `payment_method` including `google_pay` (also allows card) |
| HTTP method | Standard create-order |
| Authentication | Bearer |
| Important request fields | Optional `payment_method: ["google_pay"]` (or combined with card). Billing address recommended for some 3DS |
| Important response fields | Same as Order Request; 3DS handled by BOG |
| Idempotency-Key | UUID v4 on create-order |
| payment_method | `google_pay` |
| Callback / reconciliation | Standard |
| Merchant activation | Business Manager Google Pay onboarding + Google ToS |
| Current Luma status | When `BOG_HOSTED_GOOGLE_PAY_ENABLED`, Card create-order includes `google_pay`. No Luma Google Pay button. `config.google_pay.external` is not sent |
| Implementation | `src/server/payments/bog/capabilities.ts`, `payload.ts` |
| DB | Unchanged (method comes back on details) |
| Checkout UI | Still the card option; BOG page may show Google Pay |
| Admin UI | Transfer method from details |
| Production test status | Mocked config tests; live requires activation |
| **Classification** | **IMPLEMENTED + REQUIRES BOG ACTIVATION** |

---

## 26. Terms Used

| Field | Value |
| --- | --- |
| Documentation | https://api.bog.ge/docs/en/payments/terms-used |
| Official endpoint(s) | None |
| Notes | Defines Business, Online Payments Page, Callback, credentials, PAN |
| **Classification** | **NOT APPLICABLE TO LUMA** — glossary only. Luma follows these terms (never stores PAN/CVV) |

---

## Sidebar completeness

Inspected sidebar links (exact hrefs):

1. `/docs/en/payments/introduction`
2. `/docs/en/payments/authentication`
3. `/docs/en/payments/standard-process/`
4. `/docs/en/payments/standard-process/create-order`
5. `/docs/en/payments/standard-process/get-payment-details`
6. `/docs/en/payments/standard-process/callback`
7. `/docs/en/payments/saved-card/`
8. `/docs/en/payments/saved-card/recurrent`
9. `/docs/en/payments/saved-card/offline`
10. `/docs/en/payments/saved-card/delete`
11. `/docs/en/payments/saved-card/recurrent-payment`
12. `/docs/en/payments/saved-card/offline-payment`
13. `/docs/en/payments/preauthorization/`
14. `/docs/en/payments/preauthorization/introduction`
15. `/docs/en/payments/preauthorization/approve`
16. `/docs/en/payments/preauthorization/reject`
17. `/docs/en/payments/external-orders/`
18. `/docs/en/payments/external-orders/modal`
19. `/docs/en/payments/external-orders/external-googlepay`
20. `/docs/en/payments/external-orders/external-applepay`
21. `/docs/en/payments/external-orders/complete-external-applepay`
22. `/docs/en/payments/refund`
23. `/docs/en/payments/response-codes`
24. `/docs/en/payments/split-payment`
25. `/docs/en/payments/googlepay`
26. `/docs/en/payments/terms-used`

No Payments sidebar section is omitted.

## Capability flags (defaults)

All activation-gated flags default **false** except standard card, which follows existing `BOG_PAYMENTS_ENABLED` / credentials.

See `src/server/payments/bog/capabilities.ts` and `docs/bog-onboarding.md`.

## Implementation notes (this change set)

- Standard card create-order uses `capture: automatic` and `payment_method: ["card"]` plus flagged hosted methods. Loan/BNPL are never added to the Card list. `capture=manual` is never applied to loan/BNPL/saved-card even if the preauth merchant flag is on.
- `blocked` maps to Luma `authorized` (inventory stays HELD). `partial_completed` maps to `paid`.
- `request_received` on capture/reject/refund is stored as accepted, not completed.
- Automatic saved-card charging is implemented as a provider function and remains workflow-disabled.
- Existing Luma `installment` (non-BOG, stock committed at placement) is unchanged.

