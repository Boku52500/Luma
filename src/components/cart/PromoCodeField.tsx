"use client";

import { useState } from "react";
import { Tag, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { evaluatePromoCode } from "@/lib/cart";
import { usePromoCode } from "@/hooks/usePromoCode";

/**
 * Promo-code input + applied state, backed by the single shared
 * `usePromoCode` store so the cart page and checkout always agree on
 * whether a code is applied and what it's worth — UI/local mock logic only
 * (see `evaluatePromoCode`), structured to be swapped for a server-side
 * validation call later without touching either caller.
 *
 * Not a `<form>`: checkout already wraps the page in one, and nested forms
 * are invalid HTML that React reports as a hydration mismatch.
 */
export function PromoCodeField({ subtotal, className }: { subtotal: number; className?: string }) {
  const { code, result, applyCode, removeCode } = usePromoCode(subtotal);
  const [inputValue, setInputValue] = useState("");
  const [attemptError, setAttemptError] = useState<string | null>(null);

  const handleApply = () => {
    if (!inputValue.trim()) return;
    const attempt = evaluatePromoCode(inputValue, subtotal);
    if (attempt.valid) {
      applyCode(attempt.code);
      setAttemptError(null);
      setInputValue("");
    } else {
      setAttemptError(attempt.message);
    }
  };

  const handleRemove = () => {
    removeCode();
    setAttemptError(null);
    setInputValue("");
  };

  const isApplied = Boolean(code) && result?.valid;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor="promo-code" className="text-small font-medium text-text">
        პრომოკოდი
      </label>

      {isApplied ? (
        <div className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-success-200 bg-success-50 px-3.5 py-2.5">
          <p className="text-small flex items-center gap-1.5 text-success-700">
            <Check className="size-4 shrink-0" strokeWidth={2.25} />
            {result?.message}
          </p>
          <button
            type="button"
            onClick={handleRemove}
            className="text-label shrink-0 font-semibold text-text-muted transition-colors hover:text-danger-500"
          >
            მოხსნა
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-faint" strokeWidth={1.75} />
              <input
                id="promo-code"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  event.stopPropagation();
                  handleApply();
                }}
                placeholder="მაგ: LUMA10"
                className="h-11 w-full rounded-[var(--radius-sm)] border border-border-strong pl-9 pr-3 text-[0.9375rem] text-text placeholder:text-text-faint focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100"
              />
            </div>
            <Button type="button" variant="secondary" className="shrink-0" onClick={handleApply}>
              გააქტიურება
            </Button>
          </div>
          {attemptError ? (
            <p role="alert" className="text-small flex items-start gap-1.5 text-danger-500">
              <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
              {attemptError}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
