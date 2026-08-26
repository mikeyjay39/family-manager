import { describe, expect, it } from 'vitest';
import {
  formatIsoDateForInput,
  parseOptionalDateInput,
  parseTags,
} from './document-create-form-utils';

describe('parseOptionalDateInput', () => {
  it('returns null for empty or whitespace input', () => {
    expect(parseOptionalDateInput('')).toEqual({ ok: true, value: null });
    expect(parseOptionalDateInput('   ')).toEqual({ ok: true, value: null });
  });

  it('converts valid YYYY-MM-DD to naive datetime string', () => {
    expect(parseOptionalDateInput('2024-06-01')).toEqual({
      ok: true,
      value: '2024-06-01T00:00:00',
    });
    expect(parseOptionalDateInput(' 2026-12-31 ')).toEqual({
      ok: true,
      value: '2026-12-31T00:00:00',
    });
  });

  it('rejects invalid format or calendar dates', () => {
    expect(parseOptionalDateInput('06/01/2024')).toEqual({ ok: false });
    expect(parseOptionalDateInput('2024-6-1')).toEqual({ ok: false });
    expect(parseOptionalDateInput('2024-13-01')).toEqual({ ok: false });
    expect(parseOptionalDateInput('2024-02-30')).toEqual({ ok: false });
    expect(parseOptionalDateInput('not-a-date')).toEqual({ ok: false });
  });
});

describe('formatIsoDateForInput', () => {
  it('returns empty string for null or undefined', () => {
    expect(formatIsoDateForInput(null)).toBe('');
    expect(formatIsoDateForInput(undefined)).toBe('');
  });

  it('slices ISO datetime to YYYY-MM-DD', () => {
    expect(formatIsoDateForInput('2024-06-01T00:00:00')).toBe('2024-06-01');
  });
});

describe('parseTags', () => {
  it('splits comma-separated tags and trims empty entries', () => {
    expect(parseTags('tax, 2024, , finance')).toEqual(['tax', '2024', 'finance']);
  });
});
