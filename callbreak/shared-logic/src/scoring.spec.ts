import { describe, expect, it } from 'vitest'
import { cumulativeTotals, isValidCall, scoreRound, scoreRoundForPlayers } from './scoring'

describe('scoreRound', () => {
  it('exact match scores the call amount', () => {
    expect(scoreRound(3, 3)).toBe(3)
  })

  it('overtricks add 0.1 per extra trick', () => {
    expect(scoreRound(4, 6)).toBe(4.2)
  })

  it('missing the call scores negative the call amount', () => {
    expect(scoreRound(4, 2)).toBe(-4)
  })

  it('handles a call of 13 made exactly (clean sweep)', () => {
    expect(scoreRound(13, 13)).toBe(13)
  })

  it('handles zero tricks won against a call', () => {
    expect(scoreRound(5, 0)).toBe(-5)
  })
})

describe('isValidCall', () => {
  it('accepts 1 through 13', () => {
    expect(isValidCall(1)).toBe(true)
    expect(isValidCall(13)).toBe(true)
    expect(isValidCall(7)).toBe(true)
  })

  it('rejects out-of-range or non-integer calls', () => {
    expect(isValidCall(0)).toBe(false)
    expect(isValidCall(14)).toBe(false)
    expect(isValidCall(3.5)).toBe(false)
  })
})

describe('scoreRoundForPlayers / cumulativeTotals', () => {
  it('scores a full 4-player round and accumulates over multiple rounds', () => {
    const round1 = scoreRoundForPlayers([
      { playerId: 'a', call: 3, tricksWon: 3 },
      { playerId: 'b', call: 4, tricksWon: 6 },
      { playerId: 'c', call: 4, tricksWon: 2 },
      { playerId: 'd', call: 2, tricksWon: 2 },
    ])
    expect(round1.map((r) => r.points)).toEqual([3, 4.2, -4, 2])

    const round1Points = Object.fromEntries(round1.map((r) => [r.playerId, r.points]))
    const round2Points = { a: 1, b: -2, c: 3, d: 3 }

    const totals = cumulativeTotals([round1Points, round2Points])
    expect(totals).toEqual({ a: 4, b: 2.2, c: -1, d: 5 })
  })
})
