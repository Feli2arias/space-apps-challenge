/** Faintest and strongest tint of a month cell, so even the smallest value shows a trace. */
const MIN_TINT = 0.08;
const MAX_TINT = 0.9;

/**
 * Opacity of the cinnabar tint behind a month cell, from a share between 0 and 1.
 * `null` (no value) gives no tint at all, so a missing month never looks like a small one.
 */
export function tintOpacity(share: number | null | undefined): number {
  if (typeof share !== "number" || !Number.isFinite(share)) return 0;
  const clamped = Math.min(1, Math.max(0, share));
  return MIN_TINT + (MAX_TINT - MIN_TINT) * clamped;
}
