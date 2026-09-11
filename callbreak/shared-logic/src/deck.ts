import { CARDS_PER_HAND, type Card, RANKS, SEATS, SUITS } from './types'

/** Builds a standard 52-card deck in a fixed, deterministic order. */
export function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank })
    }
  }
  return deck
}

/**
 * Fisher-Yates shuffle. `rng` defaults to Math.random but accepts an
 * injected generator so tests/replays can be deterministic.
 */
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Splits a shuffled 52-card deck into 4 hands of 13, seat 0..3 in order. */
export function dealHands(shuffledDeck: readonly Card[]): Card[][] {
  if (shuffledDeck.length !== CARDS_PER_HAND * SEATS) {
    throw new Error(`Expected a full ${CARDS_PER_HAND * SEATS}-card deck, got ${shuffledDeck.length}`)
  }
  const hands: Card[][] = Array.from({ length: SEATS }, () => [])
  shuffledDeck.forEach((card, i) => {
    hands[i % SEATS].push(card)
  })
  return hands
}

/** Deals a freshly shuffled deck into 4 hands in one call. */
export function dealNewRound(rng: () => number = Math.random): Card[][] {
  return dealHands(shuffle(buildDeck(), rng))
}
