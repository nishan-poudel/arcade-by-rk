import type { Card } from '@callbreak/shared-logic'

export type FarasPhase = 'lobby' | 'hand' | 'handResult' | 'gameOver'
export type FarasCategory = 'trail' | 'pureSequence' | 'sequence' | 'color' | 'pair' | 'highCard'

export interface FarasPublicPlayer {
  id: string
  name: string
  isHost: boolean
  connected: boolean
  score: number
}

export interface FarasHandPlayerState {
  folded: boolean
  seen: boolean
}

export interface FarasLastResult {
  winnerIds: string[]
  category: FarasCategory | null
  revealedHands: Record<string, Card[]>
}

export interface FarasStateView {
  code: string
  phase: FarasPhase
  players: FarasPublicPlayer[]
  handState: Record<string, FarasHandPlayerState>
  turnPlayerId: string | null
  dealerIndex: number
  lastResult: FarasLastResult | null
  yourPlayerId: string | null
  yourHand: Card[]
  createdAt: number
  lastActivityAt: number
}

export type FarasScreen = 'landing' | 'waitingRoom' | 'hand' | 'handResult' | 'gameOver'
