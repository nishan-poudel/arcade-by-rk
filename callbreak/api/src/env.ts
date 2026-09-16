import type { FarasRoom } from './FarasRoom'
import type { GameRoom } from './GameRoom'
import type { ScoreRoom } from './ScoreRoom'

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>
  SCORE_ROOM: DurableObjectNamespace<ScoreRoom>
  FARAS_ROOM: DurableObjectNamespace<FarasRoom>
  CORS_ALLOWED_ORIGINS: string
  ENVIRONMENT: string
}
