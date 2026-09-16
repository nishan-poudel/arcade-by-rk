import type { Card } from '@callbreak/shared-logic'

export type FarasPhase = 'lobby' | 'hand' | 'handResult' | 'gameOver'
export type FarasMode = 'betting' | 'show'
export type FarasCategory = 'trail' | 'pureSequence' | 'sequence' | 'color' | 'pair' | 'highCard'

export interface FarasPublicPlayer {
  id: string
  name: string
  isHost: boolean
  connected: boolean
  /** Betting mode currency. Always present, only meaningful in that mode. */
  chips: number
  /** Show mode's running total. Always present, only meaningful in that mode. */
  score: number
  /** Never connects, acts on its own turn server-side. */
  isBot: boolean
}

export interface FarasHandPlayerState {
  folded: boolean
  seen: boolean
}

export interface FarasLastResult {
  winnerIds: string[]
  category: FarasCategory | null
  revealedHands: Record<string, Card[]>
  /** Betting mode only: the pot the winner(s) just split. */
  potWon?: number
}

export interface FarasStateView {
  code: string
  phase: FarasPhase
  mode: FarasMode
  players: FarasPublicPlayer[]
  handState: Record<string, FarasHandPlayerState>
  turnPlayerId: string | null
  dealerIndex: number
  /** Betting mode only. */
  pot: number
  /** Betting mode only: this hand's boot/base bet unit. */
  stake: number
  lastResult: FarasLastResult | null
  yourPlayerId: string | null
  yourHand: Card[]
  createdAt: number
  lastActivityAt: number
}

export type FarasScreen = 'landing' | 'waitingRoom' | 'hand' | 'handResult' | 'gameOver'
