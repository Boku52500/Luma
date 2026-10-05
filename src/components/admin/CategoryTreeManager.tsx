"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { GripVertical } from "lucide-react";
import { deleteAdminCategory, moveAdminCategoryTree } from "@/server/actions/admin";
import type { AdminCategoryRow } from "@/server/admin/categories";
import { ActiveToggle } from "@/components/admin/ActiveToggle";
import { categoryMoveWouldCycle, planCategoryTreeMove } from "@/lib/categoryTree";
import { adminCardClass } from "@/components/admin/adminUi";

type DropIntent = "before" | "after" | "inside";

type Projection = {
  categoryId: string;
  newParentId: string | null;
  indexAmongSiblings: number;
  overId: string;
  intent: DropIntent;
};

function buildParentMap(rows: AdminCategoryRow[]) {
  return new Map(rows.map((row) => [row.id, row.parentId]));
}

function getDescendantIds(rows: AdminCategoryRow[], rootId: string): Set<string> {
  const children = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const list = children.get(row.parentId) ?? [];
    list.push(row.id);
    children.set(row.parentId, list);
  }
  const out = new Set<string>();
  const walk = (id: string) => {
    for (const childId of children.get(id) ?? []) {
      out.add(childId);
      walk(childId);
    }
  };
  walk(rootId);
  return out;
}

function projectDrop(input: {
  rows: AdminCategoryRow[];
  activeId: string;
  overId: string;
  intent: DropIntent;
}): Projection | null {
  const { rows, activeId, overId, intent } = input;
  const over = rows.find((row) => row.id === overId);
  if (!over) return null;

  const parentById = buildParentMap(rows);
  let newParentId: string | null;
  let indexAmongSiblings: number;

  if (intent === "inside") {
    if (overId === activeId) return null;
    newParentId = over.id;
    if (categoryMoveWouldCycle(activeId, newParentId, parentById)) return null;
    const siblings = rows
      .filter((row) => row.parentId === newParentId && row.id !== activeId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    indexAmongSiblings = siblings.length;
  } else {
    newParentId = over.parentId;
    if (categoryMoveWouldCycle(activeId, newParentId, parentById)) return null;
    const siblings = rows
      .filter((row) => row.parentId === newParentId && row.id !== activeId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const overIndexAmongRemaining = siblings.findIndex((row) => row.id === overId);
    if (over.id === activeId) {
      // Dropping relative to self — treat as no-op projection
      return null;
    }
    if (intent === "before") {
      indexAmongSiblings = overIndexAmongRemaining >= 0 ? overIndexAmongRemaining : siblings.length;
    } else {
      indexAmongSiblings = overIndexAmongRemaining >= 0 ? overIndexAmongRemaining + 1 : siblings.length;
    }
  }

  return { categoryId: activeId, newParentId, indexAmongSiblings, overId, intent };
}

function applyOptimistic(
  rows: AdminCategoryRow[],
  projection: Projection,
): AdminCategoryRow[] | null {
  const plan = planCategoryTreeMove({
    nodes: rows.map((row) => ({ id: row.id, parentId: row.parentId, sortOrder: row.sortOrder })),
    categoryId: projection.categoryId,
    newParentId: projection.newParentId,
    indexAmongSiblings: projection.indexAmongSiblings,
  });
  if (!plan.ok) return null;

  const byId = new Map(rows.map((row) => [row.id, { ...row }]));
  for (const update of plan.updates) {
    const row = byId.get(update.id);
    if (!row) continue;
    row.parentId = update.parentId;
    row.sortOrder = update.sortOrder;
  }

  // Rebuild depth order for display
  const next = [...byId.values()];
  const byParent = new Map<string | null, AdminCategoryRow[]>();
  for (const row of next) {
    const list = byParent.get(row.parentId) ?? [];
    list.push(row);
    byParent.set(row.parentId, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ka"));
  }
  const ordered: AdminCategoryRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const row of byParent.get(parentId) ?? []) {
      ordered.push({
        ...row,
        depth,
        childCount: byParent.get(row.id)?.length ?? 0,
      });
      walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return ordered;
}

function intentFromPointer(event: DragMoveEvent | DragEndEvent): DropIntent {
  const over = event.over;
  if (!over) return "after";
  const rect = over.rect;
  const translated = event.active.rect.current.translated;
  if (!translated) return "after";
  const pointerY = translated.top + translated.height / 2;
  const ratio = (pointerY - rect.top) / Math.max(rect.height, 1);
  if (ratio < 0.25) return "before";
  if (ratio > 0.75) return "after";
  return "inside";
}

function SortableCategoryRow({
  row,
  disabled,
  dropIndicator,
  onDelete,
}: {
  row: AdminCategoryRow;
  disabled?: boolean;
  dropIndicator: { overId: string; intent: DropIntent } | null;
  onDelete: (row: AdminCategoryRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    paddingInlineStart: `${12 + row.depth * 20}px`,
    opacity: isDragging ? 0.45 : 1,
  };
  const showBefore = dropIndicator?.overId === row.id && dropIndicator.intent === "before";
  const showAfter = dropIndicator?.overId === row.id && dropIndicator.intent === "after";
  const showInside = dropIndicator?.overId === row.id && dropIndicator.intent === "inside";

  return (
    <li ref={setNodeRef} style={style} className="relative list-none">
      {showBefore ? (
        <div className="absolute inset-x-3 top-0 z-10 h-0.5 rounded-full bg-brand-600" aria-hidden />
      ) : null}
      <div
        className={`flex items-center gap-2 border-b border-border px-3 py-2.5 ${
          showInside ? "bg-brand-50 ring-1 ring-inset ring-brand-300" : "bg-surface"
        }`}
      >
        <button
          type="button"
          className="touch-none rounded p-1 text-text-faint hover:bg-surface-2 hover:text-text"
          aria-label={`${row.name} გადაადგილება`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-text">{row.name}</div>
          <div className="text-label truncate text-text-faint">{row.slug}</div>
        </div>
        <div className="tnum text-small shrink-0 text-right text-text-muted">
          <div>
            {row.productCount} პროდუქტი
            {row.archivedProductCount > 0 ? (
              <Link
                href={`/admin/products?category=${row.id}&active=archived`}
                className="block text-text-faint hover:text-brand-700 hover:underline"
              >
                · {row.archivedProductCount} არქივში
              </Link>
            ) : null}
          </div>
        </div>
        <Link
          href={`/admin/categories/${row.id}`}
          className="text-small shrink-0 font-medium text-brand-700 hover:underline"
        >
          რედაქტირება
        </Link>
        <ActiveToggle id={row.id} isActive={row.isActive} kind="category" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDelete(row)}
          className="text-small shrink-0 text-danger-600 hover:underline disabled:opacity-50"
        >
          წაშლა
        </button>
      </div>
      {showAfter ? (
        <div className="absolute inset-x-3 bottom-0 z-10 h-0.5 rounded-full bg-brand-600" aria-hidden />
      ) : null}
    </li>
  );
}

export function CategoryTreeManager({ initialRows }: { initialRows: AdminCategoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ overId: string; intent: DropIntent } | null>(
    null,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => rows.map((row) => row.id), [rows]);
  const activeRow = activeId ? rows.find((row) => row.id === activeId) : null;
  const blockedIds = activeId ? getDescendantIds(rows, activeId) : new Set<string>();

  function onDragStart(event: DragStartEvent) {
    setMessage(null);
    setActiveId(String(event.active.id));
  }

  function onDragMove(event: DragMoveEvent) {
    if (!event.over || !activeId) {
      setDropIndicator(null);
      return;
    }
    const overId = String(event.over.id);
    if (blockedIds.has(overId) || overId === activeId) {
      // Allow "inside" only blocked for descendants; self uses edges carefully
      if (overId === activeId) {
        setDropIndicator(null);
        return;
      }
      setDropIndicator(null);
      return;
    }
    setDropIndicator({ overId, intent: intentFromPointer(event) });
  }

  function onDragCancel() {
    setActiveId(null);
    setDropIndicator(null);
  }

  function onDragEnd(event: DragEndEvent) {
    const currentActive = activeId;
    const intent = dropIndicator?.intent ?? intentFromPointer(event);
    const overId = event.over ? String(event.over.id) : dropIndicator?.overId;
    setActiveId(null);
    setDropIndicator(null);
    if (!currentActive || !overId) return;
    if (blockedIds.has(overId)) {
      setMessage("კატეგორია ვერ გადავა საკუთარ შთამომავალში");
      return;
    }

    const projection = projectDrop({
      rows,
      activeId: currentActive,
      overId,
      intent,
    });
    if (!projection) {
      setMessage("ეს გადაადგილება დაუშვებელია");
      return;
    }

    const previous = rows;
    const optimistic = applyOptimistic(rows, projection);
    if (!optimistic) {
      setMessage("ეს გადაადგილება დაუშვებელია");
      return;
    }
    setRows(optimistic);

    startTransition(async () => {
      const result = await moveAdminCategoryTree({
        categoryId: projection.categoryId,
        newParentId: projection.newParentId,
        indexAmongSiblings: projection.indexAmongSiblings,
      });
      if (!result.ok) {
        setRows(previous);
        setMessage(result.message);
        return;
      }
      router.refresh();
    });
  }

  function onDelete(row: AdminCategoryRow) {
    if (row.childCount > 0) {
      setMessage("ჯერ გადაიტანეთ ქვეკატეგორიები, შემდეგ წაშალეთ");
      return;
    }
    const assignedCount = row.productCount + row.archivedProductCount;
    if (assignedCount > 0) {
      if (row.productCount === 0 && row.archivedProductCount > 0) {
        setMessage(
          `კატეგორიას აქვს ${row.archivedProductCount} დაარქივებული პროდუქტი — გადაიტანეთ ან აღადგინეთ Admin → პროდუქტები → არქივი (კატეგორიის ფილტრი).`,
        );
      } else {
        setMessage("კატეგორიას აქვს პროდუქტები — ჯერ გადაიტანეთ პროდუქტები");
      }
      return;
    }
    if (!window.confirm(`წავშალოთ „${row.name}”?`)) return;
    const previous = rows;
    setRows(previous.filter((item) => item.id !== row.id));
    startTransition(async () => {
      const result = await deleteAdminCategory({ id: row.id });
      if (!result.ok) {
        setRows(previous);
        setMessage(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className={adminCardClass}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
        <div>
          <h2 className="text-body font-semibold text-text">კატეგორიების ხე</h2>
          <p className="text-label text-text-faint">
            გადაათრიეთ კატეგორია სხვაზე — ქვეკატეგორია; ზედა/ქვედა კიდეზე — რიგი; ფესვში დასაბრუნებლად
            გადაათრიეთ ზედა დონის კატეგორიის გვერდით.
          </p>
        </div>
        {pending ? <span className="text-label text-text-muted">ინახება…</span> : null}
      </div>
      {message ? (
        <p role="alert" className="bg-danger-50 px-3 py-2 text-small text-danger-600">
          {message}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="text-small px-3 py-6 text-text-muted">კატეგორიები ჯერ არ არის. დაამატეთ ზემოთ.</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <ul className="m-0 p-0">
              {rows.map((row) => (
                <SortableCategoryRow
                  key={row.id}
                  row={row}
                  disabled={pending}
                  dropIndicator={dropIndicator}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </SortableContext>
          <DragOverlay>
            {activeRow ? (
              <div className="rounded-[var(--radius-sm)] border border-brand-300 bg-surface px-3 py-2 shadow-md">
                <div className="font-medium text-text">{activeRow.name}</div>
                <div className="text-label text-text-faint">{activeRow.slug}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </section>
  );
}
