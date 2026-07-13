import type { WorksItem } from '@/apis/creator';

export type WorksTableRow = Omit<WorksItem, 'id'> & {
  /** DataGrid-only key. The original backend ID is retained in contentId. */
  id: string;
  contentId: string | number;
};

/**
 * Build stable, unique DataGrid row IDs.
 *
 * New core-api versions quote unsafe BIGINT IDs, preserving their exact value. During a
 * rolling deployment an older core-api may still send them as JSON numbers; by the time
 * JavaScript receives those values their precision is already lost. A page-local fallback
 * key prevents those legacy values from collapsing multiple rows in MUI DataGrid.
 */
export function toWorksTableRows(
  records: WorksItem[],
  pageNumber: number,
): WorksTableRow[] {
  return records.map((work, index) => {
    const hasExactWireId = typeof work.id === 'string' || Number.isSafeInteger(work.id);
    const gridId = hasExactWireId
      ? String(work.id)
      : `legacy:${pageNumber}:${index}`;

    return {
      ...work,
      contentId: work.id,
      id: gridId,
    };
  });
}
