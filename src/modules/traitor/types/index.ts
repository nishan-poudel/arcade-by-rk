/**
 * Re-exports the shared Traitor types for use inside the client, plus a few
 * client-only UI types. Mirrors `src/modules/imposter/types/index.ts`.
 */
export type {
  TraitorPhase,
  TraitorRole,
  RoundOutcome,
  TotalRounds,
  TraitorPublicPlayer,
  TraitorGameState,
  RoundAssignment,
  TraitorRoundResult,
  TraitorScoreLine,
  TraitorCreateRoomPayload,
  TraitorJoinRoomPayload,
  TraitorRejoinPayload,
  TraitorRequestStatePayload,
  TraitorSetCategoryPayload,
  TraitorSetTotalRoundsPayload,
  TraitorSubmitAnswerPayload,
  TraitorSubmitVotePayload,
  TraitorRemovePlayerPayload,
  TraitorRoomCreatedPayload,
  TraitorRoomJoinedPayload,
  TraitorStateSyncedPayload,
  TraitorErrorPayload,
  TraitorAnswerUpdatePayload,
  TraitorVoteUpdatePayload,
  TraitorCategoriesPayload,
} from '../../../../shared/types/traitor.js'

/** Which screen the client is showing. */
export type TraitorScreen =
  | 'landing' // create / join form
  | 'waiting' // lobby before the first round
  | 'answering' // pick a player as your answer
  | 'discussion' // pick board + talk it out + (host) open vote
  | 'voting' // cast your accusation vote
  | 'result' // round over: traitor + prompts + scores
  | 'over' // whole session ended

/** Stored in sessionStorage for reconnection. */
export interface TraitorReconnectInfo {
  roomCode: string
  playerName: string
  avatar: string
  isHost: boolean
}
