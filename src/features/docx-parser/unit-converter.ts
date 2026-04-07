/**
 * Convert twips to points
 * 1 twip = 1/1440 inch = 1/20 point
 */
export function twipsToPt(twips: number): number {
  return twips / 20;
}

/**
 * Convert half-points to points
 * 1 half-point = 0.5 point
 */
export function halfPointsToPt(halfPoints: number): number {
  return halfPoints / 2;
}

/**
 * Convert twips to pixels (assuming 96 DPI)
 * 1 inch = 96 px = 1440 twips
 * 1 px = 15 twips
 */
export function twipsToPx(twips: number): number {
  return twips / 15;
}

export function parseUnit(value: string | null | undefined): number {
  if (!value) return 0;
  return parseInt(value, 10) || 0;
}