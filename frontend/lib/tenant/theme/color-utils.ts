/** Returns an 8-digit hex color (#RRGGBBAA) with the given alpha (0–1). */
export function withAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace(/^#/, '');
  let r: number;
  let g: number;
  let b: number;

  if (normalized.length === 3) {
    r = parseInt(normalized[0] + normalized[0], 16);
    g = parseInt(normalized[1] + normalized[1], 16);
    b = parseInt(normalized[2] + normalized[2], 16);
  } else if (normalized.length === 6 || normalized.length === 8) {
    r = parseInt(normalized.slice(0, 2), 16);
    g = parseInt(normalized.slice(2, 4), 16);
    b = parseInt(normalized.slice(4, 6), 16);
  } else {
    return hex;
  }

  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  const rr = r.toString(16).padStart(2, '0');
  const gg = g.toString(16).padStart(2, '0');
  const bb = b.toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}${a}`;
}
