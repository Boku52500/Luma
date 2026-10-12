"use client";

import { useEffect, useRef } from "react";
import { ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/hooks/useCart";
import { useCartDrawer } from "@/hooks/useCartDrawer";
import { cn, formatPrice } from "@/lib/utils";
import { CartLineCard } from "./CartLineCard";
import { EmptyCartState } from "./EmptyCartState";

export function CartDrawer() {
  const { open, closeDrawer } = useCartDrawer();
  const { items, count, subtotal, setQuantity, removeItem } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDrawer();
        return;
      }
      if (event.key !== "Tab") return;

      const container = panelRef.current;
      if (!container) return;
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, closeDrawer]);

  return (
    <div className={cn("fixed inset-0 z-[70]", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
      <div
        onClick={closeDrawer}
        className={cn("absolute inset-0 bg-ink-950/45 transition-opacity duration-200", open ? "opacity-100" : "opacity-0")}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="თქვენი კალათა"
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-surface shadow-[0_0_40px_rgba(15,17,23,0.12)] transition-transform duration-250 ease-out sm:max-w-md",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4 sm:px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-brand-50 text-brand-800">
              <ShoppingBag className="size-[18px]" strokeWidth={2} />
            </span>
            <h2 className="text-h3 text-text">
              კალათა
              {count > 0 ? <span className="text-body tnum ml-1.5 font-normal text-text-faint">({count})</span> : null}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="კალათის დახურვა"
            onClick={closeDrawer}
            className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-ink-700 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex min-w-0 flex-1 items-center justify-center overflow-x-hidden px-4 sm:px-6">
            <EmptyCartState compact onNavigate={closeDrawer} />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-4 py-2 sm:px-5">
              {items.map((line) => (
                <div key={line.id} className="rounded-[var(--radius-md)] border border-border bg-surface-2/40 px-3">
                  <CartLineCard
                    line={line}
                    compact
                    onQuantityChange={(quantity) => setQuantity(line.id, quantity)}
                    onRemove={() => removeItem(line.id)}
                  />
                </div>
              ))}
            </div>

            <div className="shrink-0 border-t border-border bg-surface px-4 py-4 sm:px-5 sm:py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-body text-text-muted">შუალედური ჯამი</span>
                <span className="text-price text-xl text-text">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex flex-col gap-2.5">
                <Button href="/checkout" onClick={closeDrawer} size="lg" className="w-full">
                  გადახდაზე გადასვლა
                </Button>
                <Button href="/cart" onClick={closeDrawer} variant="secondary" size="lg" className="w-full">
                  კალათის ნახვა
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
