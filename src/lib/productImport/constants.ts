/** Excel columns used for import — exact header match after trim. */
export const REQUIRED_EXCEL_COLUMNS = [
  "SKU",
  "კატეგორია",
  "ბრენდი",
  "დასახელება",
  "გასაყიდი ფასი",
] as const;

export type RequiredExcelColumn = (typeof REQUIRED_EXCEL_COLUMNS)[number];

export const SEO_TITLE_SUFFIX = " | Luma";
