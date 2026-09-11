import type { Card, Suit, TrickPlay } from './types'

/**
 * Which cards in `hand` are legal to play next, given the cards already
 * played this trick (in play order; empty if this player is leading).
 *
 * Call Break's defining rule vs. plain whist: a player void in the suit led
 * MUST play a spade if they hold one. Only a player holding neither the led
 * suit nor any spade may discard freely.
 */
export function legalPlays(hand: readonly Card[], trickSoFar: readonly Card[]): Card[] {
  if (trickSoFar.length === 0) {
    // Leading the trick: any card, including spades (no "broken" restriction
    // in Call Break — spades are always trump and may be led anytime).
    return hand.slice()
  }

  const ledSuit = trickSoFar[0].suit
  const ofLedSuit = hand.filter((c) => c.suit === ledSuit)
  if (ofLedSuit.length > 0) {
    return ofLedSuit
  }

  const spades = hand.filter((c) => c.suit === 'S')
  if (spades.length > 0) {
    return spades
  }

  return hand.slice()
}

export function isLegalPlay(hand: readonly Card[], trickSoFar: readonly Card[], card: Card): boolean {
  return legalPlays(hand, trickSoFar).some((c) => c.suit === card.suit && c.rank === card.rank)
}

/**
 * Resolves a completed 4-card trick to the winning seat. Highest spade wins
 * if any spades were played; otherwise highest card of the suit led.
 */
export function resolveTrickWinner(plays: readonly TrickPlay[]): number {
  if (plays.length === 0) {
    throw new Error('Cannot resolve an empty trick')
  }

  const ledSuit: Suit = plays[0].card.suit
  const spadesPlayed = plays.filter((p) => p.card.suit === 'S')
  const contest = spadesPlayed.length > 0 ? spadesPlayed : plays.filter((p) => p.card.suit === ledSuit)

  return contest.reduce((best, p) => (p.card.rank > best.card.rank ? p : best)).seat
}
