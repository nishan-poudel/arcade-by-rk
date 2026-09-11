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

export interface ScoreStateView {
  code: string
  phase: ScorePhase
  roundCount: RoundCount
  round: number
  players: (PublicPlayer | null)[]
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
