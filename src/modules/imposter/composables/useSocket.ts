/**
 * useSocket – manages the Socket.IO connection lifecycle.
 *
 * Returns a reactive socket instance.  The socket is created lazily
 * (first time useSocket() is called) and shared across all callers in
 * the same Vue app instance.
 */
import { io, Socket } from 'socket.io-client'
import { shallowRef } from 'vue'

/** Singleton socket (null until connect() is called) */
let socket: Socket | null = null

/** Reactive ref so components can watch for connection changes */
const connected = shallowRef(false)

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
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    })

    socket.on('connect', () => {
      connected.value = true
    })

    socket.on('disconnect', () => {
      connected.value = false
    })
  }

  /** Connect if not already connected */
  function connect() {
    if (socket && !socket.connected) socket.connect()
  }

  /** Disconnect and destroy the socket (call on game leave / page unload) */
  function disconnect() {
    if (socket) {
      socket.disconnect()
      // Do NOT null the module singleton — connect() must be able to
      // call socket.connect() again if the user starts a new game.
      connected.value = false
    }
  }

  return {
    socket: socket as Socket,
    connected,
    connect,
    disconnect,
  }
}
