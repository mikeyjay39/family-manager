import { withAlpha } from '@/lib/tenant/theme/color-utils';

describe('withAlpha', () => {
  it('adds alpha to a 6-digit hex color', () => {
    expect(withAlpha('#687076', 0.2)).toBe('#68707633');
  });

  it('replaces alpha on an 8-digit hex color', () => {
    expect(withAlpha('#687076ff', 0.5)).toBe('#68707680');
  });

  it('expands 3-digit shorthand hex', () => {
    expect(withAlpha('#fff', 1)).toBe('#ffffffff');
  });

  it('clamps alpha to 0–1 range', () => {
    expect(withAlpha('#000000', -0.5)).toBe('#00000000');
    expect(withAlpha('#000000', 1.5)).toBe('#000000ff');
  });

  it('returns the input unchanged for invalid hex', () => {
    expect(withAlpha('not-a-color', 0.5)).toBe('not-a-color');
  });
});
