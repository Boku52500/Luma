import { normalizeCatalogLabel } from "./normalize";
import { catalogIdentityKey } from "./slug";

/**
 * Explicit approved Excel → Luma category aliases.
 * Keys are normalized identity keys; values are canonical DB display labels.
 */
export const IMPORT_CATEGORY_ALIASES: Readonly<Record<string, string>> = {
  [catalogIdentityKey("ტელევიზორი")]: "ტელევიზორები",
};

export type ResolvedImportCategory = {
  excelLabel: string;
  resolvedLabel: string;
  aliasApplied: boolean;
};

/** Resolve an Excel category label for import matching and DB assignment. */
export function resolveImportCategory(rawLabel: string): ResolvedImportCategory {
  const excelLabel = normalizeCatalogLabel(rawLabel) ?? rawLabel.trim();
  const aliasTarget = IMPORT_CATEGORY_ALIASES[catalogIdentityKey(excelLabel)];
  if (aliasTarget) {
    return { excelLabel, resolvedLabel: aliasTarget, aliasApplied: true };
  }
  return { excelLabel, resolvedLabel: excelLabel, aliasApplied: false };
}

export function isApprovedCategoryAlias(excelLabel: string, resolvedLabel: string): boolean {
  return IMPORT_CATEGORY_ALIASES[catalogIdentityKey(excelLabel)] === resolvedLabel;
}
