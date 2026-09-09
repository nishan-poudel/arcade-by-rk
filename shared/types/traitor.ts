/**
 * Shared TypeScript types for the **Traitor** game (the `/traitor` route +
 * the `/traitor` Socket.IO namespace). Kept entirely separate from the
 * Imposter game's `shared/types/index.ts` — nothing here is imported by the
 * Imposter code and vice-versa.
 *
 * Gameplay (adapted from findthetraitor.com for IN-PERSON play, the same way
 * the Imposter game adapts its genre):
 *  - One player is secretly the **Traitor**; everyone else is a **Detective**.
 *  - Detectives all receive the SAME question; the Traitor gets a DIFFERENT
 *    prompt and must blend in.
 *  - Everyone privately answers by **picking another player**. Picks are then
 *    revealed to the whole room at once.
 *  - The group discusses out loud, then everyone casts ONE accusation vote.
 *  - Unique top-voted player is the Traitor → Detectives win the round.
 *    Otherwise (tie / a Detective on top / no votes) → the Traitor wins.
 *  - Played over a fixed number of rounds; highest running score wins.
 */

// ─── Enums / Literals ────────────────────────────────────────────────────────

/** Phases a Traitor round can be in (server-authoritative). */
export type TraitorPhase =
  | 'lobby' // waiting room
  | 'answering' // everyone privately picks a player as their answer
  | 'discussion' // all picks shown; talk it out in person; host opens the vote
  | 'voting' // one locked accusation vote each
  | 'roundResult' // traitor + prompts revealed, points applied
  | 'ended' // whole session finished

/** Role for the current round. */
export type TraitorRole = 'detective' | 'traitor'

/** Who won a single round. */
export type RoundOutcome = 'detectives' | 'traitor'

/** How many rounds a session runs for (host picks in the lobby). */
export type TotalRounds = 3 | 5 | 8

// ─── Core entities ───────────────────────────────────────────────────────────

/** Public player info broadcast to every client. Never contains role/prompt. */
export interface TraitorPublicPlayer {
  id: string
  name: string
  /** Emoji avatar chosen at join — cosmetic only, never affects role. */
  avatar: string
  /** Running total score across the whole session. */
  score: number
  isHost: boolean
  connected: boolean
  /** Lobby: has this player tapped "Ready"? (host is always ready) */
  ready: boolean
  /** answering: has this player locked in their pick? (pick itself stays private) */
  hasAnswered: boolean
  /** voting: has this player cast their accusation vote? (ballot stays private) */
  hasVoted: boolean
  /** Points earned in the most recently finished round (0 until one finishes). */
  lastRoundPoints: number
}

/**
 * Full public game state, broadcast after any change. Carries NO secret info
 * (roles, prompts, ballots) — those go out privately / only at the reveal.
 */
export interface TraitorGameState {
  roomCode: string
  phase: TraitorPhase
  /** Question category the host picked in the lobby. */
  category: string
  /** Total rounds this session runs for. */
  totalRounds: TotalRounds
  /** 1-based number of the round in progress (0 in the lobby). */
  round: number
  players: TraitorPublicPlayer[]
  /**
   * discussion / voting / roundResult: each player's answer — who they picked.
   * `{}` while still answering. Public (the pick was never the secret).
   */
  picks: Record<string, string>
  /** Set once the current round is decided; drives the result screen. */
  roundOutcome: RoundOutcome | null
  hostId: string
}

/**
 * Private per-socket assignment. SECURITY: only ever contains the recipient's
 * OWN role + prompt — never anyone else's. The host is a normal player and can
 * be the Traitor, so their assignment is the same shape as everyone's.
 */
export interface RoundAssignment {
  role: TraitorRole
  /** The question this player must answer by picking someone. */
  prompt: string
}

/**
 * One completed round. Safe to reveal fully — the round is over. Vote data is
 * ANONYMOUS counts only; the voter→target mapping is never sent to any client.
 */
export interface TraitorRoundResult {
  round: number
  totalRounds: TotalRounds
  outcome: RoundOutcome
  traitorId: string
  traitorName: string
  /** The question the Detectives shared. */
  detectivePrompt: string
  /** The different prompt the Traitor had. */
  traitorPrompt: string
  /** Everyone's answer (who they picked). */
  picks: Record<string, string>
  /** playerId → accusation votes received (no voter identities). */
  voteCounts: Record<string, number>
  /** Per-player scoreline for this round. */
  scores: TraitorScoreLine[]
  /** True once this was the final round (session is now over). */
  sessionOver: boolean
}

/** Per-player scoreline for a finished round. */
export interface TraitorScoreLine {
  playerId: string
  name: string
  /** Points earned this round. */
  points: number
  /** Running session total after this round. */
  total: number
  wasTraitor: boolean
  /**
   * Human-readable rows explaining `points` (e.g. ["Fingered the Traitor  +2",
   * "Caught the Traitor  +3"]). Contains no voter→target information.
   */
  pointsBreakdown: string[]
}

// ─── Client → Server payloads ────────────────────────────────────────────────

export interface TraitorCreateRoomPayload {
  hostName: string
  avatar: string
  category: string
  totalRounds: TotalRounds
}

export interface TraitorJoinRoomPayload {
  roomCode: string
  playerName: string
  avatar: string
}

export interface TraitorRejoinPayload {
  roomCode: string
  playerName: string
}

/** Client asks for a fresh authoritative snapshot (+ its own assignment). */
export interface TraitorRequestStatePayload {
  roomCode: string
  playerName: string
}

export interface TraitorSetCategoryPayload {
  roomCode: string
  category: string
}

export interface TraitorSetTotalRoundsPayload {
  roomCode: string
  totalRounds: TotalRounds
}

/** answering: lock in my answer (which player I picked). */
export interface TraitorSubmitAnswerPayload {
  roomCode: string
  pickedPlayerId: string
}

/** voting: lock in my accusation vote. */
export interface TraitorSubmitVotePayload {
  roomCode: string
  votedPlayerId: string
}

/** Host removes a player who is currently offline. */
export interface TraitorRemovePlayerPayload {
  roomCode: string
  targetPlayerId: string
}

// ─── Server → Client payloads ────────────────────────────────────────────────

export interface TraitorRoomCreatedPayload {
  roomCode: string
  gameState: TraitorGameState
}

export interface TraitorRoomJoinedPayload {
  gameState: TraitorGameState
  assignment: RoundAssignment | null
}

export interface TraitorStateSyncedPayload {
  gameState: TraitorGameState
  assignment: RoundAssignment | null
  result: TraitorRoundResult | null
}

export interface TraitorErrorPayload {
  message: string
}

/** Broadcast during answering on each `submit_answer` — a tiny delta. */
export interface TraitorAnswerUpdatePayload {
  playerId: string
  answeredCount: number
  activeCount: number
}

/** Broadcast during voting on each `submit_vote` — a tiny delta. */
export interface TraitorVoteUpdatePayload {
  voterId: string
  votedCount: number
  activeCount: number
}

/** The categories available (sent so the client doesn't hard-code them). */
export interface TraitorCategoriesPayload {
  categories: string[]
}
