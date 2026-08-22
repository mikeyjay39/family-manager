import { describe, expect, it } from 'vitest';
import { parseOptionalDateInput } from './document-create-form-utils';

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
