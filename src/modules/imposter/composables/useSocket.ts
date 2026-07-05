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
    socket = io({
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
