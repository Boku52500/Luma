/**
 * Development-only PostgreSQL health + catalog DAL check.
 * Not used by the storefront. Run with `npm run db:verify`.
 */
import "dotenv/config";

import { allCategories } from "../src/data/categories";
import { allProducts, featuredProducts, newArrivals } from "../src/data/products";
import { getBrands } from "../src/server/catalog/brands";
import { getCategories, getCategoryBySlug } from "../src/server/catalog/categories";
import {
  getProductBySlug,
  getProducts,
  getProductsByCategory,
  getRecommendedProducts,
  getRelatedProducts,
} from "../src/server/catalog/products";
import { toStorefrontProduct } from "../src/server/catalog/toStorefrontProduct";
import { getSearchSuggestions, searchBrands, searchCategories, searchProducts } from "../src/server/search/search";
import { toDeveloperDatabaseError } from "../src/server/env";
import { pingDatabase, prisma } from "../src/server/prisma";

const IPHONE_SLUG = "apple-iphone-15-pro-128";
const LAPTOP_SLUG = "apple-macbook-air-m3";
const UNKNOWN_SLUG = "this-product-does-not-exist";

function fail(message: string): never {
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) fail(message);
}

function assertJsonSafe(value: unknown, path: string): void {
  if (value == null || typeof value !== "object") return;
  const name = value.constructor?.name;
  if (name === "Decimal" || name === "Date") {
    fail(`Non-serializable ${name} leaked into catalog DTO at ${path}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    assertJsonSafe(nested, `${path}.${key}`);
  }
}

async function main() {
  console.log("Luma database verify");

  await pingDatabase();
  console.log("  PostgreSQL reachable");

  const [productCount, brandCount, categoryCount, translationCount, imageCount, variantCount, specCount] =
    await Promise.all([
      prisma.product.count(),
      prisma.brand.count(),
      prisma.category.count(),
      prisma.productTranslation.count({ where: { locale: "ka" } }),
      prisma.productImage.count(),
      prisma.productVariant.count(),
      prisma.productSpecification.count(),
    ]);

  assert(productCount > 0, "No products found. Run `npm run db:seed`.");
  assert(brandCount > 0, "No brands found. Run `npm run db:seed`.");
  assert(categoryCount > 0, "No categories found. Run `npm run db:seed`.");
  assert(translationCount >= productCount, "Every product must have a Georgian translation.");
  assert(imageCount > 0, "No product images found.");
  assert(specCount > 0, "No product specifications found.");

  console.log(
    `  Counts: ${productCount} products, ${brandCount} brands, ${categoryCount} categories, ${imageCount} images, ${variantCount} variants, ${specCount} specs`,
  );

  const iphoneRow = await prisma.product.findUnique({
    where: { slug: IPHONE_SLUG },
    include: {
      translations: true,
      brand: { include: { translations: true } },
      category: true,
      images: true,
      specifications: true,
      variants: true,
    },
  });
  assert(iphoneRow, `Missing product slug ${IPHONE_SLUG}`);
  assert(iphoneRow.translations.some((row) => row.locale === "ka" && row.name.includes("iPhone 15 Pro")), "iPhone 15 Pro is missing a Georgian translation");
  assert(iphoneRow.brand.slug === "apple", `Expected Apple brand, got ${iphoneRow.brand.slug}`);
  assert(iphoneRow.categoryId === "phones", `Expected phones category, got ${iphoneRow.categoryId}`);
  assert(iphoneRow.price.toFixed(2) === "3299.00", `Expected iPhone price 3299.00, got ${iphoneRow.price.toString()}`);
  assert(iphoneRow.images.length > 0, "iPhone 15 Pro has no images");
  assert(iphoneRow.specifications.length > 0, "iPhone 15 Pro has no specifications");
  assert(iphoneRow.variants.length > 0, "iPhone 15 Pro has no variants");
  console.log(
    `  ${IPHONE_SLUG}: ka="${iphoneRow.translations.find((row) => row.locale === "ka")?.name}", price=${iphoneRow.price.toFixed(2)}, images=${iphoneRow.images.length}, specs=${iphoneRow.specifications.length}, variants=${iphoneRow.variants.length}`,
  );

  const laptopRow = await prisma.product.findUnique({
    where: { slug: LAPTOP_SLUG },
    include: { translations: true, category: true },
  });
  assert(laptopRow, `Missing product slug ${LAPTOP_SLUG}`);
  assert(laptopRow.categoryId === "laptops", `Expected laptops category for ${LAPTOP_SLUG}`);
  assert(laptopRow.price.toFixed(2) === "3599.00", `Expected MacBook price 3599.00, got ${laptopRow.price.toString()}`);
  console.log(`  ${LAPTOP_SLUG}: category=${laptopRow.categoryId}, price=${laptopRow.price.toFixed(2)}`);

  const phonesTree = await getCategoryBySlug("phones");
  assert(phonesTree, "getCategoryBySlug('phones') returned null");
  assert(phonesTree.name === "ტელეფონები", `Unexpected phones name: ${phonesTree.name}`);
  const smartphones = await getCategoryBySlug("phones-smartphones");
  assert(smartphones?.parentId === "phones", "phones-smartphones should nest under phones");
  const applePhones = await getCategoryBySlug("phones-apple");
  assert(applePhones?.parentId === "phones-smartphones", "phones-apple should nest under phones-smartphones");
  assert(await getCategoryBySlug(UNKNOWN_SLUG) === null, "Unknown category slug should return null");

  const iphone = await getProductBySlug(IPHONE_SLUG);
  assert(iphone, "getProductBySlug(iPhone) returned null");
  assert(typeof iphone.price === "number", "Catalog DTO price must be a number, not Decimal");
  assert(iphone.price === 3299, `DTO price ${iphone.price} !== 3299`);
  assert(iphone.brand.name === "Apple", "DTO brand mapping failed");
  assert(iphone.category.slug === "phones", "DTO category mapping failed");
  assert(iphone.images.length > 0 && iphone.specs.length > 0 && iphone.variants.length > 0, "DTO missing images/specs/variants");
  assert(iphone.installments.length > 0, "iPhone DTO missing installment terms");
  assert(iphone.ratingAverage === 4.8, `iPhone rating ${iphone.ratingAverage} !== 4.8`);
  assert(iphone.badgeKind === "bestseller", `iPhone badge ${iphone.badgeKind} !== bestseller`);
  assert(iphone.warranty?.includes("24 თვე"), "iPhone warranty copy missing from DTO");
  assert(iphone.stockStatus === "in-stock", "iPhone stockStatus should be in-stock");
  assertJsonSafe(iphone, "iphone");
  JSON.parse(JSON.stringify(iphone));
  assert((await getProductBySlug(UNKNOWN_SLUG)) === null, "Unknown product slug should return null");

  const listed = await getProducts();
  assert(listed.length === productCount, `getProducts() returned ${listed.length}, expected ${productCount}`);
  listed.slice(0, 3).forEach((product, index) => assertJsonSafe(product, `getProducts[${index}]`));

  const phones = await getProductsByCategory("phones");
  assert(phones.length > 0, "getProductsByCategory('phones') returned no rows");
  assert(
    phones.every((product) => product.category.slug === "phones"),
    "Phone category query returned a product outside phones",
  );
  assert((await getProductsByCategory(UNKNOWN_SLUG)).length === 0, "Unknown category should return no products");

  const brands = await getBrands();
  assert(brands.length === brandCount, `getBrands() returned ${brands.length}, expected ${brandCount}`);
  assert(brands.some((brand) => brand.slug === "apple"), "Apple brand missing from getBrands()");

  const related = await getRelatedProducts(IPHONE_SLUG);
  assert(related.length > 0, "getRelatedProducts(iPhone) returned no rows");
  assert(
    related.every((product) => product.id !== iphone.id),
    "Related products should not include the source product",
  );
  assert((await getRelatedProducts(UNKNOWN_SLUG)).length === 0, "Unknown related-product lookup should return []");

  const recommended = await getRecommendedProducts(IPHONE_SLUG, related.map((product) => product.id));
  assert(recommended.length > 0, "getRecommendedProducts(iPhone) returned no rows");
  assert(
    recommended.every((product) => product.id !== iphone.id && !related.some((row) => row.id === product.id)),
    "Recommended products should exclude the source product and related set",
  );

  const featured = await getProducts({ featured: true });
  assert(featured.length === featuredProducts.length, `Featured count ${featured.length} !== ${featuredProducts.length}`);
  assert(
    featured.map((product) => product.slug).join(",") === featuredProducts.map((product) => product.slug).join(","),
    `Featured order mismatch: ${featured.map((product) => product.slug).join(",")}`,
  );

  const arrivals = await getProducts({ newArrivals: true });
  assert(arrivals.length === newArrivals.length, `New-arrivals count ${arrivals.length} !== ${newArrivals.length}`);
  assert(
    arrivals.map((product) => product.slug).join(",") === newArrivals.map((product) => product.slug).join(","),
    `New-arrivals order mismatch: ${arrivals.map((product) => product.slug).join(",")}`,
  );

  const storefrontIphone = toStorefrontProduct(iphone);
  assert(storefrontIphone.id === "p-1", "Storefront product id must stay canonical with the cart");
  assert(storefrontIphone.visual === "phone", "Storefront visual mapping failed");
  assert(storefrontIphone.availability === "in-stock", "Storefront availability mapping failed");
  assert(storefrontIphone.badge?.kind === "bestseller", "Storefront badge mapping failed");
  assert(storefrontIphone.installmentOptions?.length === iphone.installments.length, "Storefront installment mapping failed");
  assert(typeof storefrontIphone.price === "number", "Storefront price must be a number");
  assertJsonSafe(storefrontIphone, "storefrontIphone");
  JSON.parse(JSON.stringify(storefrontIphone));

  const missingSlugs = allProducts.map((product) => product.slug).filter((slug) => !listed.some((row) => row.slug === slug));
  assert(missingSlugs.length === 0, `Seed missing mock slugs: ${missingSlugs.join(", ")}`);
  assert(listed.length === allProducts.length, `Product count ${listed.length} !== mock catalogue ${allProducts.length}`);

  for (const mock of allProducts) {
    const row = listed.find((product) => product.slug === mock.slug);
    assert(row, `Missing DTO for ${mock.slug}`);
    assert(row.price === mock.price, `Price mismatch for ${mock.slug}: db=${row.price} mock=${mock.price}`);
    assert(row.brand.name === mock.brand, `Brand mismatch for ${mock.slug}`);
    assert(row.category.slug === mock.category, `Category mismatch for ${mock.slug}`);
    if (mock.availability === "out-of-stock") {
      assert(row.stockQuantity === 0, `${mock.slug} should be out of stock`);
    } else {
      assert(row.stockQuantity > 0, `${mock.slug} should have stock`);
    }
  }

  const extraCategories = 2; // phones-smartphones, phones-apple
  assert(
    categoryCount === allCategories.length + extraCategories,
    `Category count ${categoryCount} !== ${allCategories.length} mock + ${extraCategories} hierarchy`,
  );

  const roots = await getCategories();
  assert(roots.some((category) => category.slug === "phones"), "Root categories missing phones");
  assertJsonSafe(roots, "getCategories");
  assertJsonSafe(brands, "getBrands");
  assertJsonSafe(related, "getRelatedProducts");

  console.log("  Catalog DAL, JSON DTOs, storefront mapping, and mock-catalogue parity OK");

  const iphoneSearch = await searchProducts("iphone");
  assert(iphoneSearch.some((product) => product.slug === IPHONE_SLUG), "searchProducts('iphone') missed iPhone 15 Pro");
  assert(
    iphoneSearch[0]?.name.toLowerCase().includes("iphone"),
    `iphone ranking should prefer iPhone products, got ${iphoneSearch[0]?.name}`,
  );
  iphoneSearch.slice(0, 3).forEach((product, index) => assertJsonSafe(product, `searchProducts.iphone[${index}]`));

  const iphone15Search = await searchProducts("iPhone 15");
  assert(iphone15Search.some((product) => product.slug === IPHONE_SLUG), "searchProducts('iPhone 15') missed iPhone 15 Pro");

  const appleSearch = await searchProducts("Apple");
  assert(appleSearch.length > 1, "searchProducts('Apple') should return multiple Apple products");
  assert(
    appleSearch.every((product) => product.brand === "Apple"),
    "searchProducts('Apple') returned a non-Apple product",
  );

  const samsungSearch = await searchProducts("Samsung");
  assert(samsungSearch.some((product) => product.brand === "Samsung"), "searchProducts('Samsung') missed Samsung products");

  const macbookSearch = await searchProducts("MacBook");
  assert(macbookSearch.some((product) => product.slug === LAPTOP_SLUG), "searchProducts('MacBook') missed MacBook Air");

  const rtxSearch = await searchProducts("RTX");
  assert(rtxSearch.length > 0, "searchProducts('RTX') returned no products");
  assert(
    rtxSearch.every((product) => /rtx/i.test(product.name) || (product.keyFeatures ?? []).some((feature) => /rtx/i.test(feature))),
    "searchProducts('RTX') returned an unrelated product",
  );

  const gpuSearch = await searchProducts("4070");
  assert(gpuSearch.some((product) => /4070/.test(product.name)), "searchProducts('4070') missed RTX 4070 products");

  const phonesKa = await searchProducts("ტელეფონი");
  assert(phonesKa.some((product) => product.category === "phones"), "Georgian 'ტელეფონი' should match phones");
  const phoneCategories = await searchCategories("ტელეფონი");
  assert(
    phoneCategories.some((category) => category.id === "phones"),
    "Georgian 'ტელეფონი' should suggest the phones category",
  );

  const laptopsKa = await searchProducts("ლეპტოპი");
  assert(laptopsKa.some((product) => product.category === "laptops"), "Georgian 'ლეპტოპი' should match laptops");

  const skuSearch = await searchProducts(iphone.sku);
  assert(skuSearch[0]?.slug === IPHONE_SLUG, `SKU search should rank ${iphone.sku} first, got ${skuSearch[0]?.slug}`);

  assert((await searchProducts("zzzznotaproduct")).length === 0, "Nonsense query should return no products");
  assert((await searchProducts("   ")).length === 0, "Whitespace-only query should return no products");
  assert((await searchProducts("x")).length === 0, "One-character query should return no products");
  assert((await searchProducts("")).length === 0, "Empty query should return no products");

  const appleBrands = await searchBrands("Apple");
  assert(appleBrands.includes("Apple"), "searchBrands('Apple') missed Apple");

  const suggestions = await getSearchSuggestions("iphone");
  assert(suggestions.products.length > 0, "getSearchSuggestions('iphone') returned no products");
  assert(suggestions.products.length <= 5, "Autocomplete should not return the full catalogue");
  assert(suggestions.categories.length <= 3, "Category suggestions should be bounded");
  assert(suggestions.brands.length <= 3, "Brand suggestions should be bounded");
  assertJsonSafe(suggestions, "getSearchSuggestions.iphone");
  JSON.parse(JSON.stringify(suggestions));

  console.log("  Search DAL, ranking, Georgian matching, and suggestion limits OK");

  const customerColumns = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Customer'
      AND column_name IN ('passwordHash', 'emailVerified')
  `;
  const customerColumnNames = customerColumns.map((row) => row.column_name);
  assert(customerColumnNames.includes("passwordHash"), "Customer.passwordHash is missing");
  assert(customerColumnNames.includes("emailVerified"), "Customer.emailVerified is missing");

  const uniqueIndexes = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'Customer_email_key',
        'Order_orderNumber_key',
        'WishlistItem_customerId_productId_key',
        'PasswordResetToken_tokenHash_key'
      )
  `;
  const indexNames = new Set(uniqueIndexes.map((row) => row.indexname));
  assert(indexNames.has("Customer_email_key"), "Unique index on Customer.email is missing");
  assert(indexNames.has("Order_orderNumber_key"), "Unique index on Order.orderNumber is missing");
  assert(indexNames.has("WishlistItem_customerId_productId_key"), "Unique wishlist customer/product index is missing");
  assert(indexNames.has("PasswordResetToken_tokenHash_key"), "Unique index on PasswordResetToken.tokenHash is missing");

  const orderCustomerFk = await prisma.$queryRaw<{ confdeltype: string }[]>`
    SELECT confdeltype::text AS confdeltype
    FROM pg_constraint
    WHERE conname = 'Order_customerId_fkey'
  `;
  assert(orderCustomerFk[0]?.confdeltype === "n", "Order.customerId must SET NULL on customer delete, not cascade");

  const resetTable = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'PasswordResetToken'
    ) AS exists
  `;
  assert(resetTable[0]?.exists, "PasswordResetToken table is missing");

  const roleColumn = await prisma.$queryRaw<{ data_type: string; column_default: string | null }[]>`
    SELECT data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Customer' AND column_name = 'role'
  `;
  assert(roleColumn[0], "Customer.role column is missing");
  assert(
    (roleColumn[0].column_default ?? "").includes("CUSTOMER"),
    "Customer.role must default to CUSTOMER",
  );

  const roleValues = await prisma.$queryRaw<{ role: string }[]>`
    SELECT unnest(enum_range(NULL::"CustomerRole"))::text AS role
  `;
  const roleSet = new Set(roleValues.map((row) => row.role));
  assert(roleSet.has("CUSTOMER") && roleSet.has("ADMIN"), "CustomerRole enum must include CUSTOMER and ADMIN");

  const imageObjectKey = await prisma.$queryRaw<{ data_type: string }[]>`
    SELECT data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ProductImage' AND column_name = 'objectKey'
  `;
  assert(imageObjectKey[0], "ProductImage.objectKey column is missing");

  const paymentTable = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'Payment'
  `;
  assert(paymentTable[0], "Payment table is missing");

  const paymentStatusValues = await prisma.$queryRaw<{ value: string }[]>`
    SELECT unnest(enum_range(NULL::"PaymentStatus"))::text AS value
  `;
  const paymentStatusSet = new Set(paymentStatusValues.map((row) => row.value));
  assert(paymentStatusSet.has("processing") && paymentStatusSet.has("partially_refunded"), "PaymentStatus must include processing and partially_refunded");

  const paymentCount = await prisma.payment.count();
  assert(paymentCount >= 0, "Payment count query failed");

  const refundTable = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'PaymentRefund'
    ) AS exists
  `;
  assert(refundTable[0]?.exists, "PaymentRefund table is missing");

  const refundStatusValues = await prisma.$queryRaw<{ value: string }[]>`
    SELECT unnest(enum_range(NULL::"PaymentRefundStatus"))::text AS value
  `;
  const refundStatusSet = new Set(refundStatusValues.map((row) => row.value));
  assert(
    refundStatusSet.has("requested") && refundStatusSet.has("processing") && refundStatusSet.has("completed") && refundStatusSet.has("failed"),
    "PaymentRefundStatus must include requested, processing, completed, failed",
  );

  const emailTable = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'EmailDelivery'
    ) AS exists
  `;
  assert(emailTable[0]?.exists, "EmailDelivery table is missing");

  const emailEventValues = await prisma.$queryRaw<{ value: string }[]>`
    SELECT unnest(enum_range(NULL::"EmailEventType"))::text AS value
  `;
  const emailEventSet = new Set(emailEventValues.map((row) => row.value));
  assert(
    emailEventSet.has("password_reset") &&
      emailEventSet.has("order_confirmation") &&
      emailEventSet.has("payment_paid") &&
      emailEventSet.has("refund_partial") &&
      emailEventSet.has("refund_full") &&
      emailEventSet.has("order_status"),
    "EmailEventType must include password_reset, order_confirmation, payment_paid, refund_partial, refund_full, order_status",
  );

  const emailKeyIndex = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'EmailDelivery_eventKey_key'
  `;
  assert(emailKeyIndex[0], "Unique index on EmailDelivery.eventKey is missing");

  console.log("  Auth/order constraints: unique email, wishlist pair, order number, password reset tokens, order FK SET NULL, Customer.role, ProductImage.objectKey, Payment attempts, PaymentRefund, EmailDelivery");
  console.log("Database verify passed.");
}

main()
  .catch((error) => {
    console.error(toDeveloperDatabaseError(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
