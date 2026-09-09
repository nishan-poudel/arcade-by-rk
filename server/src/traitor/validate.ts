/**
 * Extra runtime validators specific to the Traitor game. The generic ones
 * (`validateName`, `validateRoomCode`, `isObject`) are reused as-is from the
 * shared `security/validator.ts` — this file only adds what's new, so the
 * Imposter validator stays untouched.
 */
import { CATEGORIES } from './config.js'

interface Ok<T> { ok: true; value: T }
interface Err { ok: false; error: string }
type Result<T> = Ok<T> | Err

/** Emoji avatar chosen at join — 1–8 chars, no control characters. Falls back to a default. */
export function validateAvatar(raw: unknown): Result<string> {
  if (typeof raw !== 'string') {return { ok: true, value: '🕵️' }}
  const a = raw.trim()
  if (!a) {return { ok: true, value: '🕵️' }}
  // eslint-disable-next-line no-control-regex
  if (a.length > 8 || /[\x00-\x1F\x7F]/.test(a)) {
    return { ok: false, error: 'That avatar is not allowed.' }
  }
  return { ok: true, value: a }
}

/** Category must be one the loaded prompt bank actually has. */
export function validateCategory(raw: unknown): Result<string> {
  if (typeof raw === 'string' && CATEGORIES.includes(raw)) {return { ok: true, value: raw }}
  return { ok: false, error: 'Unknown question category.' }
}

/** Total rounds must be 3, 5 or 8. */
export function validateTotalRounds(raw: unknown): Result<3 | 5 | 8> {
  const n = Number(raw)
  if (n === 3 || n === 5 || n === 8) {return { ok: true, value: n }}
  return { ok: false, error: 'Rounds must be 3, 5 or 8.' }
}
