export const MIN_CALL = 1
export const MAX_CALL = 13

export const ROUND_COUNT_OPTIONS = [3, 5, 7] as const
export type RoundCount = (typeof ROUND_COUNT_OPTIONS)[number]
export const DEFAULT_ROUND_COUNT: RoundCount = 5

export function isValidCall(call: number): boolean {
  return Number.isInteger(call) && call >= MIN_CALL && call <= MAX_CALL
}

/** Calling 8+ and making it ends the game immediately — that player wins
 * outright, regardless of point totals or rounds remaining. */
export const INSTANT_WIN_CALL = 8

export function isInstantWin(call: number, tricksWon: number): boolean {
  return call >= INSTANT_WIN_CALL && tricksWon >= call
}

/** "Dhoos Dismiss": if every single player misses their call in the same
 * round, the game ends immediately right there — no one gets a special
 * win, it just forces game-over the same way reaching the last configured
 * round would (highest total wins as usual). */
export function allBidsMissed(tallies: readonly { call: number; tricksWon: number }[]): boolean {
  return tallies.length > 0 && tallies.every((t) => t.tricksWon < t.call)
}

/**
 * Call Break scoring for one round:
 * - Made the call exactly or more: `call` points, plus 0.1 per overtrick.
 * - Missed the call: `-call` points.
 * Rounded to 1 decimal to avoid floating-point artifacts (e.g. 4 + 0.1*2).
 */
export function scoreRound(call: number, tricksWon: number): number {
  const raw = tricksWon >= call ? call + 0.1 * (tricksWon - call) : -call
  return Math.round(raw * 10) / 10
}

/**
 * The same scoring split into "points" and "OT" (overtricks) the way
 * Nepali players actually track it on paper: a whole-number points column
 * plus a running OT tally that rolls over into a point every 10 (10 OT is
 * worth exactly 1 point either way — this is the same arithmetic as
 * `scoreRound`'s +0.1/overtrick, just kept as two whole numbers instead of
 * one decimal). `points + ot / 10 === scoreRound(call, tricksWon)` always.
 */
export interface PointsOT {
  points: number
  ot: number
}

/** Rolls any OT >= 10 into whole points, keeping OT in 0-9. Safe for a
 * negative points total since OT itself is never negative. */
export function normalizePointsOT({ points, ot }: PointsOT): PointsOT {
  const rollover = Math.floor(ot / 10)
  return { points: points + rollover, ot: ot - rollover * 10 }
}

export function addPointsOT(a: PointsOT, b: PointsOT): PointsOT {
  return normalizePointsOT({ points: a.points + b.points, ot: a.ot + b.ot })
}

export function sumPointsOT(list: readonly PointsOT[]): PointsOT {
  return list.reduce(addPointsOT, { points: 0, ot: 0 })
}

export function scoreRoundSplit(call: number, tricksWon: number): PointsOT {
  if (tricksWon >= call) return normalizePointsOT({ points: call, ot: tricksWon - call })
  return { points: -call, ot: 0 }
}

export interface PlayerRoundTally {
  playerId: string
  call: number
  tricksWon: number
}

export interface PlayerRoundScore extends PlayerRoundTally {
  points: number
}

export function scoreRoundForPlayers(tallies: readonly PlayerRoundTally[]): PlayerRoundScore[] {
  return tallies.map((t) => ({ ...t, points: scoreRound(t.call, t.tricksWon) }))
}

/** Cumulative totals after N rounds, given each round's per-player points. */
export function cumulativeTotals(rounds: readonly Record<string, number>[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const round of rounds) {
    for (const [playerId, points] of Object.entries(round)) {
      totals[playerId] = Math.round(((totals[playerId] ?? 0) + points) * 10) / 10
    }
  }
  return totals
}
