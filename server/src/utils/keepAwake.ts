/**
 * Self-ping keep-alive for free hosting tiers (Render, etc.).
 *
 * Render's free Web Service spins down after ~15 min with no inbound *HTTP*
 * traffic (a live WebSocket ping/pong does NOT count). The clients each hit
 * `/api/health` on a timer while they're in a room, but mobile browsers heavily
 * throttle — or fully freeze — background timers, so a room sitting in a long
 * discussion with everyone's phone locked can still have the server go to sleep
 * out from under it. When that happens every socket drops and, because rooms are
 * in-memory, the games are gone for good.
 *
 * This makes the server keep *itself* awake: while at least one room is active
 * it GETs its own public `/api/health` every SELF_PING_INTERVAL_MS. The request
 * leaves the instance, hits the platform edge and comes back as genuine inbound
 * HTTP, resetting the idle timer. It does NOT depend on any client's timer
 * surviving a screen-lock.
 *
 * When no rooms are active it pings nothing, so the instance is still allowed to
 * sleep between sessions and free instance-hours aren't burned 24/7.
 *
 * Enabled only when a public URL is known:
 *   - RENDER_EXTERNAL_URL  – injected automatically by Render for web services
 *   - SELF_PING_URL        – explicit override (any host)
 * Disable regardless with KEEP_AWAKE=false. Tune with SELF_PING_INTERVAL_MS.
 */
import { logger } from './logger.js'

const DEFAULT_INTERVAL_MS = 10 * 60_000 // 10 min — safely under Render's 15 min
const JITTER_FRACTION = 0.15 // ±15% so N instances (or a monitor) don't line up

function resolveUrl(): string | null {
  if (process.env.KEEP_AWAKE === 'false') {return null}
  const explicit = process.env.SELF_PING_URL?.trim()
  if (explicit) {return explicit.replace(/\/$/, '') + '/api/health'}
  const render = process.env.RENDER_EXTERNAL_URL?.trim()
  if (render) {return render.replace(/\/$/, '') + '/api/health'}
  return null
}

/**
 * Start the self-ping loop.
 *
 * @param hasActiveRooms  called each tick; return true if any game currently
 *   has a live room (the loop only pings when this is true).
 */
export function startKeepAwake(hasActiveRooms: () => boolean): void {
  const url = resolveUrl()
  if (!url) {
    logger.info('Self-ping keep-alive disabled (no RENDER_EXTERNAL_URL / SELF_PING_URL)')
    return
  }

  const base = Number(process.env.SELF_PING_INTERVAL_MS) || DEFAULT_INTERVAL_MS

  logger.info('Self-ping keep-alive enabled', { url, intervalMs: base })

  const tick = async () => {
    if (hasActiveRooms()) {
      try {
        const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) })
        logger.debug('Self-ping ok', { status: res.status })
      } catch (err) {
        logger.warn('Self-ping failed', { err: String(err) })
      }
    }
    schedule()
  }

  const schedule = () => {
    const delay = base * (1 + (Math.random() * 2 - 1) * JITTER_FRACTION)
    setTimeout(() => void tick(), delay).unref()
  }

  schedule()
}
