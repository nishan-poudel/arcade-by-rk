import { describe, expect, it } from 'vitest'
import { isLegalPlay, legalPlays, resolveTrickWinner } from './trick'
import type { Card } from './types'

const c = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })

describe('legalPlays', () => {
  it('allows any card when leading', () => {
    const hand = [c('H', 10), c('S', 5), c('C', 2)]
    expect(legalPlays(hand, [])).toEqual(hand)
  })

  it('must follow the led suit when possible', () => {
    const hand = [c('H', 10), c('H', 2), c('S', 5)]
    const legal = legalPlays(hand, [c('H', 9)])
    expect(legal).toEqual([c('H', 10), c('H', 2)])
  })

  it('must trump with a spade when void in the led suit and holding a spade', () => {
    const hand = [c('D', 4), c('S', 3), c('S', 9)]
    const legal = legalPlays(hand, [c('H', 9)])
    expect(legal).toEqual([c('S', 3), c('S', 9)])
  })

  it('may discard freely when void in the led suit and holding no spades', () => {
    const hand = [c('D', 4), c('C', 9)]
    const legal = legalPlays(hand, [c('H', 9)])
    expect(legal).toEqual(hand)
  })

  it('when spades are led, a player void in spades may play anything', () => {
    const hand = [c('D', 4), c('C', 9)]
    const legal = legalPlays(hand, [c('S', 6)])
    expect(legal).toEqual(hand)
  })

  it('isLegalPlay matches legalPlays', () => {
    const hand = [c('D', 4), c('S', 9)]
    const trick = [c('H', 9)]
    expect(isLegalPlay(hand, trick, c('S', 9))).toBe(true)
    expect(isLegalPlay(hand, trick, c('D', 4))).toBe(false)
  })
})

describe('resolveTrickWinner', () => {
  it('highest card of the led suit wins when no spades played', () => {
    const plays = [
      { seat: 0, card: c('H', 9) },
      { seat: 1, card: c('H', 12) },
      { seat: 2, card: c('D', 14) },
      { seat: 3, card: c('H', 5) },
    ]
    expect(resolveTrickWinner(plays)).toBe(1)
  })

  it('any spade beats non-trump, highest spade wins among spades', () => {
    const plays = [
      { seat: 0, card: c('H', 14) },
      { seat: 1, card: c('S', 2) },
      { seat: 2, card: c('S', 9) },
      { seat: 3, card: c('C', 10) },
    ]
    expect(resolveTrickWinner(plays)).toBe(2)
  })

  it('when spades are led, highest spade wins', () => {
    const plays = [
      { seat: 0, card: c('S', 4) },
      { seat: 1, card: c('S', 13) },
      { seat: 2, card: c('D', 2) },
      { seat: 3, card: c('S', 6) },
    ]
    expect(resolveTrickWinner(plays)).toBe(1)
  })

  it('throws on an empty trick', () => {
    expect(() => resolveTrickWinner([])).toThrow()
  })
})
