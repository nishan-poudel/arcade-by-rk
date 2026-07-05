/**
 * Shared TypeScript types used by both client and server.
 * Keep this file in sync if you add new events or state shapes.
 */

// ─── Enums / Literals ────────────────────────────────────────────────────────

/** Phases the game can be in */
export type GamePhase = 'lobby' | 'playing' | 'discussion' | 'ended'

/** Word difficulty levels */
export type Difficulty = 'easy' | 'medium' | 'hard'

/** Player role within a round */
export type PlayerRole = 'crewmate' | 'imposter'

// ─── Core Entities ────────────────────────────────────────────────────────────

/** Public player info broadcast to all clients */
export interface PublicPlayer {
  id: string
  name: string
  score: number
  isHost: boolean
  connected: boolean
  /** Whether this player has pressed "Done" this round */
  hasDone: boolean
}

/**
 * Full game state broadcast to every client after any state change.
 * Does NOT include secret info (words, roles) — those are sent privately.
 */
export interface GameState {
  roomCode: string
  phase: GamePhase
  difficulty: Difficulty
  players: PublicPlayer[]
  /** Socket ID of the player whose turn it currently is */
  currentTurnPlayerId: string
  currentTurnName: string
  currentTurnIndex: number
  round: number
  imposterCount: number
  hostId: string
}

/**
 * Private assignment sent ONLY to the individual player via their socket.
 *
 * SECURITY NOTE: `imposterIds` is populated ONLY in the copy sent to the host
 * socket.  Every other player (crewmate or imposter) receives an empty array
 * so that intercepting socket traffic cannot reveal who the imposters are.
 * The server enforces this in handlers.ts – never rely on the client to hide it.
 */
export interface PlayerAssignment {
  role: PlayerRole
  /** Secret word for crewmates; null for imposters */
  word: string | null
  /**
   * Non-empty only in the host's private assignment.
   * Contains socket IDs of all imposters for the current round.
   */
  imposterIds: string[]
}

// ─── Client → Server Payloads ─────────────────────────────────────────────────

export interface CreateRoomPayload {
  hostName: string
  difficulty: Difficulty
  imposterCount: number
}

export interface JoinRoomPayload {
  roomCode: string
  playerName: string
}

export interface RecordResultPayload {
  /** true  → imposters were caught → crewmates score  */
  /** false → imposters survived   → imposters score   */
  imposterCaught: boolean
}

export interface SetDifficultyPayload {
  difficulty: Difficulty
}

export interface SetImposterCountPayload {
  imposterCount: number
}

export interface RejoinPayload {
  roomCode: string
  playerName: string
}

// ─── Server → Client Payloads ─────────────────────────────────────────────────

export interface RoomCreatedPayload {
  roomCode: string
  gameState: GameState
  assignment: PlayerAssignment
}

export interface RoomJoinedPayload {
  gameState: GameState
  assignment: PlayerAssignment
}

export interface ErrorPayload {
  message: string
}

/**
 * Broadcast to all players after a voting result is recorded.
 * Safe to reveal publicly — the round is over at this point.
 */
export interface GameReveal {
  word: string
  imposterNames: string[]
  imposterCaught: boolean
  round: number
}
