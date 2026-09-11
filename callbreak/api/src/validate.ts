/**
 * Runtime input validation for all WebSocket messages.
 *
 * TypeScript types disappear at runtime — any JSON can arrive over the wire.
 * Ported from server/src/security/validator.ts (same ValidationResult shape)
 * so the pattern stays familiar across both backends.
 */
import type { Card, Suit } from '@callbreak/shared-logic'
import { MAX_CALL, MIN_CALL } from '@callbreak/shared-logic'

export const NAME_MIN_LEN = 1
export const NAME_MAX_LEN = 24
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/
export const ROUND_COUNTS = new Set([3, 5, 7])

interface ValidationOk<T> {
  ok: true
  value: T
}
interface ValidationErr {
  ok: false
  error: string
}
export type ValidationResult<T> = ValidationOk<T> | ValidationErr

const ok = <T>(value: T): ValidationOk<T> => ({ ok: true, value })
const err = (error: string): ValidationErr => ({ ok: false, error })

export function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

export function validateName(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return err('Name must be a string.')

  const name = raw.trim()
  if (name.length < NAME_MIN_LEN) return err('Name cannot be empty.')
  if (name.length > NAME_MAX_LEN) return err(`Name must be ${NAME_MAX_LEN} characters or fewer.`)
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(name)) return err('Name contains invalid characters.')

  return ok(name)
}

export function validateRoomCode(raw: unknown): ValidationResult<string> {
  if (typeof raw !== 'string') return err('Room code must be a string.')

  const code = raw.trim().toUpperCase()
  if (!ROOM_CODE_PATTERN.test(code)) return err('Room code must be 6 characters (letters and numbers).')

  return ok(code)
}

export function validateCall(raw: unknown): ValidationResult<number> {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < MIN_CALL || n > MAX_CALL) {
    return err(`Call must be an integer between ${MIN_CALL} and ${MAX_CALL}.`)
  }
  return ok(n)
}

export function validateTricksWon(raw: unknown): ValidationResult<number> {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 13) {
    return err('Tricks won must be an integer between 0 and 13.')
  }
  return ok(n)
}

export function validateRoundCount(raw: unknown): ValidationResult<3 | 5 | 7> {
  const n = Number(raw)
  if (!ROUND_COUNTS.has(n)) return err('Round count must be 3, 5, or 7.')
  return ok(n as 3 | 5 | 7)
}

const VALID_SUITS: ReadonlySet<string> = new Set(['S', 'H', 'D', 'C'])

export function validateCardShape(raw: unknown): ValidationResult<Card> {
  if (!isObject(raw)) return err('Card must be an object.')
  const { suit, rank } = raw
  if (typeof suit !== 'string' || !VALID_SUITS.has(suit)) return err('Card has an invalid suit.')
  if (typeof rank !== 'number' || !Number.isInteger(rank) || rank < 2 || rank > 14) {
    return err('Card has an invalid rank.')
  }
  return ok({ suit: suit as Suit, rank } as Card)
}
