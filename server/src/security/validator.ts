/**
 * Runtime input validation for all socket payloads.
 *
 * TypeScript types disappear at runtime – any JSON can arrive over the wire.
 * This module validates and sanitises all incoming data before the game
 * logic ever touches it.
 */
import type { Difficulty } from '../../../shared/types/index.js'

// ─── Constants ────────────────────────────────────────────────────────────────

export const VALID_DIFFICULTIES: ReadonlySet<string> = new Set(['easy', 'medium', 'hard'])
export const NAME_MIN_LEN = 1
export const NAME_MAX_LEN = 24
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/
export const IMPOSTER_COUNT_MIN = 1
export const IMPOSTER_COUNT_MAX = 4

// ─── Result type ─────────────────────────────────────────────────────────────

interface ValidationOk<T> {
  ok: true
  value: T
}
interface ValidationErr {
  ok: false
  error: string
}
type ValidationResult<T> = ValidationOk<T> | ValidationErr

// ─── Validators ───────────────────────────────────────────────────────────────

/**
 * Validate and sanitise a player/host name.
 * Strips surrounding whitespace; rejects empty strings and names that are
 * too long or contain control characters.
 */
export function validateName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'Name must be a string.' }

  const name = raw.trim()
  if (name.length < NAME_MIN_LEN) return { ok: false, error: 'Name cannot be empty.' }
  if (name.length > NAME_MAX_LEN)
    return { ok: false, error: `Name must be ${NAME_MAX_LEN} characters or fewer.` }

  // Reject control characters (tab, newline, etc.)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(name))
    return { ok: false, error: 'Name contains invalid characters.' }

  return { ok: true, value: name }
}

/**
 * Validate a room code.
 * Must be exactly 6 uppercase alphanumeric characters.
 */
export function validateRoomCode(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'Room code must be a string.' }

  const code = raw.trim().toUpperCase()
  if (!ROOM_CODE_PATTERN.test(code))
    return { ok: false, error: 'Room code must be 6 characters (letters and numbers).' }

  return { ok: true, value: code }
}

/**
 * Validate a difficulty value.
 * Must be one of the known difficulty strings.
 */
export function validateDifficulty(raw: unknown): ValidationResult<Difficulty> {
  if (typeof raw !== 'string' || !VALID_DIFFICULTIES.has(raw))
    return { ok: false, error: 'Difficulty must be "easy", "medium", or "hard".' }

  return { ok: true, value: raw as Difficulty }
}

/**
 * Validate an imposter count.
 * Must be an integer within [IMPOSTER_COUNT_MIN, IMPOSTER_COUNT_MAX].
 */
export function validateImposterCount(raw: unknown): ValidationResult<number> {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < IMPOSTER_COUNT_MIN || n > IMPOSTER_COUNT_MAX)
    return {
      ok: false,
      error: `Imposter count must be an integer between ${IMPOSTER_COUNT_MIN} and ${IMPOSTER_COUNT_MAX}.`,
    }

  return { ok: true, value: n }
}

/**
 * Guard that the payload is a plain object (not null, array, or primitive).
 * Prevents crashes when a client sends a malformed event.
 */
export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}
