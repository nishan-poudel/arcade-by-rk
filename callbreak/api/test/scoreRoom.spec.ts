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
  instantWinSeat: number | null
  winnerSeat: number | null
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

  it('lets the host add all 3 other players by name, with no one else connecting', async () => {
    const room = await createRoom('score')
    const host = await connect(room, 'score')
    host.send('join', { name: 'Solo Host' })
    let state = asState(await host.next())
    expect(state.players[0]?.connected).toBe(true)

    for (const name of ['Bina', 'Chirag', 'Deepa']) {
      host.send('add_player', { name })
      state = asState(await host.next())
    }

    expect(state.players.map((p) => p?.name)).toEqual(['Solo Host', 'Bina', 'Chirag', 'Deepa'])
    expect(state.players.slice(1).every((p) => p?.connected === false)).toBe(true)

    host.send('start_game')
    state = asState(await host.next())
    expect(state.phase).toBe('roundEntry')

    // Scoring works identically for name-only seats.
    host.send('submit_round', {
      entries: [
        { seat: 0, call: 3, tricksWon: 3 },
        { seat: 1, call: 4, tricksWon: 6 },
        { seat: 2, call: 4, tricksWon: 2 },
        { seat: 3, call: 2, tricksWon: 2 },
      ],
    })
    state = asState(await host.next())
    expect(state.history[0].map((h) => h.points)).toEqual([3, 4.2, -4, 2])
  })

  it('rejects a 5th add_player once the session has 4 players, and a mistyped name can be removed', async () => {
    const room = await createRoom('score')
    const host = await connect(room, 'score')
    host.send('join', { name: 'Host' })
    await host.next()
    for (const name of ['B', 'C', 'D']) {
      host.send('add_player', { name })
      await host.next()
    }

    host.send('add_player', { name: 'Extra' })
    expect(await errorOf(await host.next())).toMatch(/already has 4 players/i)

    host.send('remove_player', { seat: 1 })
    const state = asState(await host.next())
    expect(state.players[1]).toBeNull()
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
          { seat: 3, call: 7, tricksWon: 10 }, // under the instant-win threshold of 8

        ],
      })
      await collectAll(sockets)
      sockets[0].send('continue')
      state = asState((await collectAll(sockets))[0])
    }

    expect(state.phase).toBe('gameOver')
    expect(state.round).toBe(3)
  })

  it('calling 8+ and making it ends the session instantly, regardless of rounds remaining', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('set_round_count', { roundCount: 5 })
    await collectAll(sockets)
    sockets[0].send('start_game')
    await collectAll(sockets)

    sockets[0].send('submit_round', {
      entries: [
        { seat: 0, call: 8, tricksWon: 8 },
        { seat: 1, call: 1, tricksWon: 2 },
        { seat: 2, call: 1, tricksWon: 2 },
        { seat: 3, call: 1, tricksWon: 1 },
      ],
    })
    let state = asState((await collectAll(sockets))[0])
    expect(state.instantWinSeat).toBe(0)

    sockets[0].send('continue')
    state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('gameOver')
    expect(state.winnerSeat).toBe(0)
    expect(state.round).toBe(1) // ended after round 1, not all 5 configured rounds
  })
})
