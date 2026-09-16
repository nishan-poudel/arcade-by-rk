import type { Env } from './env'
import { randomRoomCode, ROOM_CODE_PATTERN } from './roomSocket'

export { FarasRoom } from './FarasRoom'
export { GameRoom } from './GameRoom'
export { ScoreRoom } from './ScoreRoom'

type Mode = 'game' | 'score' | 'faras'

function modeFrom(value: string | null): Mode {
  if (value === 'score') return 'score'
  if (value === 'faras') return 'faras'
  return 'game'
}

function namespaceFor(env: Env, mode: Mode) {
  if (mode === 'score') return env.SCORE_ROOM
  if (mode === 'faras') return env.FARAS_ROOM
  return env.GAME_ROOM
}

// env.CORS_ALLOWED_ORIGINS is fixed for the Worker's lifetime — parse it
// into a Set once per distinct value instead of on every single request
// (every OPTIONS preflight, every /api/rooms POST, every /ws upgrade).
// Keyed by the raw string since `env` isn't available at module load time,
// so there's nothing to precompute ahead of the first request.
const allowedOriginsCache = new Map<string, ReadonlySet<string>>()
function parseAllowedOrigins(allowedOrigins: string): ReadonlySet<string> {
  let parsed = allowedOriginsCache.get(allowedOrigins)
  if (!parsed) {
    parsed = new Set(allowedOrigins.split(',').map((o) => o.trim()))
    allowedOriginsCache.set(allowedOrigins, parsed)
  }
  return parsed
}

function corsHeaders(origin: string | null, allowedOrigins: string): HeadersInit {
  const allowed = parseAllowedOrigins(allowedOrigins)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (origin && allowed.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers.Vary = 'Origin'
  }
  return headers
}

function json(data: unknown, headers: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}

/** Picks a room code with no existing room, retrying a few times against
 * genuine (astronomically unlikely) collisions before giving up. */
async function generateUniqueRoomCode(env: Env, mode: Mode): Promise<string> {
  const ns = namespaceFor(env, mode)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomRoomCode()
    const stub = ns.getByName(code)
    const res = await stub.fetch('http://internal/meta')
    const meta = (await res.json()) as { exists: boolean }
    if (!meta.exists) return code
  }
  return randomRoomCode()
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const cors = corsHeaders(origin, env.CORS_ALLOWED_ORIGINS)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors })
    }

    if (url.pathname === '/api/health') {
      return json({ ok: true }, cors)
    }

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { mode?: string }
      const mode = modeFrom(body.mode ?? null)
      const roomCode = await generateUniqueRoomCode(env, mode)
      return json({ roomCode }, cors)
    }

    if (url.pathname === '/ws') {
      const mode = modeFrom(url.searchParams.get('mode'))
      const roomCode = (url.searchParams.get('room') || '').toUpperCase()
      if (!ROOM_CODE_PATTERN.test(roomCode)) {
        return new Response('Invalid room code', { status: 400 })
      }
      const stub = namespaceFor(env, mode).getByName(roomCode)
      return stub.fetch(request)
    }

    return new Response('Not found', { status: 404, headers: cors })
  },
}
