import type { DocumentDto } from '@/lib/api/types';
import {
  compareLocaleText,
  compareNullableDate,
  compareStorageFilename,
  formatDocumentCellValue,
  formatDocumentDate,
  formatDocumentTags,
  getStorageFilename,
} from './document-grid-utils';

const baseDoc = (overrides: Partial<DocumentDto> = {}): DocumentDto => ({
  id: '1',
  title: 'Alpha',
  content: 'Body',
  tags: [],
  created_at: '2026-07-11T00:00:00',
  issued_date: null,
  expire_date: null,
  storage: null,
  ...overrides,
});

describe('document sort comparators', () => {
  it('compares text case-insensitively', () => {
    expect(compareLocaleText('alpha', 'Beta')).toBeLessThan(0);
    expect(compareLocaleText('Beta', 'alpha')).toBeGreaterThan(0);
  });

  it('keeps null dates last in ascending and descending order', () => {
    expect(compareNullableDate(null, '2026-01-01T00:00:00', false)).toBeGreaterThan(0);
    expect(compareNullableDate('2026-01-01T00:00:00', null, false)).toBeLessThan(0);
    expect(compareNullableDate(null, '2026-01-01T00:00:00', true)).toBeLessThan(0);
    expect(compareNullableDate('2026-01-01T00:00:00', null, true)).toBeGreaterThan(0);
  });

  it('compares tags by joined string order', () => {
    expect(formatDocumentTags(['a', 'b']).localeCompare(formatDocumentTags(['c']))).toBeLessThan(0);
  });

  it('compares storage filenames with empty values last', () => {
    const withFile = baseDoc({
      storage: {
        provider: 'proton_drive',
        share_id: 'share',
        node_id: 'node',
        filename: 'beta.pdf',
        mime_type: 'application/pdf',
      },
    });
    const withOtherFile = baseDoc({
      id: '2',
      storage: {
        provider: 'proton_drive',
        share_id: 'share',
        node_id: 'node-2',
        filename: 'alpha.pdf',
        mime_type: 'application/pdf',
      },
    });
    const withoutFile = baseDoc({ id: '3', storage: null });

    expect(getStorageFilename(withFile)).toBe('beta.pdf');
    expect(compareStorageFilename(withOtherFile, withFile, false)).toBeLessThan(0);
    expect(compareStorageFilename(withoutFile, withFile, false)).toBeGreaterThan(0);
    expect(compareStorageFilename(withoutFile, withFile, true)).toBeLessThan(0);
  });
});

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
