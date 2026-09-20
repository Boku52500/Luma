const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPE[char] ?? char);
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

const BRAND = "#27386d";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f8fafc";

export function emailLayout(input: {
  preheader?: string;
  title: string;
  bodyHtml: string;
  cta?: { href: string; label: string };
  footerNote?: string;
}): string {
  const preheader = input.preheader ? escapeHtml(input.preheader) : "";
  const title = escapeHtml(input.title);
  const cta = input.cta
    ? `<p style="margin:28px 0 8px;">
        <a href="${escapeAttribute(input.cta.href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:15px;">
          ${escapeHtml(input.cta.label)}
        </a>
      </p>`
    : "";
  const footer = escapeHtml(
    input.footerNote ?? "კითხვების შემთხვევაში მოგვწერეთ: info@luma.ge · 032 200 00 00",
  );

  return `<!DOCTYPE html>
<html lang="ka">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BG};color:${TEXT};font-family:Arial,Helvetica,sans-serif;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;padding:28px 24px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:0.08em;color:${BRAND};">LUMA</p>
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${TEXT};">${title}</h1>
              ${input.bodyHtml}
              ${cta}
              <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${BORDER};font-size:12px;line-height:1.5;color:${MUTED};">${footer}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function htmlParagraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.55;color:${TEXT};">${escapeHtml(text)}</p>`;
}

export function htmlMuted(text: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:${MUTED};">${escapeHtml(text)}</p>`;
}

export function htmlRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:14px;color:${MUTED};vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0 6px 12px;font-size:14px;color:${TEXT};text-align:right;">${escapeHtml(value)}</td>
  </tr>`;
}

export function htmlTable(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;border-collapse:collapse;">${rows}</table>`;
}
