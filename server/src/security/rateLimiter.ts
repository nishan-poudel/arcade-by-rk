/**
 * Simple in-memory per-socket rate limiter.
 *
 * Uses a sliding-window (token bucket) approach per socket ID.
 * When a socket exceeds the allowed events-per-window it gets
 * blocked for the remainder of that window.
 *
 * This is intentionally dependency-free; add Redis-backed limiting
 * if you scale to multiple server instances.
 */

interface Bucket {
  tokens: number
  windowStart: number
}

// ─── Configuration ────────────────────────────────────────────────────────────

/** Maximum events allowed per socket within the window (per event name) */
const GLOBAL_LIMIT = 30          // total events per window
const WINDOW_MS    = 5_000       // 5-second sliding window
const BURST_PER_EVENT = 5        // max rapid-fire for a single event type

// ─── State ────────────────────────────────────────────────────────────────────

/** Global bucket per socket: tracks total event count */
const globalBuckets = new Map<string, Bucket>()

/** Per-event bucket: tracks count per (socketId + eventName) */
const eventBuckets  = new Map<string, Bucket>()

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBucket(map: Map<string, Bucket>, key: string): Bucket {
  const now = Date.now()
  let bucket = map.get(key)

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    // Start a fresh window
    bucket = { tokens: 0, windowStart: now }
    map.set(key, bucket)
  }

  return bucket
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether a socket is allowed to send an event.
 * Returns `true`  → allow the event.
 * Returns `false` → rate limit exceeded; caller should emit an error and return.
 */
export function checkRateLimit(socketId: string, eventName: string): boolean {
  // --- Global per-socket limit ------------------------------------------
  const global = getBucket(globalBuckets, socketId)
  global.tokens++
  if (global.tokens > GLOBAL_LIMIT) return false

  // --- Per-event limit --------------------------------------------------
  const eventKey = `${socketId}:${eventName}`
  const evBucket = getBucket(eventBuckets, eventKey)
  evBucket.tokens++
  if (evBucket.tokens > BURST_PER_EVENT) return false

  return true
}

/**
 * Clean up all buckets for a socket after it disconnects.
 * Call this in the `disconnect` handler to prevent memory growth.
 */
export function cleanupSocket(socketId: string): void {
  globalBuckets.delete(socketId)

  // Remove all per-event keys for this socket
  for (const key of eventBuckets.keys()) {
    if (key.startsWith(`${socketId}:`)) {
      eventBuckets.delete(key)
    }
  }
}

/**
 * Periodically purge expired buckets to prevent unbounded memory growth.
 * Call once at startup; the interval handles itself.
 */
export function startBucketPurge(): void {
  setInterval(() => {
    const now = Date.now()
    const stale = (b: Bucket) => now - b.windowStart >= WINDOW_MS * 2

    for (const [k, v] of globalBuckets) if (stale(v)) globalBuckets.delete(k)
    for (const [k, v] of eventBuckets)  if (stale(v)) eventBuckets.delete(k)
  }, WINDOW_MS * 4) // purge every 4 windows
}
