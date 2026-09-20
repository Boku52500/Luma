import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = join(process.cwd(), "src");

function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("storefront compare and review removal", () => {
  it("removes dead compare/review component files", () => {
    for (const file of [
      "components/product/CompareButton.tsx",
      "components/product/ProductRating.tsx",
      "components/product/ProductReviews.tsx",
    ]) {
      assert.equal(existsSync(join(root, file)), false, file);
    }
  });

  it("keeps compare and review UI off the product page", () => {
    const page = read("app/product/[slug]/page.tsx");
    assert.equal(page.includes("ProductReviews"), false);
    assert.equal(page.includes("ProductRating"), false);
    assert.equal(page.includes("CompareButton"), false);
    assert.equal(page.includes('id="reviews"'), false);
  });

  it("keeps compare and ratings off shared product surfaces", () => {
    for (const file of [
      "components/product/ProductCard.tsx",
      "components/product/ProductListItem.tsx",
      "components/product/ProductInfo.tsx",
      "components/product/ProductActions.tsx",
    ]) {
      const source = read(file);
      assert.equal(source.includes("ProductRating"), false, file);
      assert.equal(source.includes("CompareButton"), false, file);
      assert.equal(source.includes("ProductReviews"), false, file);
    }
  });

  it("removes rating filters from category faceting", () => {
    const filters = read("components/category/filters.ts");
    assert.equal(filters.includes("minRating"), false);
    assert.equal(filters.includes('"rating"'), false);
    const sidebar = read("components/category/FilterSidebar.tsx");
    assert.equal(sidebar.includes("შეფასება"), false);
  });
});

describe("search suggestion cancellation", () => {
  it("aborts stale in-flight requests in useSearchBox", () => {
    const hook = read("components/layout/search/useSearchBox.ts");
    assert.match(hook, /AbortController/);
    assert.match(hook, /requestIdRef/);
    assert.match(hook, /controller\.abort\(\)/);
  });
});

describe("mini-cart on add to cart", () => {
  it("opens the mini-cart after a successful add", () => {
    const button = read("components/product/AddToCartButton.tsx");
    assert.match(button, /useMiniCart|openWithItem/);
    const store = read("lib/cartStore.ts");
    assert.match(store, /CartLineItem \| null/);
  });

  it("does not lock page scroll for the desktop popover", () => {
    const popover = read("components/cart/MiniCartPopover.tsx");
    assert.match(popover, /if \(isMobile\) document\.body\.style\.overflow = "hidden"/);
  });

  it("opens CartDrawer from the header cart icon, not MiniCartPopover", () => {
    const button = read("components/cart/HeaderCartButton.tsx");
    assert.match(button, /openDrawer\(\)/);
    assert.match(button, /if \(open\) close\(\)/);
    assert.doesNotMatch(button, /openWithItem|toggle\(\)/);
  });
});

describe("hero carousel controls", () => {
  it("renders image-only slides without storefront CTA text", () => {
    const hero = read("components/home/HeroCarousel.tsx");
    assert.doesNotMatch(hero, /იხილე მეტი/);
    assert.match(hero, /object-contain/);
    assert.match(hero, /aspect-\[28\/9\]/);
    assert.doesNotMatch(hero, /object-cover/);
    assert.match(hero, /StorefrontHeroSlide/);
  });
});

describe("storefront branding pass", () => {
  it("uses Logo.png and removes the top utility bar", () => {
    assert.match(read("components/layout/Logo.tsx"), /\/Logo\.png/);
    assert.equal(existsSync(join(root, "components/layout/TopUtilityBar.tsx")), false);
    assert.doesNotMatch(read("components/layout/Header.tsx"), /TopUtilityBar/);
  });

  it("configures favicon metadata and #8f1eae brand token", () => {
    assert.match(read("app/layout.tsx"), /favicon-96x96\.png/);
    assert.match(read("app/globals.css"), /--color-brand-600:\s*#8f1eae/);
  });

  it("renders the storefront logo from public/Logo.png without optimizer cache", () => {
    const logo = read("components/layout/Logo.tsx");
    assert.match(logo, /src="\/Logo\.png"/);
    assert.match(logo, /unoptimized/);
    assert.match(logo, /LOGO_WIDTH\s*=\s*1863/);
    assert.match(logo, /LOGO_HEIGHT\s*=\s*476/);
  });
});

describe("interactive cursor defaults", () => {
  it("applies pointer cursor to interactive storefront elements globally", () => {
    const css = read("app/globals.css");
    assert.match(css, /cursor:\s*pointer/);
  });
});

describe("buy now uses checkout instead of coming-soon copy", () => {
  it("adds to the cart and navigates to checkout without obsolete help text", () => {
    const button = read("components/product/BuyNowButton.tsx");
    assert.match(button, /router\.push\("\/checkout"\)/);
    assert.match(button, /addItem\(/);
    assert.doesNotMatch(button, /გადახდის სისტემა მალე ხელმისაწვდომი იქნება/);
    assert.match(read("components/product/ProductActions.tsx"), /disabled=\{unavailable\}/);
  });
});

describe("header and footer logo", () => {
  it("targets the homepage from header and footer logos", () => {
    assert.match(read("components/layout/Logo.tsx"), /href="\/"/);
    assert.match(read("components/layout/Logo.tsx"), /scrollHomeLogoToTop/);
    assert.match(read("components/layout/Footer.tsx"), /<Logo/);
    assert.match(read("components/layout/StorefrontHeader.tsx"), /<Logo|<Header/);
  });
});

describe("checkout optional labels and line removal", () => {
  it("stacks the optional indicator under the field title", () => {
    const field = read("components/ui/FormField.tsx");
    assert.match(field, /flex flex-col/);
    assert.match(field, /\(არასავალდებულო\)/);
    assert.doesNotMatch(field, / \(არასავალდებულო\)/);
  });

  it("removes checkout lines through the shared cart store", () => {
    const summary = read("components/checkout/CheckoutOrderSummary.tsx");
    assert.match(summary, /removeItem\(line\.id\)/);
    assert.match(summary, /allowRemove/);
    assert.match(read("components/checkout/CheckoutPageClient.tsx"), /EmptyCartState/);
  });
});

describe("homepage trust badges", () => {
  it("does not render the large generic trust section", () => {
    assert.equal(existsSync(join(root, "components/home/TrustSection.tsx")), false);
    assert.doesNotMatch(read("app/page.tsx"), /TrustSection/);
    assert.doesNotMatch(read("app/page.tsx"), /ოფიციალური პროდუქცია/);
  });
});

describe("admin product image upload before save", () => {
  it("allows uploads without a saved product id", () => {
    const manager = read("components/admin/ProductImageManager.tsx");
    assert.doesNotMatch(manager, /ჯერ შეინახეთ პროდუქტი/);
    assert.doesNotMatch(manager, /disabled=\{!productId/);
    assert.match(manager, /discardAdminPendingProductImage/);
    assert.match(read("server/actions/admin.ts"), /createPendingProductImageObjectKey/);
    assert.match(read("server/storage/keys.ts"), /products\/pending/);
    assert.match(read("components/admin/ProductEditor.tsx"), /objectKey: image\.objectKey/);
  });
});
