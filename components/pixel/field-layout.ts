/** Geometry shared by the field scene and the satellite scan drawn over it. */

const HORIZON_RATIO = 0.44;

export interface Layout {
  readonly width: number;
  readonly height: number;
  readonly horizon: number;
  readonly vanishX: number;
  /** Distance between furrows at the bottom edge. */
  readonly spacing: number;
}

export function createLayout(width: number, height: number): Layout {
  return {
    width,
    height,
    horizon: Math.round(height * HORIZON_RATIO),
    vanishX: width * 0.5,
    spacing: Math.max(12, width / 11),
  };
}

/** Column of furrow line `index` at row `y`; all lines meet at the vanishing point. */
export function furrowX(layout: Layout, index: number, y: number): number {
  const depth = (y - layout.horizon) / Math.max(1, layout.height - layout.horizon);
  return layout.vanishX + index * layout.spacing * depth;
}

/** Rows at the bottom of the canvas over which the field dissolves into its ground tone. */
export function fadeRows(layout: Layout): number {
  return Math.max(4, Math.round((layout.height - layout.horizon) * 0.3));
}
