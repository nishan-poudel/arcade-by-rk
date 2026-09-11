/**
 * Small, dependency-free helpers shared by GameRoom and ScoreRoom: message
 * envelope send/parse and room-code generation. Both Durable Object classes
 * use the WebSocket Hibernation API directly (`ctx.acceptWebSocket`,
 * `webSocketMessage`/`webSocketClose`) — this file has no DO-specific state,
 * just the wire format.
 */

export interface InboundMessage {
  type: string
  payload: unknown
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O, 1/I/L)
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/

export function randomRoomCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}

export function send(ws: WebSocket, type: string, payload: unknown): void {
  try {
    ws.send(JSON.stringify({ type, payload }))
  } catch {
    // Socket already closed/closing — nothing to do.
  }
}

export function sendError(ws: WebSocket, message: string): void {
  send(ws, 'error', { message })
}

export function parseMessage(data: string | ArrayBuffer): InboundMessage | null {
  if (typeof data !== 'string') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(data)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
  const { type, payload } = parsed as Record<string, unknown>
  if (typeof type !== 'string') return null
  return { type, payload }
}
