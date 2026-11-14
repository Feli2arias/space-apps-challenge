export type Rgb = readonly [number, number, number];

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Parses a hex colour as it comes out of a CSS custom property.
 * Build tools may shorten "#ffffff" to "#fff", so both forms are accepted.
 * Returns null for anything else, so a missing token never draws a wrong colour.
 */
export function parseHex(value: string): Rgb | null {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match) return null;
  const digits = match[1];
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : digits;
  const packed = Number.parseInt(full, 16);
  return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255];
}
