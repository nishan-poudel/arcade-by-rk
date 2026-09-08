/**
 * useSocket – manages the Socket.IO connection lifecycle.
 *
 * Returns a reactive socket instance.  The socket is created lazily
 * (first time useSocket() is called) and shared across all callers in
 * the same Vue app instance.
 */
import { io, type Socket } from 'socket.io-client'
import { shallowRef, ref } from 'vue'

/** Singleton socket (null until connect() is called) */
let socket: Socket | null = null

/** Reactive ref so components can watch for connection changes */
const connected = shallowRef(false)

/**
 * Coarse connection state for UI:
 *  - 'online'       – socket is connected
 *  - 'reconnecting' – lost the connection, socket.io is retrying
 *  - 'offline'      – never connected yet, or retries exhausted
 */
export type ConnectionState = 'online' | 'reconnecting' | 'offline'
const connectionState = ref<ConnectionState>('offline')

/** Create / return the singleton socket connected to the server */
export function useSocket() {
  if (!socket) {
    // In dev, the Vite proxy forwards '/socket.io' to localhost:3001 (same origin
    // from the browser's point of view). In production, the client and server
    // are often deployed to DIFFERENT domains (e.g. client on Vercel/Netlify,
    // server on Render/Railway) — in that case VITE_SOCKET_URL must be set to
    // the server's public URL, otherwise the socket would try to connect to the
    // static host and silently fail. Empty string = same-origin (dev default).
    const socketUrl = import.meta.env.VITE_SOCKET_URL || undefined

    socket = io(socketUrl, {
      // When running through Vite dev proxy the path is relative
      path: '/socket.io',
      autoConnect: false,
      reconnection: true,
      // Never give up — a party game may sit idle for a long time and phones
      // routinely suspend the socket. The manual "Refresh" button and the
      // periodic resync both also nudge this along.
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      // After the first successful websocket upgrade, reconnects go straight to
      // websocket instead of re-probing with HTTP polling — faster recovery.
      rememberUpgrade: true,
    })

    socket.on('connect', () => {
      connected.value = true
      connectionState.value = 'online'
    })

    socket.on('disconnect', (reason) => {
      connected.value = false
      // 'io server disconnect' / 'io client disconnect' are deliberate; anything
      // else means we dropped and socket.io will be retrying.
      connectionState.value =
        reason === 'io client disconnect' ? 'offline' : 'reconnecting'
    })

    // socket.io manager events – surfaced so the UI can show "Reconnecting…"
    socket.io.on('reconnect_attempt', () => {
      if (connectionState.value !== 'online') {connectionState.value = 'reconnecting'}
    })
    socket.io.on('reconnect', () => {
      connectionState.value = 'online'
    })
    socket.io.on('reconnect_failed', () => {
      connectionState.value = 'offline'
    })
    socket.io.on('error', () => {
      if (!connected.value) {connectionState.value = 'reconnecting'}
    })
  }

  /** Connect if not already connected */
  function connect() {
    if (socket && !socket.connected) {
      connectionState.value = 'reconnecting'
      socket.connect()
    }
  }

  /**
   * Force an immediate reconnect attempt — used by the manual "Refresh"
   * button so the user never has to hard-reload the page.
   */
  function reconnectNow() {
    if (!socket) {return}
    if (socket.connected) {return}
    // Reset the backoff and try right now.
    socket.connect()
  }

  /** Disconnect and destroy the socket (call on game leave / page unload) */
  function disconnect() {
    if (socket) {
      socket.disconnect()
      // Do NOT null the module singleton — connect() must be able to
      // call socket.connect() again if the user starts a new game.
      connected.value = false
      connectionState.value = 'offline'
    }
  }

  return {
    socket: socket as Socket,
    connected,
    connectionState,
    connect,
    reconnectNow,
    disconnect,
  }
}
