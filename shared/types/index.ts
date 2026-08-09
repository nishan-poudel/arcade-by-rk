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
  /** Whether this player has cast their vote during the discussion phase */
  hasVoted: boolean
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
 * SECURITY NOTE: the host is just another player who happens to coordinate
 * turns/voting — they must NOT learn who the imposter(s) are ahead of time,
 * and they themselves can be assigned the imposter role. Nobody's private
 * assignment reveals the identity of other players' roles; imposters are
 * only revealed to everyone together, after the round ends (see `GameReveal`).
 */
export interface PlayerAssignment {
  role: PlayerRole
  /** Secret word for crewmates; null for imposters */
  word: string | null
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

/** Cast (or change) a vote during the discussion phase */
export interface SubmitVotePayload {
  roomCode: string
  /** Player ID being voted for as the imposter */
  votedPlayerId: string
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
 * Broadcast to all players after in-app voting is tallied (or host force-reveals).
 * Safe to reveal publicly — the round is over at this point.
 */
export interface GameReveal {
  word: string
  imposterNames: string[]
  imposterCaught: boolean
  round: number
  /** Player ID that received the most votes, or null if tied/no votes */
  ejectedPlayerId: string | null
  /** Convenience name for the ejected player, or null */
  ejectedPlayerName: string | null
  /** playerId → number of votes received */
  voteCounts: Record<string, number>
}
