/**
 * useTraitorSocket – manages the Socket.IO connection to the `/traitor`
 * namespace. A separate singleton from the Imposter module's `useSocket` so the
 * two games hold independent connections.
 *
 * Mirrors `src/modules/imposter/composables/useSocket.ts`.
 */
import { io, type Socket } from 'socket.io-client'
import { shallowRef, ref } from 'vue'

let socket: Socket | null = null

const connected = shallowRef(false)

export type ConnectionState = 'online' | 'reconnecting' | 'offline'
const connectionState = ref<ConnectionState>('offline')

/** Resolve the namespaced URL the same way the Imposter socket resolves its base. */
function traitorUrl(): string {
  const base = import.meta.env.VITE_SOCKET_URL
  // No base = same-origin (dev via the Vite proxy): a leading-slash string is
  // treated by socket.io-client as a namespace on the current origin.
  return base ? `${base}/traitor` : '/traitor'
}

export function useTraitorSocket() {
  if (!socket) {
    socket = io(traitorUrl(), {
      path: '/socket.io',
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      timeout: 20000,
      rememberUpgrade: true,
    })

    socket.on('connect', () => {
      connected.value = true
      connectionState.value = 'online'
    })

    socket.on('disconnect', (reason) => {
      connected.value = false
      connectionState.value = reason === 'io client disconnect' ? 'offline' : 'reconnecting'
    })

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

  function connect() {
    if (socket && !socket.connected) {
      connectionState.value = 'reconnecting'
      socket.connect()
    }
  }

  function reconnectNow() {
    if (!socket || socket.connected) {return}
    socket.connect()
  }

  function disconnect() {
    if (socket) {
      socket.disconnect()
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
