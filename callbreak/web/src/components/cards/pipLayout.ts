/**
 * Standard French-suited pip layouts for number cards (2-10), so a "7 of
 * hearts" actually shows seven hearts arranged the way a real card does,
 * not one big glyph regardless of rank. Positions are percentages within
 * the card's padded inner area; pips in the bottom half are rotated 180°
 * to match a real deck's up-down symmetry. Face cards (J/Q/K) and the Ace
 * don't use this table — they keep the single big center glyph.
 */
export interface PipPosition {
  x: number
  y: number
  rotate?: boolean
}

const L = 27
const C = 50
const R = 73

const T2 = 18 // top row
const T15 = 27 // upper-middle (10 only)
const T1 = 34 // upper row (7/8/9/10)
const M = 50 // dead center (5/9)
const B1 = 66 // lower row (8/9/10)
const B15 = 73 // lower-middle (10 only)
const B2 = 82 // bottom row

export const PIP_LAYOUTS: Record<number, PipPosition[]> = {
  2: [
    { x: C, y: T2 },
    { x: C, y: B2, rotate: true },
  ],
  3: [
    { x: C, y: T2 },
    { x: C, y: M },
    { x: C, y: B2, rotate: true },
  ],
  4: [
    { x: L, y: T2 },
    { x: R, y: T2 },
    { x: L, y: B2, rotate: true },
    { x: R, y: B2, rotate: true },
  ],
  5: [
    { x: L, y: T2 },
    { x: R, y: T2 },
    { x: C, y: M },
    { x: L, y: B2, rotate: true },
    { x: R, y: B2, rotate: true },
  ],
  6: [
    { x: L, y: T2 },
    { x: R, y: T2 },
    { x: L, y: M },
    { x: R, y: M },
    { x: L, y: B2, rotate: true },
    { x: R, y: B2, rotate: true },
  ],
  7: [
    { x: L, y: T2 },
    { x: R, y: T2 },
    { x: C, y: T1 },
    { x: L, y: M },
    { x: R, y: M },
    { x: L, y: B2, rotate: true },
    { x: R, y: B2, rotate: true },
  ],
  8: [
    { x: L, y: T2 },
    { x: R, y: T2 },
    { x: C, y: T1 },
    { x: L, y: M },
    { x: R, y: M },
    { x: C, y: B1, rotate: true },
    { x: L, y: B2, rotate: true },
    { x: R, y: B2, rotate: true },
  ],
  9: [
    { x: L, y: T2 },
    { x: R, y: T2 },
    { x: L, y: T1 },
    { x: R, y: T1 },
    { x: C, y: M },
    { x: L, y: B1, rotate: true },
    { x: R, y: B1, rotate: true },
    { x: L, y: B2, rotate: true },
    { x: R, y: B2, rotate: true },
  ],
  10: [
    { x: L, y: T2 },
    { x: R, y: T2 },
    { x: L, y: T1 },
    { x: R, y: T1 },
    { x: C, y: T15 },
    { x: L, y: B1, rotate: true },
    { x: R, y: B1, rotate: true },
    { x: C, y: B15, rotate: true },
    { x: L, y: B2, rotate: true },
    { x: R, y: B2, rotate: true },
  ],
}
