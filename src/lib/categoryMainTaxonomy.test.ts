import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAIN_CATEGORY_TAXONOMY,
  childMatchKeys,
  categoryMatchKey,
} from "./categoryMainTaxonomy";

describe("categoryMainTaxonomy", () => {
  it("defines 12 main categories", () => {
    assert.equal(MAIN_CATEGORY_TAXONOMY.length, 12);
  });

  it("matches tablet aliases to პლანშეტები", () => {
    const child = MAIN_CATEGORY_TAXONOMY.flatMap((main) => main.children).find((row) => row.name === "პლანშეტები");
    assert.ok(child);
    const keys = childMatchKeys(child!);
    assert.ok(keys.includes(categoryMatchKey("ტაბლეტები")));
    assert.ok(keys.includes(categoryMatchKey("პლანშეტები")));
  });

  it("matches GPU aliases", () => {
    const child = MAIN_CATEGORY_TAXONOMY.flatMap((main) => main.children).find((row) =>
      row.name.includes("ვიდეო"),
    );
    assert.ok(child);
    const keys = childMatchKeys(child!);
    assert.ok(keys.includes(categoryMatchKey("ვიდეო ბარათი")));
    assert.ok(keys.includes(categoryMatchKey("ვიდეო კარტა")));
  });
});
