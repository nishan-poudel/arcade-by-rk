import { describe, expect, it } from 'vitest'
import { compareFarasHands, dealFaras, FARAS_CARDS_PER_HAND, rankFarasHand } from './farasHand'
import type { Card, Suit } from './types'

function c(suit: Suit, rank: Card['rank']): Card {
  return { suit, rank }
}

describe('rankFarasHand', () => {
  it('recognizes a trail (three of a kind)', () => {
    expect(rankFarasHand([c('S', 7), c('H', 7), c('D', 7)]).category).toBe('trail')
  })

  it('recognizes a pure sequence (consecutive, same suit)', () => {
    expect(rankFarasHand([c('S', 5), c('S', 6), c('S', 7)]).category).toBe('pureSequence')
  })

  it('treats A-2-3 as the highest sequence, same suit counts as pure', () => {
    const rank = rankFarasHand([c('S', 14), c('S', 2), c('S', 3)])
    expect(rank.category).toBe('pureSequence')
    expect(rank.ranks[0]).toBeGreaterThan(rankFarasHand([c('S', 12), c('S', 13), c('S', 14)]).ranks[0])
  })

  it('recognizes a sequence (consecutive, mixed suits)', () => {
    expect(rankFarasHand([c('S', 5), c('H', 6), c('D', 7)]).category).toBe('sequence')
  })

  it('recognizes a color (same suit, not consecutive)', () => {
    expect(rankFarasHand([c('S', 2), c('S', 6), c('S', 11)]).category).toBe('color')
  })

  it('recognizes a pair with a kicker', () => {
    const rank = rankFarasHand([c('S', 9), c('H', 9), c('D', 4)])
    expect(rank.category).toBe('pair')
    expect(rank.ranks).toEqual([9, 4])
  })

  it('falls back to high card', () => {
    const rank = rankFarasHand([c('S', 2), c('H', 9), c('D', 13)])
    expect(rank.category).toBe('highCard')
    expect(rank.ranks).toEqual([13, 9, 2])
  })
})

describe('compareFarasHands', () => {
  it('ranks trail above pure sequence above sequence above color above pair above high card', () => {
    const trail: [Card, Card, Card] = [c('S', 4), c('H', 4), c('D', 4)]
    const pureSeq: [Card, Card, Card] = [c('S', 5), c('S', 6), c('S', 7)]
    const seq: [Card, Card, Card] = [c('S', 5), c('H', 6), c('D', 7)]
    const color: [Card, Card, Card] = [c('S', 2), c('S', 6), c('S', 11)]
    const pair: [Card, Card, Card] = [c('S', 9), c('H', 9), c('D', 4)]
    const highCard: [Card, Card, Card] = [c('S', 2), c('H', 9), c('D', 13)]

    expect(compareFarasHands(trail, pureSeq)).toBeGreaterThan(0)
    expect(compareFarasHands(pureSeq, seq)).toBeGreaterThan(0)
    expect(compareFarasHands(seq, color)).toBeGreaterThan(0)
    expect(compareFarasHands(color, pair)).toBeGreaterThan(0)
    expect(compareFarasHands(pair, highCard)).toBeGreaterThan(0)
  })

  it('breaks ties within a category by rank', () => {
    const highTrail: [Card, Card, Card] = [c('S', 14), c('H', 14), c('D', 14)]
    const lowTrail: [Card, Card, Card] = [c('S', 2), c('H', 2), c('D', 2)]
    expect(compareFarasHands(highTrail, lowTrail)).toBeGreaterThan(0)
  })

  it('a pair compares by pair rank first, then kicker', () => {
    const higherPair: [Card, Card, Card] = [c('S', 10), c('H', 10), c('D', 2)]
    const lowerPairBetterKicker: [Card, Card, Card] = [c('S', 9), c('H', 9), c('D', 13)]
    expect(compareFarasHands(higherPair, lowerPairBetterKicker)).toBeGreaterThan(0)
  })

  it('is a genuine tie when both hands are identical in category and ranks', () => {
    // Two different pairs of Kings, different-suit kickers of the same rank.
    const a: [Card, Card, Card] = [c('S', 13), c('H', 13), c('D', 7)]
    const b: [Card, Card, Card] = [c('D', 13), c('C', 13), c('C', 7)]
    expect(compareFarasHands(a, b)).toBe(0)
  })
})

describe('dealFaras', () => {
  it('deals 3 cards to each player', () => {
    const hands = dealFaras(6)
    expect(hands).toHaveLength(6)
    for (const hand of hands) expect(hand).toHaveLength(FARAS_CARDS_PER_HAND)
  })

  it('deals no duplicate cards across the whole table', () => {
    const hands = dealFaras(10)
    const allCards = hands.flat()
    const unique = new Set(allCards.map((card) => `${card.suit}${card.rank}`))
    expect(unique.size).toBe(allCards.length)
  })

  it('rejects fewer than 2 or more than 10 players', () => {
    expect(() => dealFaras(1)).toThrow()
    expect(() => dealFaras(11)).toThrow()
  })
})
