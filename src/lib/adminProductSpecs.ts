import { reusableIdentityKey } from "@/lib/reusableLabel";

export type AdminProductSpecInput = {
  specificationId?: string;
  specificationName?: string;
  valueId?: string;
  value?: string;
};

export type PreparedProductSpec = {
  specificationId: string;
  specificationName: string;
  value: string;
};

export type ProductSpecPlan =
  | { ok: true; rows: PreparedProductSpec[]; clearAll: boolean }
  | { ok: false; message: string };

/**
 * Normalize editor specification rows before DB writes.
 * - Blank rows are ignored.
 * - Incomplete rows (name/id without value, or value without name/id) fail loudly
 *   so save never silently shrinks the resolved set and wipe other specs.
 * - Duplicate specification ids keep the last value.
 */
export function planProductSpecifications(inputs: AdminProductSpecInput[]): ProductSpecPlan {
  const prepared: PreparedProductSpec[] = [];
  const seen = new Map<string, number>();

  for (const [index, spec] of inputs.entries()) {
    const value = (spec.value ?? "").trim();
    const specificationId = (spec.specificationId ?? "").trim();
    const specificationName = (spec.specificationName ?? "").trim();
    const blank = !specificationId && !specificationName && !value;
    if (blank) continue;

    if (!value || (!specificationId && !specificationName)) {
      return {
        ok: false,
        message: `სპეციფიკაცია #${index + 1} არასრულია — აირჩიეთ დასახელება და მნიშვნელობა, ან წაშალეთ ცარიელი რიგი.`,
      };
    }

    const row: PreparedProductSpec = {
      specificationId,
      specificationName,
      value,
    };

    if (specificationId) {
      const prior = seen.get(specificationId);
      if (prior != null) {
        prepared[prior] = row;
        continue;
      }
      seen.set(specificationId, prepared.length);
    } else {
      const key = reusableIdentityKey(specificationName);
      const prior = [...seen.entries()].find(([id]) => id.startsWith(`name:${key}`))?.[1];
      if (prior != null) {
        prepared[prior] = row;
        continue;
      }
      seen.set(`name:${key}`, prepared.length);
    }

    prepared.push(row);
  }

  return { ok: true, rows: prepared, clearAll: prepared.length === 0 };
}

export type PastedSpecPair = {
  name: string;
  value: string;
};

export type EditorSpecRow = {
  key: string;
  specificationId: string;
  specificationName: string;
  valueId: string;
  value: string;
};

export type SpecLibraryItem = {
  id: string;
  name: string;
  values: { id: string; name: string }[];
};

const SEPARATOR_CELL = /^:?-{2,}:?$/;

function cleanSpecName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

function cleanSpecValue(raw: string): string {
  return raw
    .replace(/<\s*br\s*\/?\s*>\s*<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .trim();
}

function tableCells(line: string): string[] {
  const parts = line.split("|").map((cell) => cell.trim());
  if (parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL.test(cell.replace(/\s+/g, "")));
}

/** Parse markdown spec tables. Headings (`#####`) and separator rows are ignored. */
export function parsePastedSpecificationTable(raw: string): PastedSpecPair[] {
  const pairs: PastedSpecPair[] = [];
  const seen = new Map<string, number>();

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#####") || !trimmed.includes("|")) continue;

    const cells = tableCells(trimmed);
    if (cells.length < 2 || isSeparatorRow(cells)) continue;

    const name = cleanSpecName(cells[0] ?? "");
    const value = cleanSpecValue(cells[1] ?? "");
    if (!name || !value) continue;

    const identity = reusableIdentityKey(name);
    const row: PastedSpecPair = { name, value };
    const prior = seen.get(identity);
    if (prior != null) {
      pairs[prior] = row;
      continue;
    }
    seen.set(identity, pairs.length);
    pairs.push(row);
  }

  return pairs;
}

export function applyPastedSpecifications(
  current: EditorSpecRow[],
  pasted: PastedSpecPair[],
  definitions: SpecLibraryItem[],
): { rows: EditorSpecRow[]; filled: number; skipped: string[] } {
  const byName = new Map<string, SpecLibraryItem>();
  for (const definition of definitions) {
    const key = reusableIdentityKey(definition.name);
    if (key && !byName.has(key)) byName.set(key, definition);
  }

  const skipped: string[] = [];
  const next = [...current];
  let filled = 0;

  for (const pair of pasted) {
    const definition = byName.get(reusableIdentityKey(pair.name));
    if (!definition) {
      skipped.push(pair.name);
      continue;
    }

    const valueOption =
      definition.values.find((item) => reusableIdentityKey(item.name) === reusableIdentityKey(pair.value)) ??
      null;
    const valueId = valueOption?.id ?? "";
    const value = valueOption?.name ?? pair.value;
    const existing = next.findIndex((row) => row.specificationId === definition.id);

    const updated: EditorSpecRow = {
      key: existing >= 0 ? next[existing]!.key : `spec-${definition.id}`,
      specificationId: definition.id,
      specificationName: definition.name,
      valueId,
      value,
    };

    if (existing >= 0) next[existing] = updated;
    else next.push(updated);
    filled += 1;
  }

  return { rows: next, filled, skipped };
}
