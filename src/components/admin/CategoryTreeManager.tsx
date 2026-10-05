"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { deleteAdminCategory, moveAdminCategoryTree } from "@/server/actions/admin";
import type { AdminCategoryRow } from "@/server/admin/categories";
import { ActiveToggle } from "@/components/admin/ActiveToggle";
import { CategoryIcon } from "@/lib/categoryIcons";
import { adminCardClass, adminSelectClass } from "@/components/admin/adminUi";

function SortableRow({
  row,
  mains,
  disabled,
  onDelete,
  onMoveTo,
}: {
  row: AdminCategoryRow;
  mains: AdminCategoryRow[];
  disabled: boolean;
  onDelete: (row: AdminCategoryRow) => void;
  onMoveTo: (row: AdminCategoryRow, parentId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    data: { type: "category", row },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0"
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
        <div>{row.productCount} პროდუქტი</div>
        {row.archivedProductCount > 0 ? (
          <Link
            href={`/admin/products?category=${row.id}&active=archived`}
            className="block text-text-faint hover:text-brand-700 hover:underline"
          >
            · {row.archivedProductCount} არქივში
          </Link>
        ) : null}
      </div>
      <label className="text-label flex items-center gap-1.5 text-text-muted">
        <span className="shrink-0">გადატანა →</span>
        <select
          className={`${adminSelectClass} h-8 min-w-[10rem] py-0 text-[0.75rem]`}
          value={row.parentId ?? ""}
          disabled={disabled}
          onChange={(event) => onMoveTo(row, event.target.value || null)}
          aria-label={`${row.name} გადატანა მთავარ კატეგორიაში`}
        >
          <option value="">მთავარი / უმშობლო</option>
          {mains
            .filter((main) => main.id !== row.id)
            .map((main) => (
              <option key={main.id} value={main.id}>
                {main.name}
              </option>
            ))}
        </select>
      </label>
      <Link href={`/admin/categories/${row.id}`} className="text-small shrink-0 font-medium text-brand-700 hover:underline">
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
    </li>
  );
}

function MainGroup({
  main,
  childRows,
  expanded,
  onToggle,
  overGroupId,
  disabled,
  onDelete,
  onMoveTo,
  mains,
}: {
  main: AdminCategoryRow;
  childRows: AdminCategoryRow[];
  expanded: boolean;
  onToggle: () => void;
  overGroupId: string | null;
  disabled: boolean;
  onDelete: (row: AdminCategoryRow) => void;
  onMoveTo: (row: AdminCategoryRow, parentId: string | null) => void;
  mains: AdminCategoryRow[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: main.id, data: { type: "main", row: main } });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `group-${main.id}`,
    data: { type: "group", mainId: main.id },
  });

  const highlight = overGroupId === main.id || isOver;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <section
      ref={(node) => {
        setSortableRef(node);
        setDropRef(node);
      }}
      style={style}
      className={`overflow-hidden rounded-[var(--radius-md)] border bg-surface ${
        highlight ? "border-brand-500 ring-2 ring-brand-200" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 py-3">
        <button
          type="button"
          className="touch-none rounded p-1 text-text-faint hover:bg-surface hover:text-text"
          aria-label={`${main.name} რიგი`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          {expanded ? <ChevronDown className="size-4 shrink-0 text-text-muted" /> : <ChevronRight className="size-4 shrink-0 text-text-muted" />}
          <CategoryIcon slug={main.slug} iconKey={main.iconKey} className="size-5 shrink-0 text-brand-700" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-text">{main.name}</div>
            <div className="text-label text-text-faint">
              {main.totalProductCount} პროდუქტი სულ · {main.childCount} ქვეკატეგორია
            </div>
          </div>
        </button>
        <Link href={`/admin/categories/${main.id}`} className="text-small shrink-0 font-medium text-brand-700 hover:underline">
          რედაქტირება
        </Link>
        <ActiveToggle id={main.id} isActive={main.isActive} kind="category" />
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDelete(main)}
          className="text-small shrink-0 text-danger-600 hover:underline disabled:opacity-50"
        >
          წაშლა
        </button>
      </div>
      {expanded ? (
        <SortableContext items={childRows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
          <ul className="bg-surface">
            {childRows.length === 0 ? (
              <li className="px-3 py-3 text-small text-text-muted">ქვეკატეგორიები ჯერ არ არის — ჩააგდეთ აქ ან გამოიყენეთ „გადატანა“.</li>
            ) : (
              childRows.map((child) => (
                <SortableRow
                  key={child.id}
                  row={child}
                  mains={mains}
                  disabled={disabled}
                  onDelete={onDelete}
                  onMoveTo={onMoveTo}
                />
              ))
            )}
          </ul>
        </SortableContext>
      ) : null}
    </section>
  );
}

export function CategoryTreeManager({ initialRows }: { initialRows: AdminCategoryRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialRows.filter((r) => !r.parentId).map((r) => r.id)));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const mains = useMemo(() => rows.filter((row) => !row.parentId), [rows]);
  const childrenByParent = useMemo(() => {
    const map = new Map<string, AdminCategoryRow[]>();
    for (const row of rows) {
      if (!row.parentId) continue;
      const list = map.get(row.parentId) ?? [];
      list.push(row);
      map.set(row.parentId, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));
    }
    return map;
  }, [rows]);

  const nestedOrphans = useMemo(
    () => rows.filter((row) => row.parentId && !mains.some((main) => main.id === row.parentId) && row.depth > 0),
    [rows, mains],
  );

  const activeRow = activeId ? rows.find((row) => row.id === activeId) : null;

  function persistMove(categoryId: string, newParentId: string | null, indexAmongSiblings: number, previous: AdminCategoryRow[]) {
    startTransition(async () => {
      const result = await moveAdminCategoryTree({ categoryId, newParentId, indexAmongSiblings });
      if (!result.ok) {
        setRows(previous);
        setMessage(result.message);
        return;
      }
      router.refresh();
    });
  }

  function applyLocalParentOrder(nextMains: AdminCategoryRow[], nextChildren: Map<string, AdminCategoryRow[]>) {
    const rebuilt: AdminCategoryRow[] = [];
    nextMains.forEach((main, index) => {
      rebuilt.push({ ...main, parentId: null, parentName: null, sortOrder: index, depth: 0 });
      const kids = nextChildren.get(main.id) ?? [];
      kids.forEach((child, childIndex) => {
        rebuilt.push({
          ...child,
          parentId: main.id,
          parentName: main.name,
          sortOrder: childIndex,
          depth: 1,
        });
      });
    });
    // Keep unmatched nested rows at the end unchanged.
    for (const row of rows) {
      if (rebuilt.some((item) => item.id === row.id)) continue;
      rebuilt.push(row);
    }
    setRows(rebuilt);
  }

  function onDragStart(event: DragStartEvent) {
    setMessage(null);
    setActiveId(String(event.active.id));
  }

  function onDragOver(event: DragOverEvent) {
    const overId = event.over ? String(event.over.id) : null;
    if (overId?.startsWith("group-")) {
      setOverGroupId(overId.slice("group-".length));
      return;
    }
    const overRow = overId ? rows.find((row) => row.id === overId) : null;
    if (overRow && !overRow.parentId) {
      setOverGroupId(overRow.id);
      return;
    }
    if (overRow?.parentId) {
      setOverGroupId(overRow.parentId);
      return;
    }
    setOverGroupId(null);
  }

  function onDragEnd(event: DragEndEvent) {
    const draggedId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    setActiveId(null);
    setOverGroupId(null);
    if (!overId || draggedId === overId) return;

    const previous = rows;
    const dragged = rows.find((row) => row.id === draggedId);
    if (!dragged) return;

    const isMain = !dragged.parentId;
    const overGroup = overId.startsWith("group-") ? overId.slice("group-".length) : null;
    const overRow = rows.find((row) => row.id === overId);

    // Dropping a subcategory onto a main group (or its header).
    if (!isMain && (overGroup || (overRow && !overRow.parentId))) {
      const targetParentId = overGroup ?? overRow!.id;
      if (targetParentId === dragged.id) return;
      const nextChildren = new Map(childrenByParent);
      for (const [parentId, list] of nextChildren) {
        nextChildren.set(
          parentId,
          list.filter((row) => row.id !== draggedId),
        );
      }
      const destination = [...(nextChildren.get(targetParentId) ?? [])];
      const insertAt =
        overRow?.parentId === targetParentId
          ? Math.max(0, destination.findIndex((row) => row.id === overRow.id))
          : destination.length;
      const cleanInsert = insertAt < 0 ? destination.length : insertAt;
      destination.splice(cleanInsert, 0, dragged);
      nextChildren.set(targetParentId, destination);
      applyLocalParentOrder(mains, nextChildren);
      persistMove(draggedId, targetParentId, cleanInsert, previous);
      setExpanded((current) => new Set(current).add(targetParentId));
      return;
    }

    // Reorder mains.
    if (isMain && overRow && !overRow.parentId) {
      const oldIndex = mains.findIndex((row) => row.id === draggedId);
      const newIndex = mains.findIndex((row) => row.id === overRow.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const nextMains = arrayMove(mains, oldIndex, newIndex);
      applyLocalParentOrder(nextMains, childrenByParent);
      persistMove(draggedId, null, newIndex, previous);
      return;
    }

    // Reorder within same parent.
    if (!isMain && overRow?.parentId && overRow.parentId === dragged.parentId) {
      const siblings = childrenByParent.get(dragged.parentId!) ?? [];
      const oldIndex = siblings.findIndex((row) => row.id === draggedId);
      const newIndex = siblings.findIndex((row) => row.id === overRow.id);
      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
      const nextSiblings = arrayMove(siblings, oldIndex, newIndex);
      const nextChildren = new Map(childrenByParent);
      nextChildren.set(dragged.parentId!, nextSiblings);
      applyLocalParentOrder(mains, nextChildren);
      persistMove(draggedId, dragged.parentId, newIndex, previous);
    }
  }

  function onMoveTo(row: AdminCategoryRow, parentId: string | null) {
    if ((row.parentId ?? null) === parentId) return;
    if (parentId === row.id) return;
    const previous = rows;

    if (parentId == null) {
      const roots = mains.filter((item) => item.id !== row.id);
      const index = roots.length;
      const nextChildren = new Map(childrenByParent);
      for (const [pid, list] of nextChildren) {
        nextChildren.set(
          pid,
          list.filter((item) => item.id !== row.id),
        );
      }
      roots.push({ ...row, parentId: null, parentName: null, depth: 0, childCount: row.childCount });
      applyLocalParentOrder(roots, nextChildren);
      persistMove(row.id, null, index, previous);
      return;
    }

    const nextChildren = new Map(childrenByParent);
    for (const [pid, list] of nextChildren) {
      nextChildren.set(
        pid,
        list.filter((item) => item.id !== row.id),
      );
    }
    const destination = [...(nextChildren.get(parentId) ?? [])];
    destination.push(row);
    nextChildren.set(parentId, destination);
    const nextMains = mains.filter((item) => item.id !== row.id);
    applyLocalParentOrder(nextMains, nextChildren);
    setExpanded((current) => new Set(current).add(parentId));
    persistMove(row.id, parentId, destination.length - 1, previous);
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
          `კატეგორიას აქვს ${row.archivedProductCount} დაარქივებული პროდუქტი — გადაიტანეთ ან აღადგინეთ Admin → პროდუქტები → არქივი.`,
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
          <h2 className="text-body font-semibold text-text">კატეგორიების ორგანიზატორი</h2>
          <p className="text-label text-text-faint">
            მთავარი კატეგორიები ჯგუფებადაა. ქვეკატეგორია ჩააგდეთ მთელ ჯგუფზე, ან გამოიყენეთ „გადატანა“.
          </p>
        </div>
        {pending ? <span className="text-label text-text-muted">ინახება…</span> : null}
      </div>
      {message ? (
        <p role="alert" className="mx-3 mt-3 rounded-[var(--radius-sm)] bg-danger-50 px-3 py-2 text-small text-danger-600">
          {message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 p-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveId(null);
            setOverGroupId(null);
          }}
        >
          <SortableContext items={mains.map((row) => row.id)} strategy={verticalListSortingStrategy}>
            {mains.map((main) => (
              <MainGroup
                key={main.id}
                main={main}
                childRows={childrenByParent.get(main.id) ?? []}
                expanded={expanded.has(main.id)}
                onToggle={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(main.id)) next.delete(main.id);
                    else next.add(main.id);
                    return next;
                  })
                }
                overGroupId={overGroupId}
                disabled={pending}
                onDelete={onDelete}
                onMoveTo={onMoveTo}
                mains={mains}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeRow ? (
              <div className="rounded-[var(--radius-sm)] border border-brand-400 bg-surface px-3 py-2 shadow-md">
                <div className="font-medium text-text">{activeRow.name}</div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {nestedOrphans.length ? (
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-3">
            <h3 className="text-small font-semibold text-text">სხვა / ღრმა ქვეკატეგორიები</h3>
            <p className="text-label mb-2 text-text-faint">გადაიტანეთ მთავარ კატეგორიაში „გადატანა“ მენიუდან.</p>
            <ul className="flex flex-col gap-1">
              {nestedOrphans.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-2 rounded bg-surface px-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="text-label text-text-faint">{row.parentName ?? "—"}</div>
                  </div>
                  <select
                    className={`${adminSelectClass} h-8 min-w-[10rem] py-0 text-[0.75rem]`}
                    value=""
                    disabled={pending}
                    onChange={(event) => {
                      if (!event.target.value) return;
                      onMoveTo(row, event.target.value);
                    }}
                  >
                    <option value="">გადატანა →</option>
                    {mains.map((main) => (
                      <option key={main.id} value={main.id}>
                        {main.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
