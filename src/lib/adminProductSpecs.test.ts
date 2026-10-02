import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPastedSpecifications,
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

const SAMPLE_PASTE = `##### ზოგადი ინფორმაცია

| ბრენდი    | Microsoft |
| --------- | --------- |
| მოდელი/PN | Xbox Series S |
| ტიპი      | სათამაშო კონსოლი |

##### პროცესორი

| პროცესორის მწარმოებელი | AMD |
| პროცესორის/ჩიპსეტის ტიპი | Ryzen Zen 2 |
| ბირთვების რაოდენობა | 8 |

##### დაკავშირების შესაძლებლობა

| SSD მოცულობა | 512 GB |
| უცნობი ველი | რაღაც |
`;

describe("parsePastedSpecificationTable", () => {
  it("reads table rows and ignores headings and separators", () => {
    const rows = parsePastedSpecificationTable(SAMPLE_PASTE);
    assert.deepEqual(
      rows.map((row) => row.name),
      [
        "ბრენდი",
        "მოდელი/PN",
        "ტიპი",
        "პროცესორის მწარმოებელი",
        "პროცესორის/ჩიპსეტის ტიპი",
        "ბირთვების რაოდენობა",
        "SSD მოცულობა",
        "უცნობი ველი",
      ],
    );
    assert.equal(rows.find((row) => row.name === "ბრენდი")?.value, "Microsoft");
    assert.equal(rows.find((row) => row.name === "მოდელი/PN")?.value, "Xbox Series S");
    assert.equal(
      rows.some((row) => row.name === "პროცესორი" || row.name === "დაკავშირების შესაძლებლობა"),
      false,
    );
  });

  it("turns br tags into normal spaces", () => {
    const rows = parsePastedSpecificationTable("| აღწერა | პირველი<br>მეორე<br><br>მესამე |");
    assert.equal(rows[0]?.value, "პირველი მეორე მესამე");
  });

  it("ignores any # heading depth and --- separator variants", () => {
    const rows = parsePastedSpecificationTable(`# ზოგადი
## პროცესორი
##### მეხსიერება

| ბრენდი | Microsoft |
| -------- | -------- |
| მოდელი/PN | Xbox Series S |
| --- | --- |
| ტიპი | კონსოლი |
`);
    assert.deepEqual(
      rows.map((row) => row.name),
      ["ბრენდი", "მოდელი/PN", "ტიპი"],
    );
  });

  it("parses clipboard-flattened pipe rows on a single line", () => {
    const rows = parsePastedSpecificationTable(
      "| ბრენდი | Microsoft | | --------- | --------- | | მოდელი/PN | Xbox Series S | | ტიპი | კონსოლი |",
    );
    assert.deepEqual(
      rows.map((row) => [row.name, row.value]),
      [
        ["ბრენდი", "Microsoft"],
        ["მოდელი/PN", "Xbox Series S"],
        ["ტიპი", "კონსოლი"],
      ],
    );
  });

  it("parses tab-separated pairs when pipes were lost", () => {
    const rows = parsePastedSpecificationTable("ბრენდი\tMicrosoft\nმოდელი/PN\tXbox Series S");
    assert.deepEqual(
      rows.map((row) => [row.name, row.value]),
      [
        ["ბრენდი", "Microsoft"],
        ["მოდელი/PN", "Xbox Series S"],
      ],
    );
  });
});

describe("resolvePastedSpecificationText", () => {
  it("keeps exact markdown text/plain when pipes are present", () => {
    const plain = "| ბრენდი | Microsoft |\n| --------- | --------- |\n| მოდელი/PN | Xbox |";
    assert.equal(resolvePastedSpecificationText(plain, "<table><tr><td>x</td><td>y</td></tr></table>"), plain);
  });
});

describe("applyPastedSpecifications", () => {
  it("fills matching library specs and skips unknown names", () => {
    const result = applyPastedSpecifications(
      [{ key: "existing-brand", specificationId: "brand", specificationName: "ბრენდი", valueId: "old", value: "Sony" }],
      parsePastedSpecificationTable(SAMPLE_PASTE),
      [
        { id: "brand", name: "ბრენდი", values: [{ id: "ms", name: "Microsoft" }] },
        { id: "model", name: "მოდელი/PN", values: [] },
        { id: "ssd", name: "SSD მოცულობა", values: [] },
      ],
    );

    assert.equal(result.filled, 3);
    assert.deepEqual(result.skipped, [
      "ტიპი",
      "პროცესორის მწარმოებელი",
      "პროცესორის/ჩიპსეტის ტიპი",
      "ბირთვების რაოდენობა",
      "უცნობი ველი",
    ]);
    assert.equal(result.rows[0]?.value, "Microsoft");
    assert.equal(result.rows[0]?.valueId, "ms");
    assert.equal(result.rows.find((row) => row.specificationId === "model")?.value, "Xbox Series S");
    assert.equal(result.rows.find((row) => row.specificationId === "ssd")?.value, "512 GB");
  });
});
