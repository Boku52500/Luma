import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCategoryProductDeleteBlock,
  type CategoryProductAssignment,
} from "@/lib/categoryProductAssignment";

function assignment(partial: Partial<CategoryProductAssignment>): CategoryProductAssignment {
  return {
    categoryId: "cat-1",
    liveCount: 0,
    archivedCount: 0,
    assignedCount: 0,
    blockers: [],
    ...partial,
  };
}

describe("formatCategoryProductDeleteBlock", () => {
  it("explains archived-only blockers that keep the category FK alive", () => {
    const message = formatCategoryProductDeleteBlock(
      assignment({
        liveCount: 0,
        archivedCount: 2,
        assignedCount: 2,
        blockers: [
          { id: "1", sku: "OLD-1", slug: "old-1", name: "Old One", archived: true },
          { id: "2", sku: "OLD-2", slug: "old-2", name: "Old Two", archived: true },
        ],
      }),
    );
    assert.match(message, /დაარქივებული/);
    assert.match(message, /OLD-1/);
    assert.match(message, /OLD-2/);
    assert.match(message, /არქივი/);
  });

  it("lists live blockers for normal product assignments", () => {
    const message = formatCategoryProductDeleteBlock(
      assignment({
        liveCount: 1,
        archivedCount: 0,
        assignedCount: 1,
        blockers: [{ id: "1", sku: "LIVE-1", slug: "live-1", name: "Live", archived: false }],
      }),
    );
    assert.match(message, /LIVE-1/);
    assert.match(message, /გადაიტანეთ/);
  });
});
