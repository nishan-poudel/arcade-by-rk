/**
 * Hand-authored suit glyphs — built from simple primitives (circles + short
 * paths) rather than one intricate bezier string, so they render reliably
 * at any size. Shared viewBox: 0 0 24 24. No external card-asset library.
 */
import type { Suit } from '@callbreak/shared-logic'

export const SUIT_SYMBOL: Record<Suit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
}

export const SUIT_NAME: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
}

/** true for the two suits rendered in the "berry" red accent. */
export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D'
}

export function rankLabel(rank: number): string {
  if (rank === 14) return 'A'
  if (rank === 13) return 'K'
  if (rank === 12) return 'Q'
  if (rank === 11) return 'J'
  return String(rank)
}
