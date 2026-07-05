/**
 * Re-exports all shared types for use inside the client.
 * Also adds any client-only types.
 */
export type {
  GamePhase,
  Difficulty,
  PlayerRole,
  PublicPlayer,
  GameState,
  PlayerAssignment,
  GameReveal,
  CreateRoomPayload,
  JoinRoomPayload,
  SubmitVotePayload,
  SetDifficultyPayload,
  SetImposterCountPayload,
  RejoinPayload,
  RoomCreatedPayload,
  RoomJoinedPayload,
  ErrorPayload,
} from '../../../../shared/types/index.js'

/** Local UI state for which screen is shown */
export type AppScreen =
  | 'landing'       // create / join form
  | 'waiting'       // lobby before game starts
  | 'game'          // in-game (player or host)
  | 'discussion'    // all-done discussion phase
  | 'reveal'        // post-round reveal: word + imposters shown to all
  | 'over'          // game ended

/** Stored in sessionStorage for reconnection */
export interface ReconnectInfo {
  roomCode: string
  playerName: string
  isHost: boolean
}
