const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ParseOptionalDateResult =
  | { ok: true; value: string | null }
  | { ok: false };

export function parseOptionalDateInput(value: string): ParseOptionalDateResult {
  const trimmed = value.trim();
  if (trimmed === '') {
    return { ok: true, value: null };
  }

  if (!DATE_INPUT_PATTERN.test(trimmed)) {
    return { ok: false };
  }

  const [year, month, day] = trimmed.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return { ok: false };
  }

  return { ok: true, value: `${trimmed}T00:00:00` };
}
