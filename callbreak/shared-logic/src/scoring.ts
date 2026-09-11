export const MIN_CALL = 1
export const MAX_CALL = 13

export const ROUND_COUNT_OPTIONS = [3, 5, 7] as const
export type RoundCount = (typeof ROUND_COUNT_OPTIONS)[number]
export const DEFAULT_ROUND_COUNT: RoundCount = 5

export function isValidCall(call: number): boolean {
  return Number.isInteger(call) && call >= MIN_CALL && call <= MAX_CALL
}

/**
 * Nepali Call Break scoring for one round:
 * - Made the call exactly or more: `call` points, plus 0.1 per overtrick.
 * - Missed the call: `-call` points.
 * Rounded to 1 decimal to avoid floating-point artifacts (e.g. 4 + 0.1*2).
 */
export function scoreRound(call: number, tricksWon: number): number {
  const raw = tricksWon >= call ? call + 0.1 * (tricksWon - call) : -call
  return Math.round(raw * 10) / 10
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
