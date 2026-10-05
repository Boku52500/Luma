export type CategoryProductBlocker = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  archived: boolean;
};

export type CategoryProductAssignment = {
  categoryId: string;
  /** Direct products with deletedAt == null (shown as "N პროდუქტი"). */
  liveCount: number;
  /** Direct products with deletedAt != null (still hold categoryId FK). */
  archivedCount: number;
  /** liveCount + archivedCount — blocks category delete while FK remains. */
  assignedCount: number;
  blockers: CategoryProductBlocker[];
};
