# Production deployment

Luma is a Next.js App Router shop with PostgreSQL, Auth.js credentials, optional Cloudflare R2 images, and optional Bank of Georgia card payments. Courier APIs and OAuth are not part of this deployment.

Do not run `prisma migrate dev` or `npm run db:seed` against production.

## Services you need

| Service | Purpose |
|---|---|
| Node.js 20.19+ host | `next start` or a Next.js platform (Vercel, Render, Fly, a VPS, …) |
| Managed PostgreSQL 16+ | Catalogue, customers, orders |
| Cloudflare R2 | Product photos (optional until you upload) |
| HTTPS origin | `https://luma.ge` (example) |

Local Docker PostgreSQL is for development only. Production should use a managed database with automated backups.

## Environment

Copy `.env.example` and fill real values on the host. Never commit `.env`.

Required:

- `DATABASE_URL` — include `sslmode=require` when the provider needs TLS
- `AUTH_SECRET` — 32+ random bytes, not the development placeholder. Generate with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

- `APP_ORIGIN` and `AUTH_URL` — canonical origin, no trailing slash, e.g. `https://luma.ge`

Optional:

- `DATABASE_POOL_MAX` — connections this Node process opens (default 10 in production). Behind PgBouncer or on serverless, use `1`–`5`.
- R2 variables — see `docs/storage.md`. Set `R2_PUBLIC_URL` to `https://images.luma.ge` once DNS exists.
- `IMAGE_REMOTE_HOSTS` — extra `next/image` hostnames
- `RATE_LIMIT_STORE` — `postgres` (production default) or `memory` (single process)
- Bank of Georgia card payments — see `docs/payments-bog.md`. Set `BOG_CLIENT_ID` / `BOG_CLIENT_SECRET` (and optional `BOG_PAYMENTS_ENABLED`) on the host. Callback URL is `${APP_ORIGIN}/api/payments/bog/callback` and must be public HTTPS.
- Transactional email (Resend) — see `docs/email.md`. Set `RESEND_API_KEY` and `EMAIL_FROM` (`Luma <noreply@luma.ge>`). The shop still boots if they are missing locally; production verify requires them.

## Database

1. Create an empty PostgreSQL database.
2. Deploy code that includes `prisma/migrations`.
3. Apply migrations (not `migrate dev`):

```bash
npm run db:migrate:deploy
```

4. Generate the client if the host did not run `postinstall`:

```bash
npm run db:generate
```

5. Check the catalogue exists (`npm run db:verify` or `npm run prod:verify`).

`db:seed` **deletes and rebuilds catalogue tables**. It is blocked when `NODE_ENV=production` unless `ALLOW_PRODUCTION_SEED=true`. Do not use that flag on a live shop.

If PostgreSQL is down, the storefront shows a Georgian error. It does not fall back to mock catalogue data.

### Pooling

Each Node process uses a `pg` pool (`DATABASE_POOL_MAX`). Prefer a provider pooler (PgBouncer / Neon / RDS proxy) in front of the database. Transaction-mode poolers work with this Prisma driver adapter.

Serverless hosts can exhaust connections if `DATABASE_POOL_MAX` is large and instance count is high. Keep it small and use the provider pooler URL in `DATABASE_URL`.

## Build and start

```bash
npm ci
npm run db:migrate:deploy
npm run prod:verify
npm run build
npm run start
```

`npm run build` runs `prisma generate` first because the client in `src/generated` is gitignored.

Health: `GET /api/health` returns `{ ok: true, db: "up" }` or `503` `{ ok: false, db: "down" }`. No credentials or schema details.

## Auth.js

- Credentials + JWT cookies. `trustHost` is on so the host header is accepted behind a proxy.
- Cookies are Secure when `APP_ORIGIN` / `AUTH_URL` is `https:`.
- SameSite=lax (Auth.js default). CSRF is handled by Auth.js for the credentials callback.
- Login failures use one Georgian message and do not say whether the email exists.
- Login/register/reset/checkout/search are rate-limited. Production uses PostgreSQL buckets so multiple instances share the budget.

Promote an admin only from a trusted shell: `npm run admin:promote -- you@example.com`.

Password reset sends mail through Resend when configured. The public request still returns one generic success message and does not reveal whether the email exists. See `docs/email.md`.

## Domain and HTTPS

Choose one canonical host, e.g. `https://luma.ge`, and set `APP_ORIGIN` to it.

`src/proxy.ts` 308-redirects `luma.ge` ↔ `luma.ge` according to that origin. Preview hosts that are neither apex nor www are not redirected.

Point DNS:

1. Apex `luma.ge` → the Next.js host (or the host’s documented apex method).
2. `www` → the same app (CNAME or redirect).
3. Optional `images.luma.ge` → the R2 custom domain.

Terminate TLS at the host or CDN. HSTS is sent when the configured origin is https.

## R2

Keep using the `*.r2.dev` public URL until the custom domain is live. Then set `R2_PUBLIC_URL=https://images.luma.ge` and restart/redeploy so `next.config` picks up the image host.

Do not add lifecycle rules that expire product objects. Orphan objects after a failed R2 delete are safe to garbage-collect later by prefix `products/`.

## Backups

Use the PostgreSQL provider’s automated backups. Aim for:

- Daily (or better) snapshots
- Point-in-time recovery if the plan includes it
- A restore test on a staging database at least once before going live

R2: versioning or object-lock is optional; product images must not auto-delete.

## Rollback

1. Redeploy the previous app release.
2. Do **not** automatically roll back Prisma migrations unless you have a tested down-migration. Additive migrations in this repo are forward-only.
3. Confirm `/api/health` and a product page.

## Hosting notes

The app is a normal Next.js 16 Node server. It is not locked to one vendor.

It needs:

- `sharp` (already a dependency; some hosts must allow native binaries)
- Server Actions body size 12mb (image uploads)
- Persistent or pooled PostgreSQL (not SQLite)

Set `APP_ORIGIN` on every environment so metadata, sitemap, and Auth.js do not emit localhost URLs.
