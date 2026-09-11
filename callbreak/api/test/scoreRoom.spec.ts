import { describe, expect, it } from 'vitest'
import { collectAll, connect, createRoom, joinFour } from './helpers'

interface ScoreStateView {
  phase: string
  round: number
  roundCount: number
  yourSeat: number
  players: ({ id: string; name: string; seat: number; connected: boolean; isHost: boolean } | null)[]
  history: { call: number; tricksWon: number; points: number }[][]
  totals: number[]
}

function asState(msg: { type: string; payload: unknown }): ScoreStateView {
  expect(msg.type).toBe('state')
  return msg.payload as ScoreStateView
}

async function errorOf(msg: { type: string; payload: unknown }): Promise<string> {
  expect(msg.type).toBe('error')
  return (msg.payload as { message: string }).message
}

describe('ScoreRoom', () => {
  it('requires exactly 4 players to start', async () => {
    const room = await createRoom('score')
    const a = await connect(room, 'score')
    a.send('join', { name: 'Solo Host' })
    await a.next()
    a.send('start_game')
    expect(await errorOf(await a.next())).toMatch(/4 players/i)
  })

  it('only the host can set the round count or start', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[1].send('set_round_count', { roundCount: 3 })
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('set_round_count', { roundCount: 3 })
    const state = asState((await collectAll(sockets))[0])
    expect(state.roundCount).toBe(3)
  })

  it('rejects a round whose tricks do not add up to 13', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('start_game')
    await collectAll(sockets)

    sockets[0].send('submit_round', {
      entries: [
        { seat: 0, call: 3, tricksWon: 3 },
        { seat: 1, call: 4, tricksWon: 4 },
        { seat: 2, call: 4, tricksWon: 4 },
        { seat: 3, call: 2, tricksWon: 1 }, // sums to 12, not 13
      ],
    })
    expect(await errorOf(await sockets[0].next())).toMatch(/add up to 13/i)
  })

  it('scores a round with scoreRound semantics and loops through to game over', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('set_round_count', { roundCount: 3 })
    await collectAll(sockets)
    sockets[0].send('start_game')
    await collectAll(sockets)

    const entries = [
      { seat: 0, call: 3, tricksWon: 3 }, // exact -> 3
      { seat: 1, call: 4, tricksWon: 6 }, // overtrick -> 4.2
      { seat: 2, call: 4, tricksWon: 2 }, // missed -> -4
      { seat: 3, call: 2, tricksWon: 2 }, // exact -> 2
    ]
    sockets[0].send('submit_round', { entries })
    let state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('roundResult')
    expect(state.history[0].map((h) => h.points)).toEqual([3, 4.2, -4, 2])
    expect(state.totals).toEqual([3, 4.2, -4, 2])

    // Non-host cannot advance.
    sockets[1].send('continue')
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('continue')
    state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('roundEntry')
    expect(state.round).toBe(1)

    // Play out rounds 2 and 3 to reach game over.
    for (let round = 2; round <= 3; round++) {
      sockets[0].send('submit_round', {
        entries: [
          { seat: 0, call: 1, tricksWon: 1 },
          { seat: 1, call: 1, tricksWon: 1 },
          { seat: 2, call: 1, tricksWon: 1 },
          { seat: 3, call: 10, tricksWon: 10 },
        ],
      })
      await collectAll(sockets)
      sockets[0].send('continue')
      state = asState((await collectAll(sockets))[0])
    }

    expect(state.phase).toBe('gameOver')
    expect(state.round).toBe(3)
  })
})
