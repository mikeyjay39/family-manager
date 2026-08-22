import type { SortingFn, SortingState } from '@tanstack/react-table';
import type { DocumentDto } from '@/lib/api/types';

export type DocumentColumnKey = Exclude<keyof DocumentDto, 'id'>;

const EMPTY_CELL = '—';

export function compareLocaleText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function parseDateSortKey(value: string | null | undefined): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : time;
}

export function compareNullableDate(
  a: string | null | undefined,
  b: string | null | undefined,
  isDesc: boolean
): number {
  const aKey = parseDateSortKey(a);
  const bKey = parseDateSortKey(b);
  if (aKey === undefined && bKey === undefined) {
    return 0;
  }
  if (aKey === undefined) {
    return isDesc ? -1 : 1;
  }
  if (bKey === undefined) {
    return isDesc ? 1 : -1;
  }
  return aKey - bKey;
}

export function getStorageFilename(doc: DocumentDto): string {
  if (doc.storage?.provider === 'proton_drive') {
    return doc.storage.filename;
  }
  return '';
}

export function compareStorageFilename(a: DocumentDto, b: DocumentDto, isDesc: boolean): number {
  const aName = getStorageFilename(a);
  const bName = getStorageFilename(b);
  const aEmpty = aName === '';
  const bEmpty = bName === '';
  if (aEmpty && bEmpty) {
    return 0;
  }
  if (aEmpty) {
    return isDesc ? -1 : 1;
  }
  if (bEmpty) {
    return isDesc ? 1 : -1;
  }
  return compareLocaleText(aName, bName);
}

function isColumnSortedDesc(
  getSorting: () => SortingState,
  columnId: string
): boolean {
  return getSorting().find((entry) => entry.id === columnId)?.desc ?? false;
}

export function createDocumentSortingFns(
  getSorting: () => SortingState
): Record<string, SortingFn<DocumentDto>> {
  const textSort =
    (columnId: string): SortingFn<DocumentDto> =>
    (rowA, rowB) => {
      const a = String(rowA.getValue(columnId) ?? '');
      const b = String(rowB.getValue(columnId) ?? '');
      return compareLocaleText(a, b);
    };

  return {
    title: textSort('title'),
    content: textSort('content'),
    tags: (rowA, rowB) =>
      compareLocaleText(formatDocumentTags(rowA.original.tags), formatDocumentTags(rowB.original.tags)),
    created_at: (rowA, rowB, columnId) =>
      compareNullableDate(
        rowA.getValue(columnId) as string | null,
        rowB.getValue(columnId) as string | null,
        isColumnSortedDesc(getSorting, columnId)
      ),
    issued_date: (rowA, rowB, columnId) =>
      compareNullableDate(
        rowA.getValue(columnId) as string | null,
        rowB.getValue(columnId) as string | null,
        isColumnSortedDesc(getSorting, columnId)
      ),
    expire_date: (rowA, rowB, columnId) =>
      compareNullableDate(
        rowA.getValue(columnId) as string | null,
        rowB.getValue(columnId) as string | null,
        isColumnSortedDesc(getSorting, columnId)
      ),
    storage: (rowA, rowB, columnId) =>
      compareStorageFilename(
        rowA.original,
        rowB.original,
        isColumnSortedDesc(getSorting, columnId)
      ),
  };
}

export function formatDocumentTags(tags: string[]): string {
  return tags.length > 0 ? tags.join(', ') : EMPTY_CELL;
}

export function formatDocumentDate(value: string | null): string {
  if (value == null || value === '') {
    return EMPTY_CELL;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString();
}

export function formatDocumentCellValue(doc: DocumentDto, key: DocumentColumnKey): string {
  switch (key) {
    case 'title':
      return doc.title || '(Untitled)';
    case 'content':
      return doc.content;
    case 'tags':
      return formatDocumentTags(doc.tags);
    case 'created_at':
      return formatDocumentDate(doc.created_at);
    case 'issued_date':
      return formatDocumentDate(doc.issued_date);
    case 'expire_date':
      return formatDocumentDate(doc.expire_date);
    case 'storage':
      if (doc.storage?.provider === 'proton_drive') {
        return `Proton: ${doc.storage.filename}`;
      }
      return EMPTY_CELL;
  }
}
