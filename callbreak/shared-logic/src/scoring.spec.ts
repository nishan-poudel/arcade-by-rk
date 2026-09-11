import { describe, expect, it } from 'vitest'
import {
  addPointsOT,
  cumulativeTotals,
  isInstantWin,
  isValidCall,
  normalizePointsOT,
  scoreRound,
  scoreRoundForPlayers,
  scoreRoundSplit,
  sumPointsOT,
} from './scoring'

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

describe('scoreRoundSplit / normalizePointsOT / sumPointsOT', () => {
  it('matches scoreRound exactly for a range of made and missed calls', () => {
    const cases: [number, number][] = [
      [3, 3],
      [4, 6],
      [4, 2],
      [13, 13],
      [5, 0],
      [1, 13], // a single round can itself produce OT >= 10
      [8, 8],
    ]
    for (const [call, tricksWon] of cases) {
      const split = scoreRoundSplit(call, tricksWon)
      expect(split.points + split.ot / 10).toBeCloseTo(scoreRound(call, tricksWon), 5)
    }
  })

  it('rolls OT over into a whole point at 10, keeping OT in 0-9', () => {
    expect(scoreRoundSplit(1, 13)).toEqual({ points: 2, ot: 2 }) // 1 + 12 OT -> +1 pt, 2 OT
    expect(scoreRoundSplit(2, 10)).toEqual({ points: 2, ot: 8 })
  })

  it('missing a call contributes zero OT', () => {
    expect(scoreRoundSplit(4, 2)).toEqual({ points: -4, ot: 0 })
  })

  it('normalizes an already-rolled-over OT unchanged', () => {
    expect(normalizePointsOT({ points: 3, ot: 4 })).toEqual({ points: 3, ot: 4 })
  })

  it('rollover works correctly even when accumulated points are negative', () => {
    // round1: call 3 made with 2 extra (+3,+2 OT); round2: missed call 5 (-5, 0 OT)
    const total = addPointsOT(scoreRoundSplit(3, 5), scoreRoundSplit(5, 2))
    expect(total).toEqual({ points: -2, ot: 2 })
    expect(total.points + total.ot / 10).toBeCloseTo(-1.8, 5)
  })

  it('sums a full round history the same way running totals accumulate', () => {
    const rounds = [scoreRoundSplit(3, 3), scoreRoundSplit(4, 6), scoreRoundSplit(4, 2), scoreRoundSplit(2, 2)]
    expect(sumPointsOT(rounds)).toEqual({ points: 5, ot: 2 }) // 3+4-4+2=5 pts, 2 OT from the 4->6 round
  })
})

describe('isInstantWin', () => {
  it('is true only when the call is 8+ and made', () => {
    expect(isInstantWin(8, 8)).toBe(true)
    expect(isInstantWin(9, 13)).toBe(true)
    expect(isInstantWin(8, 7)).toBe(false) // missed
    expect(isInstantWin(7, 13)).toBe(false) // call too low, even though made big
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
