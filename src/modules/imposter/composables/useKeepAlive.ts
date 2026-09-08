/**
 * useKeepAlive – keeps the free-tier backend (Render) awake while anyone is in a
 * room.
 *
 * Render's free Web Service spins down after ~15 minutes with no inbound *HTTP*
 * traffic, and waking it back up takes 30-50s. A live Socket.IO connection's own
 * ping/pong is a raw WS frame, not a fresh HTTP request, so it does NOT reset
 * Render's inactivity timer — a room sitting in a long discussion can still have
 * the server go to sleep out from under an open connection.
 *
 * So: every client, whenever it's in a room, hits the REST health endpoint —
 * genuine inbound HTTP — every ~4 minutes (with jitter so N clients don't
 * stampede). No opt-in, no UI: it just runs while you're playing and stops when
 * you leave. Between sessions (nobody in a room) the server is allowed to sleep.
 *
 * Module-level singleton (matches useSocket.ts / useGame.ts): started/stopped
 * from useGame's room lifecycle.
 */

/** ~4 min base, well under Render's 15-min idle window; ±20s jitter added per tick. */
const PING_BASE_MS = 4 * 60 * 1000
const PING_JITTER_MS = 20 * 1000

let timer: ReturnType<typeof setTimeout> | null = null
let running = false

/**
 * Resolve the health endpoint the same way useSocket.ts resolves the Socket.IO
 * server: VITE_SOCKET_URL when the client and server are on different domains,
 * otherwise a relative path (Vite dev proxy / same-origin prod).
 */
function healthUrl(): string {
  const base = import.meta.env.VITE_SOCKET_URL || ''
  return `${base}/api/health`
}

async function ping() {
  try {
    await fetch(healthUrl(), { method: 'GET', cache: 'no-store' })
  } catch {
    // A failed keep-alive ping isn't user-facing — if the server is genuinely
    // asleep, the reconnect / slow-connection UI covers the next real action.
  }
}

function scheduleNext() {
  if (!running) {return}
  const delay = PING_BASE_MS + (Math.random() * 2 - 1) * PING_JITTER_MS
  timer = setTimeout(async () => {
    await ping()
    scheduleNext()
  }, delay)
}

export function useKeepAlive() {
  /** Begin pinging (idempotent). Call when confirmed in a room. */
  function start() {
    if (running) {return}
    running = true
    void ping() // nudge the server awake right away
    scheduleNext()
  }

  /** Stop pinging. Call on leave / game end. */
  function stop() {
    running = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { start, stop }
}
