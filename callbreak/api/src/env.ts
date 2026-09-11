import type { GameRoom } from './GameRoom'
import type { ScoreRoom } from './ScoreRoom'

export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>
  SCORE_ROOM: DurableObjectNamespace<ScoreRoom>
  CORS_ALLOWED_ORIGINS: string
  ENVIRONMENT: string
}
