# Luma database foundation

This is the production-ready PostgreSQL + Prisma layer. Homepage product sections, category PLP, product detail pages, and search read the catalogue from PostgreSQL. Cart stays in **localStorage**. Signed-in wishlists, addresses, profiles, and orders are PostgreSQL-backed. Guest checkout and guest wishlists remain browser-local.

## What this layer is (and is not)

**Is:** schema, migrations, seed, money helpers, catalog queries, Zod input validation, Auth.js credentials sessions, customer/address/wishlist/order server actions, staff admin dashboard.

**Is not:** live card payments, bank installments, courier APIs, inventory warehouses, or server-synced carts.

## Prerequisites

- Node.js 20.19+ (Prisma 7)
- Docker Desktop (recommended) or any PostgreSQL 16+ instance

## Environment

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL`. Set `AUTH_SECRET` (Auth.js). Never commit `.env`.

The example URL matches `docker-compose.yml`:

```
DATABASE_URL="postgresql://luma:luma@localhost:5432/luma?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
AUTH_URL="http://localhost:3000"
```

Optional Cloudflare R2 variables for admin product-image uploads are listed in `.env.example` and documented in `docs/storage.md`. The catalogue works without them.

Production environment, pooling, `prisma migrate deploy`, backups, and the seed guard are in `docs/deployment.md`. Do not run `npm run db:seed` against a live database.

## Start Postgres (Docker)

Requires [Docker Desktop](https://docs.docker.com/desktop/) (or another Docker Engine with Compose v2). This project does not use SQLite.

```bash
npm run db:up          # docker compose up -d --wait
```

Equivalent:

```bash
docker compose up -d --wait
```

Stop (named volume `luma_pgdata` is kept, so data survives):

```bash
npm run db:down        # docker compose down
```

If `docker` is not installed, install Docker Desktop, restart the terminal, then retry. Point `DATABASE_URL` at an existing PostgreSQL 16+ instance only if you are not using Compose.

## ORM commands

```bash
npm run db:generate         # generate Prisma Client into src/generated/prisma
npm run db:validate         # validate schema.prisma
npm run db:migrate          # create/apply a development migration
npm run db:migrate:deploy   # apply existing migrations
npm run db:seed             # rebuild catalogue tables from the mock catalogue
npm run db:verify           # ping Postgres + check seed + catalog DAL
npm run db:studio           # Prisma Studio
```

First-time local setup:

```bash
copy .env.example .env   # Windows; skip if .env already exists
npm run db:up
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
npm run db:verify
```

`prisma.config.ts` loads `.env` via `dotenv` and is where `DATABASE_URL` and the seed command live (Prisma 7).

## Money

Stored as `Decimal(12, 2)` GEL. Do not use JS floats in the database.

Convert at the data-access boundary:

- `numberToMoney` / `moneyToNumber` — 2 decimal places
- `moneyToTetri` / `tetriToMoney` — integer tetri for arithmetic

The existing UI `formatPrice` still takes numbers; catalog queries already return numbers.

## Internationalization

Do not add `nameGe` / `nameEn` / `nameRu` columns. Each translatable entity has a `*Translation` table with `locale` (`ka` | `en` | `ru`) and `@@unique([entityId, locale])`.

Georgian (`ka`) is mandatory. `src/server/locale.ts` falls back to `ka` when a requested locale is missing. Seed currently writes `ka` only.

SEO title/description live on translations. `indexable` and `canonicalOverride` live on the entity.

## Main models

| Area | Models |
| --- | --- |
| Catalogue | `Brand`, `Category` (self-parent, unlimited depth), `Product` |
| Media | `ProductImage` + translations (alt) |
| Variants | `VariantAttribute` → `VariantAttributeOption` → `ProductVariant` (SKU, price override, stock) |
| Specs | `SpecificationGroup` → `SpecificationDefinition` → `ProductSpecification`; `CategorySpecification` assigns specs to categories |
| Customers | `Customer` (`CustomerRole` `CUSTOMER` \| `ADMIN`, bcrypt `passwordHash`, optional `emailVerified`), `PasswordResetToken` (hashed), `Address` (Georgian fields, scoped to customer) |
| Orders | `Order` + `OrderItem` (price/name/SKU/variant snapshots). `customerId` is optional for guests (`ON DELETE SET NULL`) |
| Payments | `Payment` attempts (`PaymentProvider` `bog` today) and `PaymentRefund` rows for admin-initiated BOG card refunds. Card charges live on `Payment`, not as a replacement for `Order.orderNumber`. See `docs/payments-bog.md`. |
| Email | `EmailDelivery` — one row per logical transactional event (`eventKey` unique). Bodies are not stored. See `docs/email.md`. |
| Social | `WishlistItem` (unique customer+product), `Review` (moderation status) |
| Promotions | `Promotion` (percentage/fixed, dates, min order, usage limits) — applied server-side at checkout |

Order/payment statuses are English enums. Georgian labels stay in the frontend.

## Data-access architecture

React components must not import Prisma.

Server-only catalog API (`src/server/catalog`):

- `getProductBySlug`
- `getProducts`
- `getProductsByCategory` (includes descendant categories)
- `getCategoryBySlug` / `getCategories`
- `getBrands`
- `getRelatedProducts`
- `getRecommendedProducts` (cross-category “you might like”, rating-ordered)

Storefront search (`src/server/search`):

- `searchProducts(query, options?)`
- `searchCategories(query)`
- `searchBrands(query)`
- `getSearchSuggestions(query)`
- `loadStorefrontSearchPage(query)`

These are the swap point for later PostgreSQL FTS, `pg_trgm`, Meilisearch, Typesense, or Algolia. The header dropdown and `/search` UI talk to this layer (via a route handler for autocomplete, and the server page loader for results) and should not need a rebuild.

Candidate retrieval uses Prisma `contains` / `mode: "insensitive"` (`ILIKE '%q%'`). Btree indexes on `Product.sku`, `Product.slug` (unique), and translation `name` columns help exact and prefix lookups. Substring `ILIKE` does **not** use those btrees; `pg_trgm` GIN indexes are intentionally not enabled yet because the catalogue is small and ranking still happens in-process. Enable `pg_trgm` (or an external search engine) behind the same functions when result volume needs it.

Autocomplete is `GET /api/search/suggestions?q=` with debounce, AbortController cancellation, bounded limits (5 products / 3 categories / 3 brands), and frontend-safe DTOs. The `/search` page loads a larger ranked set (cap 80) and still filter/sorts client-side. Recent searches stay in the existing localStorage store.

Storefront mapping (`src/server/catalog/toStorefrontProduct.ts`) converts catalog DTOs into the existing frontend `Product` shape so ProductCard / PLP / PDP stay unchanged. Pages load through `src/server/catalog/storefront.ts` (React `cache`, no mock fallback).

`src/server/db.ts` is the Prisma singleton for Next.js (`server-only`). CLI scripts import `@/server/prisma` instead.

Catalog functions return JSON-safe DTOs from `src/server/catalog/mappers.ts` (GEL `number`, never Prisma `Decimal`). `npm run db:verify` asserts that.

Validation for mutations: `src/server/validation` (Zod). Server actions in `src/server/actions` create customers, update profiles/passwords/addresses/wishlists, and create orders. Order submission **does not accept client prices** — live PostgreSQL product data is revalidated in a transaction.

Authentication is Auth.js v5 (Credentials + JWT cookies). Account routes are protected by `src/proxy.ts` and `requireCustomer()` on the server. Admin routes (`/admin/*`) are protected by the same proxy (login redirect) plus `requireAdmin()` / `requireAdminAction()`, which re-read `Customer.role` from PostgreSQL on every page and mutation. Email/password only; OAuth is not wired. Password reset emails go through Resend (`docs/email.md`). The public request always returns the same success so accounts cannot be enumerated.

Promote an existing customer (never a public admin signup):

```bash
npm run admin:promote -- you@example.com
```

See `docs/admin.md`.

## Seed

`prisma/seed.ts` transforms `src/data/products.ts` and `src/data/categories.ts`:

- Brands inferred from product brand names
- All current categories, plus a hierarchy demo: `phones` → `phones-smartphones` → `phones-apple`
- Images as `mock://{visual}?tone={n}` until real photography exists
- Specs and cartesian variants from mock PDP data
- Promo `LUMA10` (cart UI still previews this locally; checkout revalidates against `Promotion`)

The seed deletes catalogue/commerce rows then re-inserts, so a second run does not create duplicates. It is for **development**. Do not run it against production.

`npm run db:verify` confirms the seed and the catalog data-access layer against a live database.

## Frontend

Migrated to PostgreSQL: homepage featured/new-arrival product rows, `/category/[slug]`, `/product/[slug]` (including related products), header search suggestions, and `/search?q=...`. Those routes do not import `src/data` catalogue arrays.

Cart remains browser-local for guests and signed-in customers (`luma:cart`, schema version 2). Wishlist is dual-mode:

- **Logged out:** local snapshot (`luma:wishlist`, version 2), same as before.
- **Logged in:** PostgreSQL `WishlistItem`. Guest ids are merged on login (`skipDuplicates`) and the local list is cleared.
- **Cart pricing** is still the add-time snapshot for UI only. Checkout **revalidates** live PostgreSQL prices, stock, promo, and delivery before inserting `Order` / `OrderItem`. Payment status is `unpaid` — no card charge is attempted.

Still later: real payments, courier APIs, server-synced carts, OAuth.

Product ids and slugs stay canonical (`p-1`, `apple-iphone-15-pro-128`, …) with PostgreSQL. Add-to-cart and wishlist accept the database-backed storefront DTO directly (`addItem(product, quantity, variants)`, `toggle(product)`).

Homepage section membership uses `featuredSort` / `newArrivalSort` rather than `isNew` alone — `isNew` also marks catalogue items that are not in the homepage new-arrivals row. Badges, stock status, RAM/storage filter labels, and Georgian warranty copy are seeded onto the product so the database-backed PDP is not thinner than the previous mock fallbacks.

Catalogue pages render dynamically (`force-dynamic`) so a growing catalogue is not baked into `generateStaticParams`. Unknown slugs use the existing 404 UI. Database failures do not fall back to mock data.
