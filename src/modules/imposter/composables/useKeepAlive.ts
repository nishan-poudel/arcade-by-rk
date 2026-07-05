/**
 * useKeepAlive – lets the host keep a free-tier backend (e.g. Render) awake
 * during a long game.
 *
 * Render's free Web Service plan spins down after ~15 minutes without
 * inbound HTTP traffic, and waking it back up again takes 30-50s (see
 * `isSlowConnection` in useGame.ts). A live Socket.IO connection's own
 * ping/pong heartbeat is a raw TCP/WS frame, not a fresh HTTP request, so it
 * is not guaranteed to reset Render's inactivity timer — a room that sits in
 * a long discussion/voting phase can still have its server go to sleep out
 * from under an otherwise-open connection.
 *
 * This composable is an explicit, opt-in toggle (surfaced to the host) that
 * periodically hits the server's REST health endpoint — genuine inbound
 * HTTP traffic — to keep the free instance awake for the duration of the
 * game.
 *
 * State is a module-level singleton (matches the useSocket.ts / useGame.ts
 * pattern) so the toggle is shared across every screen that renders it
 * (WaitingRoom, HostScreen), and persisted to sessionStorage so it survives
 * a page refresh mid-game.
 */
import { ref } from 'vue'

const KEEP_ALIVE_KEY = 'imposter_keepalive'
/** Safely under Render's 15-min idle window, with margin for jitter/backoff. */
const PING_INTERVAL_MS = 4 * 60 * 1000

const enabled = ref(sessionStorage.getItem(KEEP_ALIVE_KEY) === 'on')
const lastPingAt = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

/**
 * Resolve the server's health endpoint the same way useSocket.ts resolves
 * the Socket.IO server: VITE_SOCKET_URL when set (client and server are on
 * different domains in prod), otherwise a relative path so the Vite dev
 * proxy (or same-origin prod deploy) forwards it correctly.
 */
function healthUrl(): string {
  const base = import.meta.env.VITE_SOCKET_URL || ''
  return `${base}/api/health`
}

async function ping() {
  try {
    await fetch(healthUrl(), { method: 'GET', cache: 'no-store' })
    lastPingAt.value = Date.now()
  } catch {
    // Silently ignore — a failed keep-alive ping isn't user-facing.
    // If the server is genuinely asleep, the existing reconnect /
    // slow-connection UI already covers the next real socket action.
  }
}

function startTimer() {
  if (timer) {return}
  timer = setInterval(ping, PING_INTERVAL_MS)
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

export function useKeepAlive() {
  // Resume automatically if a previous screen (or a previous page load,
  // via sessionStorage) already turned this on.
  if (enabled.value) {startTimer()}

  function enable() {
    if (!enabled.value) {
      enabled.value = true
      sessionStorage.setItem(KEEP_ALIVE_KEY, 'on')
      ping()
    }
    startTimer()
  }

  function disable() {
    enabled.value = false
    sessionStorage.setItem(KEEP_ALIVE_KEY, 'off')
    stopTimer()
  }

  function toggle() {
    if (enabled.value) {disable()} else {enable()}
  }

  return { enabled, lastPingAt, enable, disable, toggle }
}
