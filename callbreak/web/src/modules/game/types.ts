import type { Card, RoundCount } from '@callbreak/shared-logic'

export type GamePhase = 'lobby' | 'bidding' | 'playing' | 'roundEnd' | 'gameOver'

export interface PublicPlayer {
  id: string
  name: string
  seat: number
  connected: boolean
  isHost: boolean
}

export interface TrickCardPlay {
  seat: number
  card: Card
}

export interface LastTrick {
  cards: TrickCardPlay[]
  winnerSeat: number
  trickSeq: number
}

export interface RoundHistoryEntry {
  round: number
  bids: (number | null)[]
  tricksWon: number[]
  points: number[]
}

export interface GameStateView {
  code: string
  phase: GamePhase
  roundCount: RoundCount
  round: number
  dealerSeat: number
  turnSeat: number
  players: (PublicPlayer | null)[]
  yourSeat: number | null
  yourPlayerId: string | null
  hand: Card[]
  handCounts: number[]
  bids: (number | null)[]
  currentTrick: TrickCardPlay[]
  tricksWon: number[]
  lastTrick: LastTrick | null
  roundHistory: RoundHistoryEntry[]
  totals: number[]
  instantWinSeat: number | null
  winnerSeat: number | null
  createdAt: number
  lastActivityAt: number
}

export type GameScreen = 'landing' | 'waitingRoom' | 'bidding' | 'trickPlay' | 'roundResult' | 'gameOver'
