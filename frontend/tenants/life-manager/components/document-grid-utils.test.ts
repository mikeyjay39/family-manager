import type { DocumentDto } from '@/lib/api/types';
import {
  formatDocumentCellValue,
  formatDocumentDate,
  formatDocumentTags,
} from './document-grid-utils';

describe('document cell formatters', () => {
  it('formats tags as comma-separated values or em dash when empty', () => {
    expect(formatDocumentTags(['tax', '2024'])).toBe('tax, 2024');
    expect(formatDocumentTags([])).toBe('—');
  });

  it('formats dates or em dash when null', () => {
    expect(formatDocumentDate(null)).toBe('—');
    expect(formatDocumentDate('2024-06-01T00:00:00')).toBe(
      new Date('2024-06-01T00:00:00').toLocaleDateString()
    );
  });

  it('formats full document row values', () => {
    const doc: DocumentDto = {
      id: '1',
      title: '',
      content: 'Body',
      tags: ['work'],
      created_at: '2026-07-11T00:00:00',
      issued_date: null,
      expire_date: '2026-06-01T00:00:00',
    };
    expect(formatDocumentCellValue(doc, 'title')).toBe('(Untitled)');
    expect(formatDocumentCellValue(doc, 'tags')).toBe('work');
    expect(formatDocumentCellValue(doc, 'issued_date')).toBe('—');
  });
});
