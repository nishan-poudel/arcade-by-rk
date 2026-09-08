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

/** Who won once a game finishes */
export type GameOutcome = 'crew' | 'imposter'

// ─── Core Entities ────────────────────────────────────────────────────────────

/** Public player info broadcast to all clients */
export interface PublicPlayer {
  id: string
  name: string
  /** Running total score across every game this session */
  score: number
  isHost: boolean
  connected: boolean
  /** Whether this player has pressed "Done" this round */
  hasDone: boolean
  /** Whether this player has cast their vote for the current voting round */
  hasVoted: boolean
  /** Voted out this game — now a spectator, cannot vote or be voted for */
  eliminated: boolean
  /** Which voting round this player was ejected in (0 = still in the game) */
  eliminatedInRound: number
  /** Points earned in the most recently finished game (0 until one finishes) */
  lastGamePoints: number
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
  /** Socket ID of the player who goes next (''  if the current player is last) */
  nextTurnPlayerId: string
  /** Turn order for this round, as an ordered list of player socket IDs */
  turnOrder: string[]
  /** Game number (increments each time the host starts a fresh word) */
  round: number
  /** Which voting round the current game is on (1-based; 0 before discussion) */
  voteRound: number
  /** Set once the current game has been decided; drives the reveal screen */
  gameOutcome: GameOutcome | null
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
 * only revealed to everyone together, once the game ends (see `GameResult`).
 */
export interface PlayerAssignment {
  role: PlayerRole
  /** Secret word for crewmates; null for imposters */
  word: string | null
  /**
   * Decoy word shown ONLY to the imposter — a word closely related to (but
   * never equal to) the real secret word, so the imposter has something
   * plausible to bluff with. `null` for crewmates, and `null` for the
   * imposter too if the current word list has no decoy for this word.
   */
  hint: string | null
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

/** Host removes a player who is currently offline (disconnected). */
export interface RemovePlayerPayload {
  roomCode: string
  /** Socket ID of the offline player to remove */
  targetPlayerId: string
}

/**
 * Client asks the server to re-send the authoritative game state (and the
 * caller's own private assignment). Powers the manual "Refresh" button plus
 * the periodic / tab-focus resync that keeps every client from drifting.
 * `playerName` lets the server fall back to a full rejoin if it no longer
 * recognises the socket (e.g. after a server restart).
 */
export interface RequestStatePayload {
  roomCode: string
  playerName: string
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
 * One completed voting round within a game: who was ejected (null on a tie that
 * ejected nobody), and how many votes each player received (ANONYMOUS — the
 * voter→target mapping is never sent to any client; a player only ever knows
 * their own vote). Every round is recorded, ties included, so the end-of-game
 * reveal shows each iteration.
 */
export interface VoteRoundRecord {
  voteRound: number
  /** null when the round was a tie and nobody was ejected */
  ejectedId: string | null
  /** null when the round was a tie and nobody was ejected */
  ejectedName: string | null
  wasImposter: boolean
  /** playerId → number of votes they received this round (no voter identities) */
  voteCounts: Record<string, number>
}

/**
 * Broadcast after every vote tally that ejects someone. If `gameOver` is true a
 * `game_result` event follows with the full picture. Carries no ballot data —
 * vote counts appear only on the final reveal.
 */
export interface EjectionResult {
  ejectedId: string
  ejectedName: string
  wasImposter: boolean
  voteRound: number
  /** Non-eliminated counts AFTER this ejection */
  remaining: { imposters: number; crew: number }
  gameOver: boolean
  outcome: GameOutcome | null
}

/** Per-player scoreline for a finished game. */
export interface GameScoreLine {
  playerId: string
  name: string
  /** Points earned this game */
  points: number
  /** Running session total (after this game) */
  total: number
  isImposter: boolean
  eliminatedInRound: number
  /**
   * Human-readable rows explaining how `points` was earned this game, e.g.
   * ["Spotted the imposter ×2  +2", "Survived to the end  +3"]. Empty when the
   * player scored nothing. Contains no voter→target information.
   */
  pointsBreakdown: string[]
}

/**
 * Broadcast once a game is decided (imposter ejected, or imposters reach parity).
 * Safe to reveal fully — the game is over.
 */
export interface GameResult {
  outcome: GameOutcome
  round: number
  word: string
  /** The decoy word the imposter(s) saw, or null if none. */
  imposterHint: string | null
  imposterNames: string[]
  voteHistory: VoteRoundRecord[]
  scores: GameScoreLine[]
}
