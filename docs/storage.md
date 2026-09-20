# Product image storage (Cloudflare R2)

Luma stores **image binaries in Cloudflare R2** and **metadata in PostgreSQL** (`ProductImage.url`, `ProductImage.objectKey`, alt translations).

Uploads are **server-mediated**: the admin browser posts the file to a Server Action, the server validates and converts it with `sharp`, then writes to R2. Presigned browser-to-R2 uploads are not used. Secrets never leave the server.

## Environment variables

Copy `.env.example` into `.env` and fill these when you have a bucket:

| Variable | Purpose |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_BUCKET_NAME` | Bucket name (e.g. `luma-product-images`) |
| `R2_PUBLIC_URL` | Public origin **without** a trailing slash, used to build stored URLs |

Do not commit real values. `.env` is gitignored.

If any of these are missing, the storefront still serves existing `mock:` and external URLs. Admin upload is disabled with a Georgian configuration message. Uploads are **not** faked and **not** written to the local filesystem.

## Cloudflare setup

1. [Cloudflare dashboard](https://dash.cloudflare.com/) → **R2** → create a bucket.
2. Enable **public access** for that bucket, **or** attach a custom domain (later `images.luma.ge`).
3. Copy the public URL into `R2_PUBLIC_URL` (R2.dev subdomain or your custom domain).
4. **Manage R2 API Tokens** → create a token with **Object Read & Write** limited to this bucket.
5. Put the token’s Access Key ID, Secret Access Key, and your account ID into `.env`.
6. Restart `next dev` so `R2_PUBLIC_URL` is picked up for `next.config` remote image patterns.

## Object keys

Managed files use:

```
products/{productId}/{uuid}.webp
```

Keys are generated on the server. Clients cannot choose a path. Reordering does **not** rename objects.

## Processing

Source files: JPEG, PNG, WebP, AVIF, max **10 MB**. Magic bytes are checked, then `sharp` confirms the image.

Output: WebP, longest edge capped at **1800px**, no upscaling, orientation corrected, metadata stripped, transparency preserved. Quality is catalogue-grade, not aggressively compressed.

## Deletion

- R2-managed rows (`objectKey` set): PostgreSQL row is removed, then the R2 object is deleted. The key is taken from the database, never from the browser.
- Legacy/external URLs (`objectKey` null): only the database row is removed. Other hosts are not contacted.

If R2 upload succeeds and the database insert fails, the object is deleted as compensation. If database delete succeeds and R2 delete fails, the catalogue is correct and the object may be orphaned (safe to garbage-collect later).

## Local development

You can run the shop without R2. Seeded products keep `mock://` illustration URLs.

## Production

Use a dedicated bucket, rotate API tokens, and point `R2_PUBLIC_URL` at a stable public origin so stored URLs do not need rewriting when you move from `*.r2.dev` to `images.luma.ge`.

When the custom domain is ready in Cloudflare (CNAME to the R2 bucket), set `R2_PUBLIC_URL=https://images.luma.ge` and redeploy. Existing rows still contain the URL that was stored at upload time — new uploads use the new origin. Do not attach object-expiration lifecycle rules to product images.

See `docs/deployment.md` for the rest of the production checklist.
