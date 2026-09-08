/**
 * Re-exports all shared types for use inside the client.
 * Also adds any client-only types.
 */
export type {
  GamePhase,
  Difficulty,
  PlayerRole,
  GameOutcome,
  PublicPlayer,
  GameState,
  PlayerAssignment,
  VoteRoundRecord,
  EjectionResult,
  GameScoreLine,
  GameResult,
  CreateRoomPayload,
  JoinRoomPayload,
  SubmitVotePayload,
  RemovePlayerPayload,
  RequestStatePayload,
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
  | 'discussion'    // discussion + repeated voting rounds
  | 'reveal'        // game over: word + imposters + vote history + scores
  | 'over'          // whole session ended by the host

/** Stored in sessionStorage for reconnection */
export interface ReconnectInfo {
  roomCode: string
  playerName: string
  isHost: boolean
}
