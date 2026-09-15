/**
 * Card face artwork comes from the htdebeer/SVG-cards sprite (LGPL-2.1, see
 * public/cards/CREDITS.md) rather than hand-drawn pips — a full classic
 * French deck, illustrated face cards included, referenced by symbol id via
 * SVG <use> so the whole deck is one small cached asset shared across every
 * card on screen.
 */
import type { Card, Suit } from '@callbreak/shared-logic'

export const CARD_SPRITE_URL = '/cards/svg-cards.svg'

/** The sprite's own coordinate system — used as the wrapping <svg>'s
 * viewBox so card artwork is never cropped or stretched. */
export const CARD_VIEWBOX = '0 0 169.075 244.640'
export const CARD_ASPECT = 169.075 / 244.64

const SUIT_IDS: Record<Suit, string> = {
  S: 'spade',
  H: 'heart',
  D: 'diamond',
  C: 'club',
}

function rankId(rank: number): string {
  if (rank === 14) return '1' // ace
  if (rank === 11) return 'jack'
  if (rank === 12) return 'queen'
  if (rank === 13) return 'king'
  return String(rank)
}

export function cardSymbolId(card: Card): string {
  return `${SUIT_IDS[card.suit]}_${rankId(card.rank)}`
}

export function cardSpriteHref(card: Card): string {
  return `${CARD_SPRITE_URL}#${cardSymbolId(card)}`
}

let prefetchStarted = false

/**
 * The sprite is otherwise only discovered by the browser when a card's
 * `<use>` first renders — i.e. once bidding starts, after join + waiting
 * for players. Call this as soon as the waiting room mounts instead, so the
 * ~330KB (gzipped) download overlaps with that already-dead waiting time
 * rather than blocking the first card paint. Safe to call more than once
 * (e.g. if the waiting room remounts) — only fires the request once.
 */
export function prefetchCardSprite(): void {
  if (prefetchStarted || typeof fetch !== 'function') return
  prefetchStarted = true
  fetch(CARD_SPRITE_URL, { priority: 'low' } as RequestInit).catch(() => {
    // A failed prefetch is just a missed optimization, not an error — the
    // normal <use> reference will fetch it again (and retry) when needed.
    prefetchStarted = false
  })
}
