import { buildDeck, shuffle } from './deck'
import type { Card } from './types'

/**
 * Faras (Teen Patti) hand ranking and dealing. Independent of the trick-
 * taking engine in deck.ts/trick.ts/scoring.ts — reuses buildDeck/shuffle
 * only, since a Faras hand is 3 cards to 2-10 players rather than 13 cards
 * to exactly 4.
 */

export const FARAS_MIN_PLAYERS = 2
export const FARAS_MAX_PLAYERS = 10
export const FARAS_CARDS_PER_HAND = 3

export type FarasCategory = 'trail' | 'pureSequence' | 'sequence' | 'color' | 'pair' | 'highCard'

/** Higher number beats lower, regardless of the `ranks` tie-break values. */
const CATEGORY_ORDER: Record<FarasCategory, number> = {
  highCard: 0,
  pair: 1,
  color: 2,
  sequence: 3,
  pureSequence: 4,
  trail: 5,
}

export interface FarasHandRank {
  category: FarasCategory
  /** Tie-break values, most significant first. For 'pair': [pairRank,
   * kicker]. For everything else: the relevant rank(s) descending — a
   * single value for trail/sequence/pureSequence, three for color/highCard. */
  ranks: number[]
}

/**
 * Teen Patti's one wraparound rule: A-2-3 is the single highest sequence,
 * above even K-Q-A — the opposite of poker's low-ace "wheel". Returns a
 * comparable value (not a real card rank) or null if not consecutive.
 * `sortedAsc` must be exactly 3 ranks, ascending.
 */
function sequenceValue(sortedAsc: readonly number[]): number | null {
  const [a, b, c] = sortedAsc
  if (a === 2 && b === 3 && c === 14) return 15
  if (b === a + 1 && c === b + 1) return c
  return null
}

export function rankFarasHand(cards: readonly [Card, Card, Card]): FarasHandRank {
  const asc = cards.map((c) => c.rank).sort((a, b) => a - b)
  const desc = [...asc].sort((a, b) => b - a)
  const sameSuit = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit
  const isTrail = asc[0] === asc[1] && asc[1] === asc[2]
  const seqValue = sequenceValue(asc)

  if (isTrail) return { category: 'trail', ranks: [asc[0]] }
  if (seqValue !== null) return { category: sameSuit ? 'pureSequence' : 'sequence', ranks: [seqValue] }
  if (sameSuit) return { category: 'color', ranks: desc }

  if (asc[0] === asc[1] || asc[1] === asc[2]) {
    const pairRank = asc[0] === asc[1] ? asc[0] : asc[1]
    const kicker = asc[0] === asc[1] ? asc[2] : asc[0]
    return { category: 'pair', ranks: [pairRank, kicker] }
  }

  return { category: 'highCard', ranks: desc }
}

/** >0 if `a` beats `b`, <0 if `b` beats `a`, 0 for a genuine tie (rare but
 * possible — e.g. two players each holding a pair of the same rank with
 * different-suit kickers of the same rank too). */
export function compareFarasHands(a: readonly [Card, Card, Card], b: readonly [Card, Card, Card]): number {
  const rankA = rankFarasHand(a)
  const rankB = rankFarasHand(b)
  const categoryDiff = CATEGORY_ORDER[rankA.category] - CATEGORY_ORDER[rankB.category]
  if (categoryDiff !== 0) return categoryDiff
  const len = Math.max(rankA.ranks.length, rankB.ranks.length)
  for (let i = 0; i < len; i++) {
    const diff = (rankA.ranks[i] ?? 0) - (rankB.ranks[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Deals a fresh shuffled deck 3 cards at a time to `playerCount` players
 * (2-10). Throws outside that range. */
export function dealFaras(playerCount: number, rng: () => number = Math.random): Card[][] {
  if (!Number.isInteger(playerCount) || playerCount < FARAS_MIN_PLAYERS || playerCount > FARAS_MAX_PLAYERS) {
    throw new Error(`Faras needs between ${FARAS_MIN_PLAYERS} and ${FARAS_MAX_PLAYERS} players, got ${playerCount}`)
  }
  const deck = shuffle(buildDeck(), rng)
  const hands: Card[][] = Array.from({ length: playerCount }, () => [])
  for (let i = 0; i < playerCount * FARAS_CARDS_PER_HAND; i++) {
    hands[i % playerCount].push(deck[i])
  }
  return hands
}
