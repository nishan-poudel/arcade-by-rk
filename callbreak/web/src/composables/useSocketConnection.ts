/**
 * Low-level WebSocket transport shared by the online game and the in-person
 * score-keeper. Both talk to the same Cloudflare Worker (`callbreak/api`) —
 * this only handles connect/reconnect/send/subscribe; all game-specific
 * state and message handling lives in each module's own composable.
 *
 * Native WebSocket has no built-in reconnection (unlike socket.io-client),
 * so this implements a small manual backoff loop. Workers/Durable Objects
 * never sleep the way a free Render web service does, so there's no cold-
 * start delay to ride out on reconnect — just ordinary network hiccups.
 */
import { ref } from 'vue'

export type ConnectionState = 'online' | 'reconnecting' | 'offline'
export type RoomMode = 'game' | 'score'

export interface InboundMessage {
  type: string
  payload: unknown
}

const RECONNECT_DELAYS_MS = [1000, 1500, 2500, 4000, 5000]

function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_CALLBREAK_API_URL as string | undefined
  if (configured) return configured
  // Same-origin fallback (e.g. if the API is ever proxied behind the web Worker).
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
}

export function createRoomConnection(mode: RoomMode) {
  const connectionState = ref<ConnectionState>('offline')
  const listeners = new Set<(msg: InboundMessage) => void>()

  let ws: WebSocket | null = null
  let roomCode: string | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let intentionalClose = false
  // A caller's very first `send()` (e.g. 'join' right after `connect()`) can
  // land before the WebSocket finishes its handshake — buffer sends made
  // while CONNECTING and flush them once 'open' fires, instead of silently
  // dropping them.
  let sendQueue: string[] = []

  function clearReconnectTimer() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function scheduleReconnect() {
    if (intentionalClose || !roomCode) return
    connectionState.value = 'reconnecting'
    const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
    reconnectAttempt++
    clearReconnectTimer()
    reconnectTimer = setTimeout(() => {
      if (roomCode) openSocket(roomCode)
    }, delay)
  }

  function openSocket(code: string) {
    intentionalClose = false
    const url = `${apiBaseUrl()}/ws?room=${encodeURIComponent(code)}&mode=${mode}`
    const socket = new WebSocket(url)

    socket.addEventListener('open', () => {
      reconnectAttempt = 0
      connectionState.value = 'online'
      const queued = sendQueue
      sendQueue = []
      for (const payload of queued) socket.send(payload)
    })

    socket.addEventListener('message', (event) => {
      let msg: InboundMessage
      try {
        msg = JSON.parse(event.data as string)
      } catch {
        return
      }
      for (const listener of listeners) listener(msg)
    })

    socket.addEventListener('close', () => {
      if (ws === socket) ws = null
      if (!intentionalClose) scheduleReconnect()
    })

    socket.addEventListener('error', () => {
      socket.close()
    })

    ws = socket
  }

  function connect(code: string) {
    roomCode = code
    reconnectAttempt = 0
    sendQueue = []
    openSocket(code)
  }

  function disconnect() {
    intentionalClose = true
    roomCode = null
    clearReconnectTimer()
    sendQueue = []
    ws?.close()
    ws = null
    connectionState.value = 'offline'
  }

  function send(type: string, payload?: unknown): void {
    const data = JSON.stringify({ type, payload })
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(data)
    } else if (ws?.readyState === WebSocket.CONNECTING) {
      sendQueue.push(data)
    }
    // No socket at all, or CLOSING/CLOSED: nothing to buffer into — the
    // caller only ever sends after connect(), and a fresh connect() clears
    // any stale queue anyway.
  }

  function subscribe(handler: (msg: InboundMessage) => void): () => void {
    listeners.add(handler)
    return () => listeners.delete(handler)
  }

  return { connectionState, connect, disconnect, send, subscribe }
}

export async function createRoomOnServer(mode: RoomMode): Promise<string> {
  const res = await fetch(`${apiBaseUrl().replace(/^ws/, 'http')}/api/rooms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  })
  if (!res.ok) throw new Error('Could not reach the server — try again.')
  const data = (await res.json()) as { roomCode: string }
  return data.roomCode
}
