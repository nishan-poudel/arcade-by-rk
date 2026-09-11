import type { Env } from './env'
import { randomRoomCode, ROOM_CODE_PATTERN } from './roomSocket'

export { GameRoom } from './GameRoom'
export { ScoreRoom } from './ScoreRoom'

type Mode = 'game' | 'score'

function modeFrom(value: string | null): Mode {
  return value === 'score' ? 'score' : 'game'
}

function namespaceFor(env: Env, mode: Mode) {
  return mode === 'score' ? env.SCORE_ROOM : env.GAME_ROOM
}

function corsHeaders(origin: string | null, allowedOrigins: string): HeadersInit {
  const allowed = allowedOrigins.split(',').map((o) => o.trim())
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
  if (origin && allowed.includes(origin)) {
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
