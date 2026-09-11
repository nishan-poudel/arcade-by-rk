import { describe, expect, it } from 'vitest'
import { buildDeck, dealHands, shuffle } from './deck'
import { CARDS_PER_HAND, SEATS } from './types'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('buildDeck', () => {
  it('has 52 unique cards', () => {
    const deck = buildDeck()
    expect(deck).toHaveLength(52)
    const keys = new Set(deck.map((c) => `${c.suit}${c.rank}`))
    expect(keys.size).toBe(52)
  })
})

describe('shuffle', () => {
  it('is a permutation of the input (same cards, same length)', () => {
    const deck = buildDeck()
    const shuffled = shuffle(deck, mulberry32(42))
    expect(shuffled).toHaveLength(deck.length)
    expect(new Set(shuffled.map((c) => `${c.suit}${c.rank}`))).toEqual(
      new Set(deck.map((c) => `${c.suit}${c.rank}`)),
    )
  })

  it('does not mutate the input array', () => {
    const deck = buildDeck()
    const copy = deck.slice()
    shuffle(deck, mulberry32(1))
    expect(deck).toEqual(copy)
  })

  it('is deterministic for a given rng', () => {
    const deck = buildDeck()
    const a = shuffle(deck, mulberry32(7))
    const b = shuffle(deck, mulberry32(7))
    expect(a).toEqual(b)
  })
})

describe('dealHands', () => {
  it('splits a full deck into 4 hands of 13 with no overlap', () => {
    const shuffled = shuffle(buildDeck(), mulberry32(99))
    const hands = dealHands(shuffled)
    expect(hands).toHaveLength(SEATS)
    for (const hand of hands) {
      expect(hand).toHaveLength(CARDS_PER_HAND)
    }
    const allKeys = hands.flat().map((c) => `${c.suit}${c.rank}`)
    expect(new Set(allKeys).size).toBe(52)
  })

  it('throws on a non-52-card deck', () => {
    expect(() => dealHands(buildDeck().slice(0, 51))).toThrow()
  })
})
