import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDiscountPercent } from "./utils";
import { HEADER_SEARCH_STACK_CLASS, CATEGORY_NAV_STACK_CLASS } from "./headerStack";
import { wrapCarouselIndex } from "./heroCarousel";
import {
  ADMIN_COMBOBOX_OPEN_STACK_CLASS,
  ADMIN_EDITOR_BOTTOM_PAD_CLASS,
  ADMIN_STICKY_FOOTER_CLASS,
  ADMIN_STICKY_FOOTER_INNER_CLASS,
} from "@/components/admin/adminUi";

describe("storefront discount badges", () => {
  it("computes genuine discount percentages and ignores merchandising copy", () => {
    assert.equal(getDiscountPercent(85, 100), 15);
    assert.equal(getDiscountPercent(100, 100), null);
    assert.equal(getDiscountPercent(100, undefined), null);
  });
});

describe("primary brand button contrast", () => {
  it("keeps white text on the primary brand background", () => {
    const primary = "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800";
    assert.equal(primary.includes("text-white"), true);
    assert.equal(primary.includes("text-ink"), false);
  });
});

describe("search dropdown stacking", () => {
  it("places the search row above the category navbar in the same sticky header", () => {
    const searchZ = Number(HEADER_SEARCH_STACK_CLASS.match(/z-(\d+)/)?.[1]);
    const navZ = Number(CATEGORY_NAV_STACK_CLASS.match(/z-(\d+)/)?.[1]);
    assert.equal(HEADER_SEARCH_STACK_CLASS.includes("relative"), true);
    assert.equal(CATEGORY_NAV_STACK_CLASS.includes("relative"), true);
    assert.ok(searchZ > navZ);
  });
});

describe("empty cart drawer actions", () => {
  it("stacks compact actions so Georgian labels stay inside the drawer", () => {
    const compact = "flex w-full flex-col gap-2.5 items-stretch";
    assert.equal(compact.includes("flex-col"), true);
    assert.equal(compact.includes("flex-row"), false);
  });
});

describe("hero previous/next wrapping", () => {
  it("goes from slide 0 to the last slide on previous", () => {
    assert.equal(wrapCarouselIndex(-1, 4), 3);
    assert.equal(wrapCarouselIndex(4, 4), 0);
  });
});

describe("admin sticky action footer", () => {
  it("stacks below an open combobox and does not capture leftover hits", () => {
    const footerZ = Number(ADMIN_STICKY_FOOTER_CLASS.match(/z-(\d+)/)?.[1]);
    const comboZ = Number(ADMIN_COMBOBOX_OPEN_STACK_CLASS.match(/z-(\d+)/)?.[1]);
    assert.ok(comboZ > footerZ);
    assert.equal(ADMIN_STICKY_FOOTER_CLASS.includes("pointer-events-none"), true);
    assert.equal(ADMIN_STICKY_FOOTER_INNER_CLASS.includes("pointer-events-none"), true);
    assert.equal(ADMIN_STICKY_FOOTER_INNER_CLASS.includes("[&>*]:pointer-events-auto"), true);
    assert.equal(ADMIN_STICKY_FOOTER_INNER_CLASS.includes("w-fit"), true);
    assert.match(ADMIN_EDITOR_BOTTOM_PAD_CLASS, /pb-\d+/);
  });
});
