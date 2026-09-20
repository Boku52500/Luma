# Luma admin

Staff operate the catalogue, orders, and promotions at `/admin`. This is not a public registration flow.

## First administrator

1. Register a normal customer on the storefront (`/register`).
2. Promote that email from a trusted shell (local machine or ops environment):

```bash
npm run admin:promote -- you@example.com
```

3. Sign in with that account and open `/admin`.

Production secrets, HTTPS, and the promote script belong on a trusted machine. See `docs/deployment.md`.

The script looks up the existing `Customer` row and sets `role = ADMIN`. It does not create users, print passwords, or hardcode an email in application code.

Existing customers stay `CUSTOMER` by default. Demotion is a database update of `Customer.role`, not a client flag.

## Authorization

- Unauthenticated visits to `/admin/*` redirect to `/login`.
- Signed-in customers without `ADMIN` are sent to `/forbidden`.
- Every mutation calls `requireAdminAction()`, which checks the Auth.js session **and** the PostgreSQL `Customer.role`. Showing the admin UI is not enough to change data.

## What it manages

Products (including **Cloudflare R2 image uploads**, generic variants, specification groups), categories, brands, orders (fulfillment status plus BOG payment attempts and admin-only card refunds — payment/refund status is provider-controlled; see `docs/payments-bog.md`), and promotions. Order detail shows a compact transactional-email history with retry for failed sends (`docs/email.md`).

Product binaries live in R2. PostgreSQL stores `url` + optional `objectKey`. See `docs/storage.md`.
