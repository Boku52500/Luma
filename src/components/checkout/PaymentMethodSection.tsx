"use client";

import { CreditCard, Landmark, Banknote, ShieldCheck, Wallet } from "lucide-react";
import {
  visibleCheckoutPaymentMethods,
  type PaymentMethodId,
  type PublicCheckoutCapabilities,
  type SavedCheckoutCard,
} from "@/lib/checkout";
import { cn } from "@/lib/utils";

const iconByMethod: Record<PaymentMethodId, typeof CreditCard> = {
  card: CreditCard,
  installment: Landmark,
  "cash-on-delivery": Banknote,
  google_pay: Wallet,
  apple_pay: Wallet,
  bog_loan: Landmark,
  bnpl: Landmark,
  saved_card: CreditCard,
};

/**
 * Checkout payment choices: Card (BOG hosted), ნაწილ-ნაწილ / განვადება when
 * flagged, and existing cash-on-delivery. Google Pay / Apple Pay stay on BOG's
 * hosted card page — Luma does not draw wallet buttons.
 */
export function PaymentMethodSection({
  value,
  onChange,
  error,
  capabilities,
  savedMethods = [],
  isLoggedIn = false,
  saveCardConsent,
  onSaveCardConsent,
  savedPaymentMethodId,
  onSavedPaymentMethodId,
  loanSummary,
  calculatorStatus = "idle",
}: {
  value: PaymentMethodId | null;
  onChange: (value: PaymentMethodId) => void;
  error?: string;
  capabilities?: PublicCheckoutCapabilities | null;
  savedMethods?: SavedCheckoutCard[];
  isLoggedIn?: boolean;
  saveCardConsent?: "recurrent" | null;
  onSaveCardConsent?: (value: "recurrent" | null) => void;
  savedPaymentMethodId?: string | null;
  onSavedPaymentMethodId?: (id: string) => void;
  loanSummary?: string | null;
  calculatorStatus?: "idle" | "loading" | "ready" | "error";
}) {
  const methods = visibleCheckoutPaymentMethods(capabilities);
  const visibleExtras: Array<{ id: PaymentMethodId; label: string; description: string }> = [];
  if (capabilities?.savedCard && isLoggedIn && savedMethods.length > 0) {
    visibleExtras.push({
      id: "saved_card",
      label: "შენახული ბარათი",
      description: "გადახდა შენახული ბარათით, PAN-ის ხელახლა შეყვანის გარეშე",
    });
  }

  return (
    <section
      id="paymentMethod"
      aria-labelledby="payment-method-heading"
      className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface p-5 sm:p-6"
    >
      <h2 id="payment-method-heading" className="text-h3 text-text">
        გადახდის მეთოდი
      </h2>

      <div role="radiogroup" aria-label="გადახდის მეთოდი" aria-required aria-invalid={Boolean(error)} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {methods.map((method) => {
          const Icon = iconByMethod[method.id];
          const selected = value === method.id;

          return (
            <button
              key={method.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(method.id)}
              className={cn(
                "flex flex-col gap-2 rounded-[var(--radius-md)] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                selected ? "border-brand-600 bg-brand-50" : "border-border-strong hover:border-ink-900"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="size-5 text-brand-600" strokeWidth={1.75} />
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-brand-600 bg-brand-600" : "border-border-strong"
                  )}
                >
                  {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                </span>
              </div>
              <span className="text-small font-semibold text-text">{method.label}</span>
              <span className="text-label text-text-muted">{method.description}</span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="text-label text-danger-500">
          {error}
        </p>
      ) : null}

      {value === "card" ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2 p-4">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" strokeWidth={1.75} />
          <p className="text-small text-text-muted">
            შეკვეთის დადასტურების შემდეგ გადახვალთ საქართველოს ბანკის უსაფრთხო გადახდის გვერდზე — ბარათის
            მონაცემები ამ საიტზე არ ინახება და არ გროვდება. Google Pay და Apple Pay, თუ ხელმისაწვდომია,
            იმ გვერდზე გამოჩნდება.
          </p>
        </div>
      ) : null}

      {value === "cash-on-delivery" ? (
        <div className="flex items-start gap-2.5 rounded-[var(--radius-md)] border border-border bg-surface-2 p-4">
          <Banknote className="mt-0.5 size-4 shrink-0 text-brand-600" strokeWidth={1.75} />
          <p className="text-small text-text-muted">მზად გქონდეთ ზუსტი თანხა კურიერთან მიღებისას.</p>
        </div>
      ) : null}

      {visibleExtras.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {visibleExtras.map((method) => {
            const Icon = iconByMethod[method.id];
            const selected = value === method.id;
            return (
              <button
                key={method.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(method.id)}
                className={cn(
                  "flex flex-col gap-2 rounded-[var(--radius-md)] border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                  selected ? "border-brand-600 bg-brand-50" : "border-border-strong hover:border-ink-900",
                )}
              >
                <Icon className="size-5 text-brand-600" strokeWidth={1.75} />
                <span className="text-small font-semibold text-text">{method.label}</span>
                <span className="text-label text-text-muted">{method.description}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      {value === "card" && isLoggedIn && capabilities?.saveCardRecurrent && onSaveCardConsent ? (
        <label className="flex items-start gap-2.5 text-small text-text">
          <input
            type="checkbox"
            className="mt-1"
            checked={saveCardConsent === "recurrent"}
            onChange={(event) => onSaveCardConsent(event.target.checked ? "recurrent" : null)}
          />
          <span>შეინახე ბარათი შემდეგი გადახდებისთვის. ავტომატური ჩამოჭრის უფლებას ეს არ იძლევა.</span>
        </label>
      ) : null}

      {value === "saved_card" && savedMethods.length > 0 ? (
        <div className="flex flex-col gap-2">
          {savedMethods.map((method) => (
            <label key={method.id} className="flex items-center gap-2 text-small">
              <input
                type="radio"
                name="saved-card"
                checked={savedPaymentMethodId === method.id}
                onChange={() => onSavedPaymentMethodId?.(method.id)}
              />
              <span>
                {method.cardType ?? "ბარათი"} {method.maskedPan ?? ""} {method.cardExpiry ? `· ${method.cardExpiry}` : ""}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {value === "bog_loan" || value === "bnpl" ? (
        <p className="text-small text-text-muted">
          პირობებს ხსნის საქართველოს ბანკის კალკულატორი. Luma პროცენტს ან ყოველთვიურ თანხას არ ითვლის.
          {loanSummary ? ` არჩეული პირობა: ${loanSummary}` : ""}
          {calculatorStatus === "loading" ? " კალკულატორი იტვირთება..." : ""}
          {calculatorStatus === "error"
            ? " საქართველოს ბანკის კალკულატორი ვერ ჩაიტვირთა. სცადეთ თავიდან."
            : ""}
        </p>
      ) : null}
    </section>
  );
}
