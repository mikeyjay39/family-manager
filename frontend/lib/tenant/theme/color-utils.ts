type Rgb = { r: number; g: number; b: number; a?: number };

function parseHex(hex: string): Rgb | null {
  const normalized = hex.replace(/^#/, '');
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0] + normalized[0], 16),
      g: parseInt(normalized[1] + normalized[1], 16),
      b: parseInt(normalized[2] + normalized[2], 16),
    };
  }
  if (normalized.length === 6 || normalized.length === 8) {
    const rgb: Rgb = {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
    if (normalized.length === 8) {
      rgb.a = parseInt(normalized.slice(6, 8), 16);
    }
    return rgb;
  }
  return null;
}

function toHexByte(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');
}

/** Returns an 8-digit hex color (#RRGGBBAA) with the given alpha (0–1). */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) {
    return hex;
  }

  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255);
  return `#${toHexByte(rgb.r)}${toHexByte(rgb.g)}${toHexByte(rgb.b)}${toHexByte(a)}`;
}

/**
 * Mixes a hex color toward black by `amount` (0 = unchanged, 1 = black).
 * Preserves alpha when the input is 8-digit hex; otherwise returns #RRGGBB.
 */
export function mixTowardBlack(hex: string, amount: number): string {
  const rgb = parseHex(hex);
  if (!rgb) {
    return hex;
  }

  const t = Math.min(1, Math.max(0, amount));
  const r = rgb.r * (1 - t);
  const g = rgb.g * (1 - t);
  const b = rgb.b * (1 - t);
  const base = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  if (rgb.a !== undefined) {
    return `${base}${toHexByte(rgb.a)}`;
  }
  return base;
}
