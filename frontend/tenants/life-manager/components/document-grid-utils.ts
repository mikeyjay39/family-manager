import type { DocumentDto } from '@/lib/api/types';

export type DocumentColumnKey = Exclude<keyof DocumentDto, 'id'>;

const EMPTY_CELL = '—';

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
  }
}
