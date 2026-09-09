/**
 * useKeepAlive – keeps the free-tier Render backend awake while anyone is in a
 * Traitor room. A dedicated copy of the Imposter module's keep-alive so the two
 * games' lifecycles never interfere (each has its own module-level singleton).
 *
 * See `src/modules/imposter/composables/useKeepAlive.ts` for the full rationale:
 * Render's free Web Service sleeps after ~15 min with no inbound HTTP (a live
 * WS ping/pong doesn't count), so every client hits `/api/health` every ~4 min
 * (with jitter) while it's in a room.
 */

const PING_BASE_MS = 4 * 60 * 1000
const PING_JITTER_MS = 20 * 1000

let timer: ReturnType<typeof setTimeout> | null = null
let running = false

function healthUrl(): string {
  const base = import.meta.env.VITE_SOCKET_URL || ''
  return `${base}/api/health`
}

async function ping() {
  try {
    await fetch(healthUrl(), { method: 'GET', cache: 'no-store' })
  } catch {
    // Not user-facing — the reconnect UI covers a genuinely-asleep server.
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
  function start() {
    if (running) {return}
    running = true
    void ping()
    scheduleNext()
  }

  function stop() {
    running = false
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  return { start, stop }
}
