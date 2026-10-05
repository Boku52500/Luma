"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  bulkActivateAdminProducts,
  bulkArchiveAdminProducts,
  bulkDeleteAdminProducts,
  bulkSetAdminProductsStock,
  updateAdminProductPrices,
  updateAdminProductStock,
} from "@/server/actions/admin";
import type { AdminProductListRow } from "@/server/admin/products";
import { AdminConfirmDialog } from "@/components/admin/AdminConfirmDialog";
import { AdminProductDeleteButton } from "@/components/admin/AdminProductDeleteButton";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/utils";

const MONEY_INPUT_RE = /^\d+(\.\d{1,2})?$/;

function isValidMoneyDraft(raw: string): boolean {
  return MONEY_INPUT_RE.test(raw.trim().replace(",", "."));
}

type RowState = AdminProductListRow & {
  priceDraft: string;
  previousDraft: string;
  priceStatus: "idle" | "saving" | "saved" | "error";
  priceError: string | null;
  stockStatusLocal: "idle" | "saving" | "error";
};

function moneyDraft(value: number | null | undefined): string {
  if (value == null) return "";
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toRowState(row: AdminProductListRow): RowState {
  return {
    ...row,
    priceDraft: moneyDraft(row.price),
    previousDraft: moneyDraft(row.previousPrice),
    priceStatus: "idle",
    priceError: null,
    stockStatusLocal: "idle",
  };
}

const compactInputClass =
  "h-8 w-[5.5rem] rounded-[var(--radius-sm)] border border-border-strong bg-white px-2 text-[0.8125rem] tnum text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-surface-2";

export function AdminProductsTable({ initialRows }: { initialRows: AdminProductListRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<RowState[]>(() => initialRows.map(toRowState));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkPending, startBulk] = useTransition();
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const priceBaseline = useRef(new Map<string, { price: string; previous: string }>());
  const priceDrafts = useRef(new Map<string, { price: string; previous: string }>());

  function draftFor(row: RowState) {
    return priceDrafts.current.get(row.id) ?? { price: row.priceDraft, previous: row.previousDraft };
  }

  function setDraft(id: string, patch: Partial<{ price: string; previous: string }>, row: RowState) {
    const current = draftFor(row);
    const next = { ...current, ...patch };
    priceDrafts.current.set(id, next);
    patchRow(id, {
      priceDraft: next.price,
      previousDraft: next.previous,
      priceStatus: "idle",
      priceError: null,
    });
  }

  // Keep local rows in sync when the server sends a new page/filter payload.
  const rowsKey = initialRows.map((row) => row.id).join("|");
  const [mountedKey, setMountedKey] = useState(rowsKey);
  if (mountedKey !== rowsKey) {
    setMountedKey(rowsKey);
    setRows(initialRows.map(toRowState));
    setSelected(new Set());
    setBulkError(null);
  }

  const pageIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const selectedCount = selected.size;
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = selectedCount > 0 && !allSelected;

  function toggleAll() {
    setSelected((current) => {
      if (pageIds.every((id) => current.has(id))) return new Set();
      return new Set(pageIds);
    });
  }

  function toggleOne(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function patchRow(id: string, patch: Partial<RowState>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function rememberBaseline(row: RowState) {
    const draft = draftFor(row);
    priceBaseline.current.set(row.id, { price: draft.price, previous: draft.previous });
  }

  async function commitPrices(id: string) {
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    const draft = priceDrafts.current.get(id) ?? { price: row.priceDraft, previous: row.previousDraft };

    const price = draft.price.trim().replace(",", ".");
    const previous = draft.previous.trim().replace(",", ".");

    if (!isValidMoneyDraft(price) || Number(price) < 0) {
      patchRow(id, { priceStatus: "error", priceError: "შეიყვანეთ სწორი ფასი" });
      return;
    }
    if (previous !== "" && (!isValidMoneyDraft(previous) || Number(previous) < 0)) {
      patchRow(id, { priceStatus: "error", priceError: "შეიყვანეთ სწორი წინა ფასი" });
      return;
    }
    if (previous !== "" && Number(previous) < Number(price)) {
      patchRow(id, { priceStatus: "error", priceError: "წინა ფასი ≥ მიმდინარე ფასი" });
      return;
    }

    const baseline = priceBaseline.current.get(id);
    const nextPrice = moneyDraft(Number(price));
    const nextPrevious = previous === "" ? "" : moneyDraft(Number(previous));
    if (baseline && baseline.price === nextPrice && baseline.previous === nextPrevious) {
      priceDrafts.current.set(id, { price: nextPrice, previous: nextPrevious });
      patchRow(id, { priceStatus: "idle", priceError: null, priceDraft: nextPrice, previousDraft: nextPrevious });
      return;
    }

    const prevPrice = row.price;
    const prevPrevious = row.previousPrice;
    priceDrafts.current.set(id, { price: nextPrice, previous: nextPrevious });
    patchRow(id, {
      priceStatus: "saving",
      priceError: null,
      price: Number(price),
      previousPrice: previous === "" ? null : Number(previous),
      priceDraft: nextPrice,
      previousDraft: nextPrevious,
    });

    const result = await updateAdminProductPrices({
      id,
      price: nextPrice,
      previousPrice: nextPrevious,
    });

    if (!result.ok) {
      const restored = { price: moneyDraft(prevPrice), previous: moneyDraft(prevPrevious) };
      priceDrafts.current.set(id, restored);
      patchRow(id, {
        price: prevPrice,
        previousPrice: prevPrevious,
        priceDraft: restored.price,
        previousDraft: restored.previous,
        priceStatus: "error",
        priceError: result.message,
      });
      return;
    }

    const saved = {
      price: moneyDraft(result.data.price),
      previous: moneyDraft(result.data.previousPrice),
    };
    priceBaseline.current.set(id, saved);
    priceDrafts.current.set(id, saved);
    patchRow(id, {
      price: result.data.price,
      previousPrice: result.data.previousPrice,
      priceDraft: saved.price,
      previousDraft: saved.previous,
      priceStatus: "saved",
      priceError: null,
    });
    window.setTimeout(() => {
      patchRow(id, { priceStatus: "idle" });
    }, 1200);
  }

  async function toggleStock(row: RowState) {
    if (row.deletedAt || row.stockStatusLocal === "saving") return;
    const nextActive = !row.isActive;
    const prevActive = row.isActive;
    patchRow(row.id, {
      isActive: nextActive,
      stockState: nextActive ? "in-stock" : "out-of-stock",
      stockStatusLocal: "saving",
    });

    const result = await updateAdminProductStock({ id: row.id, inStock: nextActive });
    if (!result.ok) {
      patchRow(row.id, {
        isActive: prevActive,
        stockState: prevActive ? "in-stock" : "out-of-stock",
        stockStatusLocal: "error",
      });
      setBulkError(result.message);
      return;
    }
    patchRow(row.id, {
      isActive: result.data.isActive,
      stockState: result.data.isActive ? "in-stock" : "out-of-stock",
      stockStatusLocal: "idle",
    });
  }

  function runBulk(action: "archive" | "activate" | "in-stock" | "out-of-stock" | "delete") {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkError(null);
    startBulk(async () => {
      const result =
        action === "archive"
          ? await bulkArchiveAdminProducts({ ids })
          : action === "activate"
            ? await bulkActivateAdminProducts({ ids })
            : action === "delete"
              ? await bulkDeleteAdminProducts({ ids })
              : await bulkSetAdminProductsStock({ ids, inStock: action === "in-stock" });

      if (!result.ok) {
        setBulkError(result.message);
        return;
      }

      if (action === "delete") {
        setRows((current) => current.filter((row) => !selected.has(row.id)));
      } else if (action === "archive") {
        setRows((current) =>
          current.map((row) =>
            selected.has(row.id)
              ? {
                  ...row,
                  deletedAt: row.deletedAt ?? new Date(),
                  isActive: false,
                  stockState: "out-of-stock",
                }
              : row,
          ),
        );
      } else if (action === "activate") {
        setRows((current) =>
          current.map((row) =>
            selected.has(row.id)
              ? {
                  ...row,
                  deletedAt: null,
                  isActive: true,
                  stockState: "in-stock",
                }
              : row,
          ),
        );
      } else {
        const inStock = action === "in-stock";
        setRows((current) =>
          current.map((row) =>
            selected.has(row.id) && !row.deletedAt
              ? {
                  ...row,
                  isActive: inStock,
                  stockState: inStock ? "in-stock" : "out-of-stock",
                }
              : row,
          ),
        );
      }

      setSelected(new Set());
      setConfirmDelete(false);
      router.refresh();
    });
  }

  if (rows.length === 0) {
    return <p className="text-small text-text-muted">პროდუქტები ამ ფილტრით ვერ მოიძებნა.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {selectedCount > 0 ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-small font-medium text-text">არჩეულია {selectedCount}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={bulkPending} onClick={() => runBulk("archive")}>
              არქივი
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={bulkPending} onClick={() => runBulk("activate")}>
              გააქტიურება
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={bulkPending} onClick={() => runBulk("out-of-stock")}>
              გამოუწვდომელი
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={bulkPending} onClick={() => runBulk("in-stock")}>
              ხელმისაწვდომია
            </Button>
            <Button type="button" size="sm" disabled={bulkPending} className="bg-danger-600 hover:bg-danger-600/90" onClick={() => setConfirmDelete(true)}>
              წაშლა
            </Button>
          </div>
        </div>
      ) : null}

      {bulkError ? <p className="text-small text-danger-600">{bulkError}</p> : null}

      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface">
        <table className="w-full min-w-[960px] text-left text-small">
          <thead className="bg-surface-2 text-label text-text-faint">
            <tr>
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="ყველას მონიშვნა ამ გვერდზე"
                  className="size-4 accent-[var(--brand-600)]"
                />
              </th>
              <th className="px-3 py-2.5 font-medium">პროდუქტი</th>
              <th className="px-3 py-2.5 font-medium">SKU</th>
              <th className="px-3 py-2.5 font-medium">ბრენდი</th>
              <th className="px-3 py-2.5 font-medium">კატეგორია</th>
              <th className="px-3 py-2.5 font-medium">ფასი</th>
              <th className="px-3 py-2.5 font-medium">ხელმისაწვდომობა</th>
              <th className="px-3 py-2.5 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border align-top">
                <td className="px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    aria-label={`${row.name} მონიშვნა`}
                    className="size-4 accent-[var(--brand-600)]"
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-surface-2">
                      {row.imageUrl && (row.imageUrl.startsWith("http") || row.imageUrl.startsWith("/")) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.imageUrl} alt={row.imageAlt} className="size-full object-cover" />
                      ) : (
                        <div className="size-full" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 font-medium text-text">{row.name}</p>
                      {row.isFeatured || row.isNew || row.badgeLabel ? (
                        <p className="text-label text-text-faint">
                          {[row.isFeatured ? "რჩეული" : null, row.isNew ? "ახალი" : null, row.badgeLabel || null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="tnum px-3 py-2.5">{row.sku}</td>
                <td className="px-3 py-2.5">{row.brandName}</td>
                <td className="px-3 py-2.5">{row.categoryName}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="flex items-center gap-1.5">
                      <span className="text-label w-10 shrink-0 text-text-faint">მთავარი</span>
                      <input
                        className={compactInputClass}
                        inputMode="decimal"
                        value={row.priceDraft}
                        disabled={row.priceStatus === "saving"}
                        onFocus={() => rememberBaseline(row)}
                        onChange={(event) => setDraft(row.id, { price: event.target.value }, row)}
                        onBlur={() => void commitPrices(row.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            const baseline = priceBaseline.current.get(row.id);
                            const restored = {
                              price: baseline?.price ?? moneyDraft(row.price),
                              previous: baseline?.previous ?? moneyDraft(row.previousPrice),
                            };
                            priceDrafts.current.set(row.id, restored);
                            patchRow(row.id, {
                              priceDraft: restored.price,
                              previousDraft: restored.previous,
                              priceStatus: "idle",
                              priceError: null,
                            });
                            event.currentTarget.blur();
                          }
                        }}
                        aria-label={`${row.name} მთავარი ფასი`}
                      />
                      <span className="text-label text-text-faint">₾</span>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <span className="text-label w-10 shrink-0 text-text-faint">წინა</span>
                      <input
                        className={compactInputClass}
                        inputMode="decimal"
                        value={row.previousDraft}
                        placeholder="—"
                        disabled={row.priceStatus === "saving"}
                        onFocus={() => rememberBaseline(row)}
                        onChange={(event) => setDraft(row.id, { previous: event.target.value }, row)}
                        onBlur={() => void commitPrices(row.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.currentTarget.blur();
                          }
                          if (event.key === "Escape") {
                            const baseline = priceBaseline.current.get(row.id);
                            const restored = {
                              price: baseline?.price ?? moneyDraft(row.price),
                              previous: baseline?.previous ?? moneyDraft(row.previousPrice),
                            };
                            priceDrafts.current.set(row.id, restored);
                            patchRow(row.id, {
                              priceDraft: restored.price,
                              previousDraft: restored.previous,
                              priceStatus: "idle",
                              priceError: null,
                            });
                            event.currentTarget.blur();
                          }
                        }}
                        aria-label={`${row.name} წინა ფასი`}
                      />
                      <span className="text-label text-text-faint">₾</span>
                    </label>
                    <p className="text-label min-h-[1rem] text-text-faint">
                      {row.priceStatus === "saving"
                        ? "ინახება…"
                        : row.priceStatus === "saved"
                          ? "შენახულია"
                          : row.priceStatus === "error"
                            ? row.priceError
                            : row.previousPrice != null
                              ? `${formatPrice(row.price)} · იყო ${formatPrice(row.previousPrice)}`
                              : "\u00a0"}
                    </p>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  {row.deletedAt ? (
                    <span className="text-text-muted">არქივი</span>
                  ) : (
                    <button
                      type="button"
                      disabled={row.stockStatusLocal === "saving"}
                      onClick={() => void toggleStock(row)}
                      className={`rounded-[var(--radius-sm)] px-2 py-1 text-left text-small font-medium transition-colors ${
                        row.isActive
                          ? "bg-success-50 text-success-600 hover:bg-success-50/80"
                          : "bg-danger-50 text-danger-600 hover:bg-danger-50/80"
                      } disabled:opacity-60`}
                    >
                      {row.stockStatusLocal === "saving"
                        ? "…"
                        : row.isActive
                          ? "ხელმისაწვდომია"
                          : "გამოუწვდომელი"}
                    </button>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col items-start gap-1">
                    <Link href={`/admin/products/${row.id}`} className="font-medium text-brand-700 hover:underline">
                      რედაქტირება
                    </Link>
                    {!row.deletedAt ? (
                      <AdminProductDeleteButton
                        productId={row.id}
                        productName={row.name}
                        className="font-medium text-danger-600 hover:underline"
                        onArchived={() => {
                          patchRow(row.id, {
                            deletedAt: new Date(),
                            isActive: false,
                            stockState: "out-of-stock",
                          });
                          setSelected((current) => {
                            const next = new Set(current);
                            next.delete(row.id);
                            return next;
                          });
                        }}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AdminConfirmDialog
        open={confirmDelete}
        title="პროდუქტების სამუდამო წაშლა"
        description={`სამუდამოდ წაიშლება ${selectedCount} პროდუქტი. შეკვეთების ისტორია შენარჩუნდება, მაგრამ პროდუქტები კატალოგიდან გაქრება. ეს ქმედება შეუქცევადია.`}
        confirmLabel="სამუდამოდ წაშლა"
        danger
        pending={bulkPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => runBulk("delete")}
      />
    </div>
  );
}
