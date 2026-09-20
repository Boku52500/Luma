# BOG / Apple / Google onboarding (cannot be done in source code)

This list is everything Luma cannot finish by deploying code. Until a row is verified, keep the matching env flag **off**. Checkout will not show a button that cannot work.

Do not set these true in production until the named party confirms.

## Bank of Georgia Business Manager

1. **E-commerce shop credentials** — `client_id` / `client_secret` already used for OAuth. Confirm they belong to the production shop.
2. **Callback URL** — HTTPS `https://luma.ge/api/payments/bog/callback` must be reachable. Localhost cannot receive callbacks.
3. **Standard card** — already live. Keep `BOG_PAYMENTS_ENABLED=true` only with real credentials.
4. **Saved card (recurrent / customer-initiated)** — activate the saved-card product. Then set `BOG_SAVED_CARD_RECURRENT_ENABLED=true`.
5. **Saved card (automatic / off-session)** — separate BOG permission from recurrent. Then `BOG_SAVED_CARD_AUTOMATIC_ENABLED=true`. Do **not** enable `BOG_AUTOMATIC_CHARGE_WORKFLOW_ENABLED` unless Luma has an approved automatic-charge use case and explicit customer consent. Luma has no subscription product.
6. **Pre-authorization (manual capture)** — activate manual capture for card / Apple Pay / Google Pay. Then `BOG_PREAUTHORIZATION_ENABLED=true`. Holds expire in 30 days if not captured or rejected.
7. **Installment (`bog_loan`)** — merchant installment agreement, including any 0% plan. Then `BOG_INSTALLMENT_ENABLED=true`.
8. **BNPL (`bnpl`)** — separate BNPL activation. Then `BOG_BNPL_ENABLED=true`.
9. **Split payment** — activate split; main settlement account must cover transfers and fees; destination IBANs must be GEL accounts at local banks. Then `BOG_SPLIT_ENABLED=true` and configure destinations in `BogSplitRecipient` or `BOG_SPLIT_RECIPIENTS` JSON. Customers must never submit IBANs.
10. **Hosted Google Pay** — Business Manager Google Pay onboarding + Google Terms of Service. Then `BOG_HOSTED_GOOGLE_PAY_ENABLED=true`. The button appears on BOG’s payment page; Luma does not draw it. Keep `BOG_EXTERNAL_GOOGLE_PAY_ENABLED` off.
11. **Hosted Apple Pay** — activate Apple Pay on the BOG payment page. Then `BOG_HOSTED_APPLE_PAY_ENABLED=true`. Luma does not draw a button. Keep `BOG_EXTERNAL_APPLE_PAY_ENABLED` off.
12. **BOG P2P / loyalty / gift card** — activate each product, then `BOG_P2P_ENABLED` / `BOG_LOYALTY_ENABLED` / `BOG_GIFT_CARD_ENABLED`. They only appear on the BOG-hosted page.
13. **Additional POS `config.account.tag`** — agree tag values with BOG if multiple ecommerce POS terminals exist. Not configured in Luma until then.

## Google Pay on Luma’s webpage

Official page: [Google Pay on Business' Webpage](https://api.bog.ge/docs/en/payments/external-orders/external-googlepay)

1. Complete Google Pay Business Console / website requirements independently of Luma.
2. Gateway tokenization must stay `PAYMENT_GATEWAY` / `georgiancard` / `gatewayMerchantId=BCR2DN4TXKPITITV` unless BOG issues a replacement.
3. Set `GOOGLE_PAY_ENVIRONMENT=TEST` until Google production access is approved, then `PRODUCTION`.
4. Confirm BOG has `google_pay` enabled for the shop.
5. Then set `BOG_EXTERNAL_GOOGLE_PAY_ENABLED=true`.
6. 3DS, when required, is a BOG redirect. A Google token is **not** payment success.

## Apple Pay on Luma’s webpage

Official pages: [Apple Pay on Business' Webpage](https://api.bog.ge/docs/en/payments/external-orders/external-applepay), [Accept Payment](https://api.bog.ge/docs/en/payments/external-orders/complete-external-applepay)

1. Add the Apple Pay certificate to `luma.ge` as documented by BOG (“Download certificate here” on that page).
2. Email **ecommercemerchants@bog.ge** with the domain and the API public key.
3. Complete Apple merchant / domain verification (Apple Pay JS will not work until Apple and BOG both accept the domain).
4. Confirm BOG has `apple_pay` enabled.
5. Then set `BOG_EXTERNAL_APPLE_PAY_ENABLED=true`.
6. An Apple Pay sheet token is **not** payment success. Luma sends it to BOG Accept Payment, then waits for callback / Payment Details.

## Environment flags (all new flags default off)

Hosted Card methods and calculator buttons follow these flags. Keep `BOG_EXTERNAL_*` false so Luma does not render wallet buttons or send tokens.

```
BOG_HOSTED_GOOGLE_PAY_ENABLED=false
BOG_HOSTED_APPLE_PAY_ENABLED=false
BOG_EXTERNAL_GOOGLE_PAY_ENABLED=false
BOG_EXTERNAL_APPLE_PAY_ENABLED=false
BOG_INSTALLMENT_ENABLED=false
BOG_BNPL_ENABLED=false
BOG_SAVED_CARD_RECURRENT_ENABLED=false
BOG_SAVED_CARD_AUTOMATIC_ENABLED=false
BOG_AUTOMATIC_CHARGE_WORKFLOW_ENABLED=false
BOG_PREAUTHORIZATION_ENABLED=false
BOG_SPLIT_ENABLED=false
BOG_P2P_ENABLED=false
BOG_LOYALTY_ENABLED=false
BOG_GIFT_CARD_ENABLED=false
GOOGLE_PAY_ENVIRONMENT=TEST
# optional override; default is the documented BOG gateway merchant id
# BOG_GOOGLE_PAY_GATEWAY_MERCHANT_ID=BCR2DN4TXKPITITV
# BOG_SPLIT_RECIPIENTS=[{"iban":"GE…","percent":50}]
```

Never put `BOG_CLIENT_SECRET` in the browser. The installment SDK only receives `BOG_CLIENT_ID`.

## Database

Apply the local Prisma migration `20260828140000_bog_payments_extensions` in development only until you explicitly decide to migrate production.

Production migrate is **not** part of this change set.
