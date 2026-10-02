import { normalizeReusableLabel, reusableIdentityKey } from "@/lib/reusableLabel";

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

const SEPARATOR_CELL = /^:?[-–—_=]{2,}:?$/;

function normalizePasteWhitespace(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/\u200b/g, "")
    .replace(/\r\n?/g, "\n");
}

function cleanSpecName(raw: string): string {
  return normalizeReusableLabel(normalizePasteWhitespace(raw));
}

function cleanSpecValue(raw: string): string {
  return normalizePasteWhitespace(raw)
    .replace(/<\s*br\s*\/?\s*>\s*<\s*br\s*\/?\s*>/gi, " ")
    .replace(/<\s*br\s*\/?\s*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalize markdown / unicode pipe variants so pasted tables stay parseable. */
function normalizeTableLine(line: string): string {
  return line.replace(/[│｜¦]/g, "|");
}

function tableCells(line: string): string[] {
  const normalized = normalizeTableLine(line);
  const parts = normalized.split("|").map((cell) => cell.trim());
  if (parts[0] === "") parts.shift();
  if (parts.length && parts[parts.length - 1] === "") parts.pop();
  return parts;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => SEPARATOR_CELL.test(cell.replace(/\s+/g, "")));
}

function isHeadingLine(line: string): boolean {
  return /^#+/.test(line.trim());
}

function cellsFromLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed || isHeadingLine(trimmed)) return null;

  if (normalizeTableLine(trimmed).includes("|")) {
    const cells = tableCells(trimmed);
    if (cells.length >= 2 && !isSeparatorRow(cells)) return cells;
    return null;
  }

  // Fallback when clipboard flattens markdown tables to tabs / multi-spaces.
  if (trimmed.includes("\t")) {
    const cells = trimmed.split("\t").map((cell) => cell.trim()).filter(Boolean);
    return cells.length >= 2 ? cells : null;
  }

  const spaced = trimmed.match(/^(.+?)\s{2,}(.+)$/);
  if (spaced?.[1] && spaced[2]) return [spaced[1], spaced[2]];
  return null;
}

/**
 * Restore markdown pipe tables from clipboard HTML when the browser flattens
 * a copied rendered table into plain text without `|` characters.
 */
export function markdownTablesFromHtml(html: string): string | null {
  if (!html || !/<\s*table[\s>]/i.test(html)) return null;
  if (typeof DOMParser === "undefined") return null;

  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tables = [...doc.querySelectorAll("table")];
    if (!tables.length) return null;

    const blocks: string[] = [];
    for (const table of tables) {
      const rows: string[] = [];
      for (const tr of table.querySelectorAll("tr")) {
        const cells = [...tr.querySelectorAll("th,td")].map((cell) =>
          cleanSpecValue((cell.textContent ?? "").replace(/\s+/g, " ")),
        );
        if (cells.length < 2 || !cells[0] || !cells[1]) continue;
        if (isSeparatorRow(cells)) continue;
        rows.push(`| ${cells[0]} | ${cells[1]} |`);
      }
      if (rows.length) blocks.push(rows.join("\n"));
    }
    return blocks.length ? blocks.join("\n\n") : null;
  } catch {
    return null;
  }
}

/** Prefer exact markdown text/plain; fall back to HTML tables if pipes were lost. */
export function resolvePastedSpecificationText(plain: string, html = ""): string {
  const rawPlain = normalizePasteWhitespace(plain);
  if (rawPlain.includes("|") || rawPlain.includes("│") || rawPlain.includes("｜")) {
    return rawPlain;
  }
  const fromHtml = markdownTablesFromHtml(html);
  return fromHtml ?? rawPlain;
}

function pushPair(
  pairs: PastedSpecPair[],
  seen: Map<string, number>,
  nameRaw: string,
  valueRaw: string,
) {
  const name = cleanSpecName(nameRaw);
  const value = cleanSpecValue(valueRaw);
  if (!name || !value) return;

  const identity = reusableIdentityKey(name);
  const prior = seen.get(identity);
  if (prior != null) {
    // Keep the first pasted spelling for create/display; take the latest value.
    pairs[prior] = { name: pairs[prior]!.name, value };
    return;
  }
  seen.set(identity, pairs.length);
  pairs.push({ name, value });
}

/**
 * Extract every `| name | value |` pair from a line. Handles both normal rows and
 * clipboard-flattened lines that concatenate several table rows on one line.
 */
function pairsFromPipeLine(line: string): Array<[string, string]> {
  const normalized = normalizeTableLine(line.trim());
  if (!normalized.includes("|")) return [];

  // Drop empty cells so flattened "| a | b | | --- | --- | | c | d |" still pairs.
  const cells = tableCells(normalized).filter((cell) => cell.length > 0);
  if (!cells.length || isSeparatorRow(cells)) return [];

  const out: Array<[string, string]> = [];
  for (let i = 0; i + 1 < cells.length; i += 2) {
    const name = cells[i] ?? "";
    const value = cells[i + 1] ?? "";
    if (
      SEPARATOR_CELL.test(name.replace(/\s+/g, "")) &&
      SEPARATOR_CELL.test(value.replace(/\s+/g, ""))
    ) {
      continue;
    }
    if (!name || !value) continue;
    out.push([name, value]);
  }
  return out;
}

/** Parse markdown spec tables. Headings (`#...`) and separator rows are ignored. */
export function parsePastedSpecificationTable(raw: string): PastedSpecPair[] {
  const pairs: PastedSpecPair[] = [];
  const seen = new Map<string, number>();

  for (const line of normalizePasteWhitespace(raw).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || isHeadingLine(trimmed)) continue;

    if (normalizeTableLine(trimmed).includes("|")) {
      for (const [name, value] of pairsFromPipeLine(trimmed)) {
        pushPair(pairs, seen, name, value);
      }
      continue;
    }

    const cells = cellsFromLine(trimmed);
    if (!cells) continue;
    pushPair(pairs, seen, cells[0] ?? "", cells[1] ?? "");
  }

  return pairs;
}

function indexDefinitionsByName(definitions: SpecLibraryItem[]): Map<string, SpecLibraryItem> {
  const byName = new Map<string, SpecLibraryItem>();
  for (const definition of definitions) {
    const key = reusableIdentityKey(definition.name);
    if (key && !byName.has(key)) byName.set(key, definition);
  }
  return byName;
}

function upsertPastedRow(
  rows: EditorSpecRow[],
  definition: SpecLibraryItem,
  value: string,
): EditorSpecRow[] {
  const valueOption =
    definition.values.find((item) => reusableIdentityKey(item.name) === reusableIdentityKey(value)) ?? null;
  const valueId = valueOption?.id ?? "";
  const resolvedValue = valueOption?.name ?? value;
  const existing = rows.findIndex((row) => row.specificationId === definition.id);
  const updated: EditorSpecRow = {
    key: existing >= 0 ? rows[existing]!.key : `spec-${definition.id}`,
    specificationId: definition.id,
    specificationName: definition.name,
    valueId,
    value: resolvedValue,
  };
  if (existing >= 0) {
    const next = [...rows];
    next[existing] = updated;
    return next;
  }
  return [...rows, updated];
}

/**
 * Fill product rows from pasted pairs using the current library only.
 * Unknown names are returned in `missing` so the caller can create them.
 */
export function applyPastedSpecifications(
  current: EditorSpecRow[],
  pasted: PastedSpecPair[],
  definitions: SpecLibraryItem[],
): { rows: EditorSpecRow[]; matched: number; missing: PastedSpecPair[] } {
  const byName = indexDefinitionsByName(definitions);
  const missing: PastedSpecPair[] = [];
  let rows = [...current];
  let matched = 0;

  for (const pair of pasted) {
    const definition = byName.get(reusableIdentityKey(pair.name));
    if (!definition) {
      missing.push(pair);
      continue;
    }
    rows = upsertPastedRow(rows, definition, pair.value);
    matched += 1;
  }

  return { rows, matched, missing };
}

export type ImportPastedSpecificationsResult = {
  rows: EditorSpecRow[];
  definitions: SpecLibraryItem[];
  matched: number;
  created: number;
  failed: string[];
};

/**
 * Match pasted names to the library; create any missing specification definitions,
 * then fill product rows. Values are taken from the paste as-is (no value-library requirement).
 */
export async function importPastedSpecifications(
  current: EditorSpecRow[],
  pasted: PastedSpecPair[],
  definitions: SpecLibraryItem[],
  createSpecification: (name: string) => Promise<{ id: string; name: string } | null>,
): Promise<ImportPastedSpecificationsResult> {
  const byName = indexDefinitionsByName(definitions);
  let nextDefinitions = [...definitions];
  const createdIds = new Set<string>();
  const failed: string[] = [];

  const missingUnique = new Map<string, string>();
  for (const pair of pasted) {
    const key = reusableIdentityKey(pair.name);
    if (!key || byName.has(key) || missingUnique.has(key)) continue;
    missingUnique.set(key, pair.name);
  }

  for (const [key, name] of missingUnique) {
    const created = await createSpecification(name);
    if (!created) {
      failed.push(name);
      continue;
    }

    const alreadyLoaded = nextDefinitions.find((item) => item.id === created.id);
    if (alreadyLoaded) {
      byName.set(key, alreadyLoaded);
      continue;
    }

    const item: SpecLibraryItem = { id: created.id, name: created.name, values: [] };
    nextDefinitions = [...nextDefinitions, item];
    byName.set(key, item);
    createdIds.add(created.id);
  }

  let rows = [...current];
  let matched = 0;
  let created = 0;

  for (const pair of pasted) {
    const definition = byName.get(reusableIdentityKey(pair.name));
    if (!definition) continue;

    rows = upsertPastedRow(rows, definition, pair.value);
    if (createdIds.has(definition.id)) created += 1;
    else matched += 1;
  }

  return { rows, definitions: nextDefinitions, matched, created, failed };
}
