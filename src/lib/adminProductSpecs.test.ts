import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPastedSpecifications,
  importPastedSpecifications,
  parsePastedSpecificationTable,
  planProductSpecifications,
  resolvePastedSpecificationText,
} from "./adminProductSpecs";

describe("planProductSpecifications", () => {
  it("keeps complete rows and ignores blank rows", () => {
    const plan = planProductSpecifications([
      { specificationId: "", specificationName: "", value: "" },
      { specificationId: "ram", specificationName: "RAM", value: "16GB" },
      { specificationId: "", specificationName: "", value: "   " },
    ]);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.clearAll, false);
    assert.deepEqual(plan.rows, [{ specificationId: "ram", specificationName: "RAM", value: "16GB" }]);
  });

  it("rejects incomplete rows instead of silently dropping them", () => {
    const missingValue = planProductSpecifications([
      { specificationId: "ram", specificationName: "RAM", value: "" },
    ]);
    assert.equal(missingValue.ok, false);

    const missingName = planProductSpecifications([{ specificationId: "", specificationName: "", value: "16GB" }]);
    assert.equal(missingName.ok, false);
  });

  it("allows intentionally clearing all specs", () => {
    const plan = planProductSpecifications([]);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.clearAll, true);
    assert.equal(plan.rows.length, 0);
  });

  it("dedupes the same specification id and keeps the last value", () => {
    const plan = planProductSpecifications([
      { specificationId: "ram", specificationName: "RAM", value: "8GB" },
      { specificationId: "ram", specificationName: "RAM", value: "16GB" },
    ]);
    assert.equal(plan.ok, true);
    if (!plan.ok) return;
    assert.equal(plan.rows.length, 1);
    assert.equal(plan.rows[0]?.value, "16GB");
  });
});

const SAMPLE_PASTE = [
  "##### \u10D6\u10DD\u10D2\u10D0\u10D3\u10D8 \u10D8\u10DC\u10E4\u10DD\u10E0\u10DB\u10D0\u10EA\u10D8\u10D0",
  "",
  "| \u10D1\u10E0\u10D4\u10DC\u10D3\u10D8    | Microsoft |",
  "| --------- | --------- |",
  "| \u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN | Xbox Series S |",
  "| \u10E2\u10D8\u10DE\u10D8      | \u10E1\u10D0\u10D7\u10D0\u10DB\u10D0\u10E8\u10DD \u10D9\u10DD\u10DC\u10E1\u10DD\u10DA\u10D8 |",
  "",
  "##### \u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8",
  "",
  "| \u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8\u10E1 \u10DB\u10EC\u10D0\u10E0\u10DB\u10DD\u10D4\u10D1\u10D4\u10DA\u10D8 | AMD |",
  "| \u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8\u10E1/\u10E9\u10D8\u10DE\u10E1\u10D4\u10E2\u10D8\u10E1 \u10E2\u10D8\u10DE\u10D8 | Ryzen Zen 2 |",
  "| \u10D1\u10D8\u10E0\u10D7\u10D5\u10D4\u10D1\u10D8\u10E1 \u10E0\u10D0\u10DD\u10D3\u10D4\u10DC\u10DD\u10D1\u10D0 | 8 |",
  "",
  "##### \u10D3\u10D0\u10D9\u10D0\u10D5\u10E8\u10D8\u10E0\u10D4\u10D1\u10D8\u10E1 \u10E8\u10D4\u10E1\u10D0\u10EB\u10DA\u10D4\u10D1\u10DA\u10DD\u10D1\u10D0",
  "",
  "| SSD \u10DB\u10DD\u10EA\u10E3\u10DA\u10DD\u10D1\u10D0 | 512 GB |",
  "| \u10E3\u10EA\u10DC\u10DD\u10D1\u10D8 \u10D5\u10D4\u10DA\u10D8 | \u10E0\u10D0\u10E6\u10D0\u10EA |",
  "",
].join("\n");

describe("parsePastedSpecificationTable", () => {
  it("reads table rows and ignores headings and separators", () => {
    const rows = parsePastedSpecificationTable(SAMPLE_PASTE);
    assert.deepEqual(
      rows.map((row) => row.name),
      [
        "\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8",
        "\u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN",
        "\u10E2\u10D8\u10DE\u10D8",
        "\u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8\u10E1 \u10DB\u10EC\u10D0\u10E0\u10DB\u10DD\u10D4\u10D1\u10D4\u10DA\u10D8",
        "\u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8\u10E1/\u10E9\u10D8\u10DE\u10E1\u10D4\u10E2\u10D8\u10E1 \u10E2\u10D8\u10DE\u10D8",
        "\u10D1\u10D8\u10E0\u10D7\u10D5\u10D4\u10D1\u10D8\u10E1 \u10E0\u10D0\u10DD\u10D3\u10D4\u10DC\u10DD\u10D1\u10D0",
        "SSD \u10DB\u10DD\u10EA\u10E3\u10DA\u10DD\u10D1\u10D0",
        "\u10E3\u10EA\u10DC\u10DD\u10D1\u10D8 \u10D5\u10D4\u10DA\u10D8",
      ],
    );
    assert.equal(rows.find((row) => row.name === "\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8")?.value, "Microsoft");
    assert.equal(rows.find((row) => row.name === "\u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN")?.value, "Xbox Series S");
    assert.equal(
      rows.some((row) => row.name === "\u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8" || row.name === "\u10D3\u10D0\u10D9\u10D0\u10D5\u10E8\u10D8\u10E0\u10D4\u10D1\u10D8\u10E1 \u10E8\u10D4\u10E1\u10D0\u10EB\u10DA\u10D4\u10D1\u10DA\u10DD\u10D1\u10D0"),
      false,
    );
  });

  it("turns br tags into normal spaces", () => {
    const rows = parsePastedSpecificationTable("| \u10D0\u10E6\u10EC\u10D4\u10E0\u10D0 | \u10DE\u10D8\u10E0\u10D5\u10D4\u10DA\u10D8<br>\u10DB\u10D4\u10DD\u10E0\u10D4<br><br>\u10DB\u10D4\u10E1\u10D0\u10DB\u10D4 |");
    assert.equal(rows[0]?.value, "\u10DE\u10D8\u10E0\u10D5\u10D4\u10DA\u10D8 \u10DB\u10D4\u10DD\u10E0\u10D4 \u10DB\u10D4\u10E1\u10D0\u10DB\u10D4");
  });

  it("ignores any # heading depth and --- separator variants", () => {
    const rows = parsePastedSpecificationTable(
      [
        "# \u10D6\u10DD\u10D2\u10D0\u10D3\u10D8",
        "## \u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8",
        "##### \u10DB\u10D4\u10EE\u10E1\u10D8\u10D4\u10E0\u10D4\u10D1\u10D0",
        "",
        "| \u10D1\u10E0\u10D4\u10DC\u10D3\u10D8 | Microsoft |",
        "| -------- | -------- |",
        "| \u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN | Xbox Series S |",
        "| --- | --- |",
        "| \u10E2\u10D8\u10DE\u10D8 | \u10D9\u10DD\u10DC\u10E1\u10DD\u10DA\u10D8 |",
        "",
      ].join("\n"),
    );
    assert.deepEqual(
      rows.map((row) => row.name),
      ["\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8", "\u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN", "\u10E2\u10D8\u10DE\u10D8"],
    );
  });

  it("parses clipboard-flattened pipe rows on a single line", () => {
    const rows = parsePastedSpecificationTable(
      "| \u10D1\u10E0\u10D4\u10DC\u10D3\u10D8 | Microsoft | | --------- | --------- | | \u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN | Xbox Series S | | \u10E2\u10D8\u10DE\u10D8 | \u10D9\u10DD\u10DC\u10E1\u10DD\u10DA\u10D8 |",
    );
    assert.deepEqual(
      rows.map((row) => [row.name, row.value]),
      [
        ["\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8", "Microsoft"],
        ["\u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN", "Xbox Series S"],
        ["\u10E2\u10D8\u10DE\u10D8", "\u10D9\u10DD\u10DC\u10E1\u10DD\u10DA\u10D8"],
      ],
    );
  });

  it("parses tab-separated pairs when pipes were lost", () => {
    const rows = parsePastedSpecificationTable("\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8\tMicrosoft\n\u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN\tXbox Series S");
    assert.deepEqual(
      rows.map((row) => [row.name, row.value]),
      [
        ["\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8", "Microsoft"],
        ["\u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN", "Xbox Series S"],
      ],
    );
  });
});

describe("resolvePastedSpecificationText", () => {
  it("keeps exact markdown text/plain when pipes are present", () => {
    const plain = "| \u10D1\u10E0\u10D4\u10DC\u10D3\u10D8 | Microsoft |\n| --------- | --------- |\n| \u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN | Xbox |";
    assert.equal(resolvePastedSpecificationText(plain, "<table><tr><td>x</td><td>y</td></tr></table>"), plain);
  });
});

describe("applyPastedSpecifications", () => {
  it("fills matching library specs and reports missing names", () => {
    const result = applyPastedSpecifications(
      [{ key: "existing-brand", specificationId: "brand", specificationName: "\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8", valueId: "old", value: "Sony" }],
      parsePastedSpecificationTable(SAMPLE_PASTE),
      [
        { id: "brand", name: "\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8", values: [{ id: "ms", name: "Microsoft" }] },
        { id: "model", name: "\u10DB\u10DD\u10D3\u10D4\u10DA\u10D8/PN", values: [] },
        { id: "ssd", name: "SSD \u10DB\u10DD\u10EA\u10E3\u10DA\u10DD\u10D1\u10D0", values: [] },
      ],
    );

    assert.equal(result.matched, 3);
    assert.deepEqual(
      result.missing.map((row) => row.name),
      [
        "\u10E2\u10D8\u10DE\u10D8",
        "\u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8\u10E1 \u10DB\u10EC\u10D0\u10E0\u10DB\u10DD\u10D4\u10D1\u10D4\u10DA\u10D8",
        "\u10DE\u10E0\u10DD\u10EA\u10D4\u10E1\u10DD\u10E0\u10D8\u10E1/\u10E9\u10D8\u10DE\u10E1\u10D4\u10E2\u10D8\u10E1 \u10E2\u10D8\u10DE\u10D8",
        "\u10D1\u10D8\u10E0\u10D7\u10D5\u10D4\u10D1\u10D8\u10E1 \u10E0\u10D0\u10DD\u10D3\u10D4\u10DC\u10DD\u10D1\u10D0",
        "\u10E3\u10EA\u10DC\u10DD\u10D1\u10D8 \u10D5\u10D4\u10DA\u10D8",
      ],
    );
    assert.equal(result.rows[0]?.value, "Microsoft");
    assert.equal(result.rows[0]?.valueId, "ms");
    assert.equal(result.rows.find((row) => row.specificationId === "model")?.value, "Xbox Series S");
    assert.equal(result.rows.find((row) => row.specificationId === "ssd")?.value, "512 GB");
  });
});

describe("importPastedSpecifications", () => {
  it("creates missing specifications then fills pasted values", async () => {
    const createdNames: string[] = [];
    const result = await importPastedSpecifications(
      [],
      parsePastedSpecificationTable(
        [
          "| \u10D1\u10E0\u10D4\u10DC\u10D3\u10D8 | Microsoft |",
          "| Dolby Digital | 5.1 |",
          "| \u10D9\u10DD\u10DC\u10E2\u10E0\u10DD\u10DA\u10D4\u10E0\u10D8 | 1 x \u10E3\u10E1\u10D0\u10D3\u10D4\u10DC\u10DD \u10D9\u10DD\u10DC\u10E2\u10E0\u10DD\u10DA\u10D4\u10E0\u10D8 |",
          "|  dolby   digital  | 7.1 |",
          "",
        ].join("\n"),
      ),
      [{ id: "brand", name: "\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8", values: [{ id: "ms", name: "Microsoft" }] }],
      async (name) => {
        createdNames.push(name);
        return { id: `new-${createdNames.length}`, name };
      },
    );

    assert.deepEqual(createdNames, ["Dolby Digital", "\u10D9\u10DD\u10DC\u10E2\u10E0\u10DD\u10DA\u10D4\u10E0\u10D8"]);
    assert.equal(result.matched, 1);
    assert.equal(result.created, 2);
    assert.deepEqual(result.failed, []);
    assert.equal(result.rows.find((row) => row.specificationId === "brand")?.value, "Microsoft");
    assert.equal(result.rows.find((row) => row.specificationName === "Dolby Digital")?.value, "7.1");
    assert.equal(
      result.rows.find((row) => row.specificationName === "\u10D9\u10DD\u10DC\u10E2\u10E0\u10DD\u10DA\u10D4\u10E0\u10D8")?.value,
      "1 x \u10E3\u10E1\u10D0\u10D3\u10D4\u10DC\u10DD \u10D9\u10DD\u10DC\u10E2\u10E0\u10DD\u10DA\u10D4\u10E0\u10D8",
    );
    assert.equal(result.definitions.length, 3);
  });

  it("reports create failures without blocking matched rows", async () => {
    const result = await importPastedSpecifications(
      [],
      parsePastedSpecificationTable("| \u10D1\u10E0\u10D4\u10DC\u10D3\u10D8 | Microsoft |\n| \u10D0\u10EE\u10D0\u10DA\u10D8 | \u10DB\u10DC\u10D8\u10E8\u10D5\u10DC\u10D4\u10DA\u10DD\u10D1\u10D0 |"),
      [{ id: "brand", name: "\u10D1\u10E0\u10D4\u10DC\u10D3\u10D8", values: [] }],
      async (name) => (name === "\u10D0\u10EE\u10D0\u10DA\u10D8" ? null : { id: "x", name }),
    );

    assert.equal(result.matched, 1);
    assert.equal(result.created, 0);
    assert.deepEqual(result.failed, ["\u10D0\u10EE\u10D0\u10DA\u10D8"]);
    assert.equal(result.rows.length, 1);
  });
});
