/**
 * Simple in-memory per-connection rate limiter, scoped to a single Durable
 * Object instance (one room). Ported from server/src/security/rateLimiter.ts;
 * no periodic purge timer here — a live `setInterval` would pin the Durable
 * Object in memory and defeat WebSocket hibernation, and a room only ever
 * has up to 4 connections, so unbounded growth isn't a real risk. Buckets
 * are cleaned up explicitly when a connection closes (see `cleanup`).
 */

interface Bucket {
  tokens: number
  windowStart: number
}

const GLOBAL_LIMIT = 120
const WINDOW_MS = 5_000
const BURST_PER_EVENT = 5

const BURST_OVERRIDES: Record<string, number> = {
  play_card: 15,
  request_state: 12,
  // The in-person score-keeper's host legitimately locks in 8 entries per
  // round (4 calls, then 4 tricks), round after round, all from one
  // connection — 5 would get them rate-limited partway through round 1.
  lock_call: 30,
  unlock_call: 15,
  lock_tricks: 30,
  unlock_tricks: 15,
}

export class RateLimiter {
  private readonly globalBuckets = new Map<string, Bucket>()
  private readonly eventBuckets = new Map<string, Bucket>()

  private bucket(map: Map<string, Bucket>, key: string): Bucket {
    const now = Date.now()
    let bucket = map.get(key)
    if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
      bucket = { tokens: 0, windowStart: now }
      map.set(key, bucket)
    }
    return bucket
  }

  /** Returns true if the connection may proceed with this event. */
  check(connectionId: string, eventName: string): boolean {
    const global = this.bucket(this.globalBuckets, connectionId)
    global.tokens++
    if (global.tokens > GLOBAL_LIMIT) return false

    const eventKey = `${connectionId}:${eventName}`
    const eventBucket = this.bucket(this.eventBuckets, eventKey)
    eventBucket.tokens++
    if (eventBucket.tokens > (BURST_OVERRIDES[eventName] ?? BURST_PER_EVENT)) return false

    return true
  }

  cleanup(connectionId: string): void {
    this.globalBuckets.delete(connectionId)
    for (const key of this.eventBuckets.keys()) {
      if (key.startsWith(`${connectionId}:`)) this.eventBuckets.delete(key)
    }
  }
}
