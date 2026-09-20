/**
 * Safe storefront redirect for hero banners and similar merchandising links.
 * Allows relative Luma paths and http(s) absolute URLs. Blocks javascript: etc.
 */
export function normalizeMerchHref(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!value) return null;

  if (value.startsWith("/")) {
    if (value.startsWith("//")) return null;
    if (value.includes("\\") || value.includes("\0")) return null;
    return value;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isExternalMerchHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}
