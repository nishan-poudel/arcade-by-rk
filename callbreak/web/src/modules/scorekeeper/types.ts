import type { RoundCount } from '@callbreak/shared-logic'

export type ScorePhase = 'lobby' | 'roundEntry' | 'roundResult' | 'gameOver'

export interface PublicPlayer {
  id: string
  name: string
  seat: number
  connected: boolean
  isHost: boolean
}

export interface RoundEntry {
  call: number
  tricksWon: number
  points: number
}

/** One seat's not-yet-finalized entry for the round in progress. Locked
 * entries can't be changed except by explicitly unlocking first. */
export interface PendingEntry {
  call: number | null
  tricksWon: number | null
  locked: boolean
}

export interface ScoreStateView {
  code: string
  phase: ScorePhase
  roundCount: RoundCount
  round: number
  players: (PublicPlayer | null)[]
  pendingEntries: PendingEntry[]
  history: RoundEntry[][]
  totals: number[]
  instantWinSeat: number | null
  winnerSeat: number | null
  yourSeat: number | null
  yourPlayerId: string | null
  createdAt: number
  lastActivityAt: number
}

export type ScoreScreen = 'landing' | 'waitingRoom' | 'roundEntry' | 'roundResult' | 'gameOver'
