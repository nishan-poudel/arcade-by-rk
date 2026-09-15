import { describe, expect, it } from 'vitest'
import { collectAll, connect, createRoom, joinFour, type TestSocket } from './helpers'

interface PendingEntry {
  call: number | null
  tricksWon: number | null
  locked: boolean
}

interface ScoreStateView {
  phase: string
  round: number
  roundCount: number
  yourSeat: number
  players: ({ id: string; name: string; seat: number; connected: boolean; isHost: boolean } | null)[]
  pendingEntries: PendingEntry[]
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

/** Locks in all 4 seats' entries in order via the host, one at a time —
 * the real flow (turn by turn, each one locked as soon as it's entered). If
 * the tricks add up to 13, the 4th lock finalizes the round and this
 * returns the resulting (roundResult) state. */
async function lockRound(
  sockets: TestSocket[],
  entries: { call: number; tricksWon: number }[],
): Promise<ScoreStateView> {
  let state: ScoreStateView | undefined
  for (let seat = 0; seat < 4; seat++) {
    sockets[0].send('lock_entry', { seat, call: entries[seat].call, tricksWon: entries[seat].tricksWon })
    state = asState((await collectAll(sockets))[0])
  }
  return state!
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
    for (const [seat, entry] of [
      { call: 3, tricksWon: 3 },
      { call: 4, tricksWon: 6 },
      { call: 4, tricksWon: 2 },
      { call: 2, tricksWon: 2 },
    ].entries()) {
      host.send('lock_entry', { seat, ...entry })
      state = asState(await host.next())
    }
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

  it('only the host can lock or unlock an entry', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('start_game')
    await collectAll(sockets)

    sockets[1].send('lock_entry', { seat: 1, call: 3, tricksWon: 3 })
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('lock_entry', { seat: 0, call: 3, tricksWon: 3 })
    await collectAll(sockets)

    sockets[1].send('unlock_entry', { seat: 0 })
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)
  })

  it('rejects locking an already-locked seat until it is unlocked', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('start_game')
    await collectAll(sockets)

    sockets[0].send('lock_entry', { seat: 2, call: 4, tricksWon: 4 })
    await collectAll(sockets)

    sockets[0].send('lock_entry', { seat: 2, call: 5, tricksWon: 5 })
    expect(await errorOf(await sockets[0].next())).toMatch(/already locked/i)

    sockets[0].send('unlock_entry', { seat: 2 })
    let state = asState((await collectAll(sockets))[0])
    expect(state.pendingEntries[2].locked).toBe(false)

    sockets[0].send('lock_entry', { seat: 2, call: 5, tricksWon: 5 })
    state = asState((await collectAll(sockets))[0])
    expect(state.pendingEntries[2]).toEqual({ call: 5, tricksWon: 5, locked: true })
  })

  it('does not finalize a round whose tricks do not add up to 13 until an entry is unlocked and fixed', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('start_game')
    await collectAll(sockets)

    const bad = [
      { call: 3, tricksWon: 3 },
      { call: 4, tricksWon: 4 },
      { call: 4, tricksWon: 4 },
      { call: 2, tricksWon: 1 }, // sums to 12, not 13
    ]
    let state: ScoreStateView | undefined
    for (let seat = 0; seat < 4; seat++) {
      sockets[0].send('lock_entry', { seat, ...bad[seat] })
      state = asState((await collectAll(sockets))[0])
    }
    // All 4 locked, but the mismatch means the round hasn't finalized.
    expect(state?.phase).toBe('roundEntry')
    expect(state?.pendingEntries.every((e) => e.locked)).toBe(true)

    sockets[0].send('unlock_entry', { seat: 3 })
    await collectAll(sockets)
    sockets[0].send('lock_entry', { seat: 3, call: 2, tricksWon: 2 }) // now sums to 13
    state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('roundResult')
    // seat1 (call4/won4) and seat2 (call4/won4) both made their call exactly.
    expect(state.history[0].map((h) => h.points)).toEqual([3, 4, 4, 2])
  })

  it('scores a round with scoreRound semantics and loops through to game over', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('set_round_count', { roundCount: 3 })
    await collectAll(sockets)
    sockets[0].send('start_game')
    await collectAll(sockets)

    let state = await lockRound(sockets, [
      { call: 3, tricksWon: 3 }, // exact -> 3
      { call: 4, tricksWon: 6 }, // overtrick -> 4.2
      { call: 4, tricksWon: 2 }, // missed -> -4
      { call: 2, tricksWon: 2 }, // exact -> 2
    ])
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
      state = await lockRound(sockets, [
        { call: 1, tricksWon: 1 },
        { call: 1, tricksWon: 1 },
        { call: 1, tricksWon: 1 },
        { call: 7, tricksWon: 10 }, // under the instant-win threshold of 8
      ])
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

    const state1 = await lockRound(sockets, [
      { call: 8, tricksWon: 8 },
      { call: 1, tricksWon: 2 },
      { call: 1, tricksWon: 2 },
      { call: 1, tricksWon: 1 },
    ])
    expect(state1.instantWinSeat).toBe(0)

    sockets[0].send('continue')
    const state2 = asState((await collectAll(sockets))[0])
    expect(state2.phase).toBe('gameOver')
    expect(state2.winnerSeat).toBe(0)
    expect(state2.round).toBe(1) // ended after round 1, not all 5 configured rounds
  })

  it('lets the host correct a past round only after the session is over, recomputing totals and winner', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('set_round_count', { roundCount: 3 })
    await collectAll(sockets)
    sockets[0].send('start_game')
    await collectAll(sockets)

    // Round 1 as originally (mis-entered): seat3 comes out well on top.
    await lockRound(sockets, [
      { call: 1, tricksWon: 1 },
      { call: 1, tricksWon: 1 },
      { call: 1, tricksWon: 1 },
      { call: 6, tricksWon: 10 },
    ])

    // Trying to edit before the session is over is rejected.
    sockets[0].send('edit_round', {
      round: 1,
      entries: [
        { seat: 0, call: 1, tricksWon: 1 },
        { seat: 1, call: 1, tricksWon: 1 },
        { seat: 2, call: 1, tricksWon: 1 },
        { seat: 3, call: 6, tricksWon: 10 },
      ],
    })
    expect(await errorOf(await sockets[0].next())).toMatch(/session is complete/i)

    sockets[0].send('continue')
    await collectAll(sockets)

    // Rounds 2-3: everyone calls 1 and makes it, so relative standing never changes.
    let state: ScoreStateView | undefined
    for (let round = 0; round < 2; round++) {
      await lockRound(sockets, [
        { call: 1, tricksWon: 1 },
        { call: 1, tricksWon: 1 },
        { call: 1, tricksWon: 1 },
        { call: 1, tricksWon: 10 },
      ])
      sockets[0].send('continue')
      state = asState((await collectAll(sockets))[0])
    }

    expect(state?.phase).toBe('gameOver')
    expect(state?.round).toBe(3)
    expect(state?.winnerSeat).toBe(3) // seat3 comfortably ahead as originally entered

    // Turns out seat0 actually won more tricks in round 1 than recorded —
    // correct it (and reduce seat3's tricks that round to keep the sum at 13).
    sockets[0].send('edit_round', {
      round: 1,
      entries: [
        { seat: 0, call: 1, tricksWon: 9 },
        { seat: 1, call: 1, tricksWon: 1 },
        { seat: 2, call: 1, tricksWon: 1 },
        { seat: 3, call: 6, tricksWon: 2 },
      ],
    })
    state = asState((await collectAll(sockets))[0])
    expect(state.history[0].map((h) => h.points)).toEqual([1.8, 1, 1, -6])
    // Rounds 2-3 unaffected; seat0's new total is round1(1.8) + 1 + 1 = 3.8.
    expect(state.totals[0]).toBeCloseTo(3.8, 5)
    expect(state.winnerSeat).toBe(0) // recomputed from the corrected totals

    // Non-host cannot edit.
    sockets[1].send('edit_round', {
      round: 1,
      entries: [
        { seat: 0, call: 1, tricksWon: 1 },
        { seat: 1, call: 1, tricksWon: 1 },
        { seat: 2, call: 1, tricksWon: 1 },
        { seat: 3, call: 6, tricksWon: 10 },
      ],
    })
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)
  })

  it('leaves an instant-win ending alone when correcting a round, even if the corrected totals differ', async () => {
    const room = await createRoom('score')
    const { sockets } = await joinFour(room, 'score')
    sockets[0].send('set_round_count', { roundCount: 5 })
    await collectAll(sockets)
    sockets[0].send('start_game')
    await collectAll(sockets)

    await lockRound(sockets, [
      { call: 8, tricksWon: 8 },
      { call: 1, tricksWon: 2 },
      { call: 1, tricksWon: 2 },
      { call: 1, tricksWon: 1 },
    ])
    sockets[0].send('continue')
    await collectAll(sockets)

    // Correct a detail of the instant-win round itself (still an instant win).
    sockets[0].send('edit_round', {
      round: 1,
      entries: [
        { seat: 0, call: 8, tricksWon: 9 },
        { seat: 1, call: 1, tricksWon: 1 },
        { seat: 2, call: 1, tricksWon: 2 },
        { seat: 3, call: 1, tricksWon: 1 },
      ],
    })
    const state = asState((await collectAll(sockets))[0])
    expect(state.winnerSeat).toBe(0) // instant-win seat, untouched by the correction
    expect(state.totals[0]).toBe(8.1)
  })
})
