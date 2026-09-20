import { formatPrice } from "@/lib/utils";
import { DELIVERY_METHOD_LABEL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/adminLabels";
import { getCityLabel } from "@/lib/checkout";
import { paymentCopyFor } from "@/lib/paymentCopy";
import {
  emailLayout,
  escapeHtml,
  htmlMuted,
  htmlParagraph,
  htmlRow,
  htmlTable,
} from "@/server/email/html";

export type OrderEmailItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderEmailSnapshot = {
  orderNumber: string;
  firstName: string;
  customerEmail: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus?: string;
  deliveryMethod: "standard" | "express";
  city: string;
  street: string;
  building?: string | null;
  apartment?: string | null;
  entrance?: string | null;
  floor?: string | null;
  additionalInfo?: string | null;
  items: OrderEmailItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  promoCode?: string | null;
};

const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;
const MONTHS = [
  "იანვარი",
  "თებერვალი",
  "მარტი",
  "აპრილი",
  "მაისი",
  "ივნისი",
  "ივლისი",
  "აგვისტო",
  "სექტემბერი",
  "ოქტომბერი",
  "ნოემბერი",
  "დეკემბერი",
];

export function formatEmailDateTime(date: Date): string {
  const shifted = new Date(date.getTime() + TBILISI_OFFSET_MS);
  const month = MONTHS[shifted.getUTCMonth()] ?? "";
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${shifted.getUTCDate()} ${month} ${shifted.getUTCFullYear()}, ${hh}:${mm}`;
}

export function orderConfirmationCopy(paymentMethod: string): {
  headline: string;
  body: string;
} {
  if (paymentMethod === "cash_on_delivery") {
    return {
      headline: "შეკვეთა მიღებულია",
      body: "შეკვეთა მიღებულია. თანხას გადაიხდით მიწოდებისას.",
    };
  }
  if (paymentMethod === "installment") {
    return {
      headline: "შეკვეთა მიღებულია",
      body: "შეკვეთა მიღებულია. განვადების პირობებს ბანკი დაადასტურებს ცალკე.",
    };
  }
  if (paymentMethod === "card") {
    return {
      headline: "შეკვეთა მიღებულია",
      body: "შეკვეთა მიღებულია. ბარათით გადახდის დასრულების შემდეგ მიიღებთ გადახდის დადასტურებას.",
    };
  }
  return {
    headline: "შეკვეთა მიღებულია",
    body: "შეკვეთა მიღებულია. ონლაინ გადახდის დასრულების შემდეგ მიიღებთ გადახდის დადასტურებას.",
  };
}

function addressLines(order: OrderEmailSnapshot): string {
  return [
    getCityLabel(order.city),
    order.street,
    order.building,
    order.apartment,
    order.entrance,
    order.floor,
  ]
    .filter((part) => Boolean(part && String(part).trim()))
    .join(", ");
}

function orderItemsHtml(items: OrderEmailItem[]): string {
  const rows = items
    .map(
      (item) =>
        htmlRow(
          `${item.productName} × ${item.quantity}`,
          formatPrice(item.lineTotal),
        ),
    )
    .join("");
  return htmlTable(rows);
}

function orderTotalsHtml(order: OrderEmailSnapshot): string {
  const discountLabel = order.promoCode ? `ფასდაკლება (${order.promoCode})` : "ფასდაკლება";
  return htmlTable(
    [
      htmlRow("ქვეჯამი", formatPrice(order.subtotal)),
      order.discount > 0 ? htmlRow(discountLabel, `− ${formatPrice(order.discount)}`) : "",
      htmlRow("მიწოდება", formatPrice(order.deliveryFee)),
      htmlRow("სულ", formatPrice(order.total)),
    ].join(""),
  );
}

function greeting(firstName: string): string {
  const name = firstName.trim();
  return name ? `გამარჯობა, ${name}` : "გამარჯობა";
}

export function renderPasswordResetEmail(input: { resetUrl: string }): { subject: string; html: string; text: string } {
  const subject = "Luma — პაროლის აღდგენა";
  const html = emailLayout({
    title: "პაროლის აღდგენა",
    preheader: "ბმული მოქმედებს 1 საათი.",
    bodyHtml:
      htmlParagraph("მივიღეთ პაროლის აღდგენის მოთხოვნა თქვენს Luma ანგარიშზე.") +
      htmlMuted("ბმული მოქმედებს 1 საათი. თუ ეს მოთხოვნა თქვენ არ გამოგიგზავნიათ, შეგიძლიათ უგულებელყოთ ეს წერილი."),
    cta: { href: input.resetUrl, label: "პაროლის აღდგენა" },
  });
  const text = `Luma — პაროლის აღდგენა\n\nბმული: ${input.resetUrl}\nმოქმედებს 1 საათი.`;
  return { subject, html, text };
}

export function renderOrderConfirmationEmail(
  order: OrderEmailSnapshot,
  cta: { href: string; label: string },
): { subject: string; html: string; text: string } {
  const copy = orderConfirmationCopy(order.paymentMethod);
  const subject = `შეკვეთა მიღებულია — ${order.orderNumber}`;
  const paymentLabel =
    PAYMENT_METHOD_LABEL[order.paymentMethod as keyof typeof PAYMENT_METHOD_LABEL] ?? order.paymentMethod;
  const html = emailLayout({
    title: copy.headline,
    preheader: copy.body,
    bodyHtml:
      htmlParagraph(greeting(order.firstName)) +
      htmlParagraph(copy.body) +
      htmlTable(
        htmlRow("შეკვეთის ნომერი", order.orderNumber) +
          htmlRow("გადახდა", `${paymentLabel} · ${paymentCopyFor(order.paymentStatus).label}`) +
          htmlRow("მიწოდება", DELIVERY_METHOD_LABEL[order.deliveryMethod]) +
          htmlRow("მისამართი", addressLines(order)) +
          (order.additionalInfo ? htmlRow("შენიშვნა", order.additionalInfo) : ""),
      ) +
      orderItemsHtml(order.items) +
      orderTotalsHtml(order),
    cta,
  });
  const text = [
    copy.headline,
    copy.body,
    `შეკვეთა: ${order.orderNumber}`,
    `სულ: ${formatPrice(order.total)}`,
    cta.href,
  ].join("\n");
  return { subject, html, text };
}

export function renderPaymentPaidEmail(
  order: OrderEmailSnapshot,
  input: { amount: number; paidAt: Date },
  cta: { href: string; label: string },
): { subject: string; html: string; text: string } {
  const subject = `გადახდა დადასტურებულია — ${order.orderNumber}`;
  const html = emailLayout({
    title: "გადახდა დადასტურებულია",
    preheader: `თანხა ${formatPrice(input.amount)} ჩაირიცხა.`,
    bodyHtml:
      htmlParagraph(greeting(order.firstName)) +
      htmlParagraph("ბარათით გადახდა წარმატებით დასრულდა.") +
      htmlTable(
        htmlRow("შეკვეთის ნომერი", order.orderNumber) +
          htmlRow("გადახდილი თანხა", formatPrice(input.amount)) +
          htmlRow("მეთოდი", "საბანკო ბარათი") +
          htmlRow("თარიღი", formatEmailDateTime(input.paidAt)),
      ),
    cta,
  });
  const text = `გადახდა დადასტურებულია — ${order.orderNumber}\nთანხა: ${formatPrice(input.amount)}\n${cta.href}`;
  return { subject, html, text };
}

export function renderRefundEmail(
  order: OrderEmailSnapshot,
  input: { kind: "partial" | "full"; refundedAmount: number; cumulativeAmount: number },
  cta: { href: string; label: string },
): { subject: string; html: string; text: string } {
  const subject =
    input.kind === "full"
      ? `თანხა დაბრუნებულია — ${order.orderNumber}`
      : `თანხის ნაწილი დაბრუნებულია — ${order.orderNumber}`;
  const title = input.kind === "full" ? "თანხა დაბრუნებულია" : "თანხის ნაწილი დაბრუნებულია";
  const html = emailLayout({
    title,
    preheader: `დაბრუნებულია ${formatPrice(input.refundedAmount)}.`,
    bodyHtml:
      htmlParagraph(greeting(order.firstName)) +
      htmlParagraph(
        input.kind === "full"
          ? "ამ გადახდაზე თანხა სრულად დაბრუნებულია."
          : "ამ გადახდაზე თანხის ნაწილი დაბრუნებულია.",
      ) +
      htmlMuted("თანხის ასახვა ბარათზე დამოკიდებულია თქვენი ბანკის დამუშავების ვადაზე.") +
      htmlTable(
        htmlRow("შეკვეთის ნომერი", order.orderNumber) +
          htmlRow("დაბრუნებული თანხა", formatPrice(input.refundedAmount)) +
          htmlRow("ჯამში დაბრუნებული", formatPrice(input.cumulativeAmount)) +
          htmlRow("გადახდის სტატუსი", PAYMENT_STATUS_LABEL[order.paymentStatus as keyof typeof PAYMENT_STATUS_LABEL] ?? order.paymentStatus),
      ),
    cta,
  });
  const text = `${subject}\nდაბრუნებულია: ${formatPrice(input.refundedAmount)}\n${cta.href}`;
  return { subject, html, text };
}

const STATUS_SUBJECT: Record<string, (orderNumber: string) => string> = {
  processing: (n) => `თქვენი შეკვეთა მუშავდება — ${n}`,
  shipped: (n) => `თქვენი შეკვეთა გაიგზავნა — ${n}`,
  delivered: (n) => `შეკვეთა ჩაბარდა — ${n}`,
  cancelled: (n) => `შეკვეთა გაუქმებულია — ${n}`,
};

const STATUS_BODY: Record<string, string> = {
  processing: "თქვენი შეკვეთა მუშავდება.",
  shipped: "თქვენი შეკვეთა გაიგზავნა.",
  delivered: "შეკვეთა ჩაბარდა.",
  cancelled: "შეკვეთა გაუქმებულია.",
};

export function renderOrderStatusEmail(
  order: OrderEmailSnapshot,
  status: string,
  cta: { href: string; label: string },
): { subject: string; html: string; text: string } {
  const subject = (STATUS_SUBJECT[status] ?? ((n: string) => `შეკვეთის სტატუსი — ${n}`))(order.orderNumber);
  const body = STATUS_BODY[status] ?? `შეკვეთის სტატუსი: ${ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL] ?? status}`;
  const html = emailLayout({
    title: ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL] ?? "შეკვეთის სტატუსი",
    preheader: body,
    bodyHtml:
      htmlParagraph(greeting(order.firstName)) +
      htmlParagraph(body) +
      htmlTable(htmlRow("შეკვეთის ნომერი", order.orderNumber) + htmlRow("სტატუსი", ORDER_STATUS_LABEL[status as keyof typeof ORDER_STATUS_LABEL] ?? status)),
    cta,
  });
  const text = `${subject}\n${body}\n${cta.href}`;
  return { subject, html, text };
}

export function assertNoPrematurePaidCopy(html: string, paymentMethod: string): boolean {
  if (paymentMethod === "cash_on_delivery" || paymentMethod === "installment") return true;
  return !html.includes("გადახდა დადასტურებულია") && !html.includes("გადახდილია");
}

export function containsUnsafeRawHtml(rendered: string, untrusted: string): boolean {
  if (!untrusted.includes("<") && !untrusted.includes("&")) return false;
  return rendered.includes(untrusted);
}

export { escapeHtml };
