import { env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { Card } from '@callbreak/shared-logic'
import type { GameRoom } from '../src/GameRoom'
import { collectAll, connect, createRoom, joinFour } from './helpers'

// Minimal shape of the redacted state broadcast to a player — enough for assertions.
interface GameStateView {
  phase: string
  round: number
  dealerSeat: number
  turnSeat: number
  yourSeat: number
  yourPlayerId: string
  players: ({ id: string; name: string; seat: number; connected: boolean; isHost: boolean } | null)[]
  hand: Card[]
  bids: (number | null)[]
  tricksWon: number[]
  lastTrick: { cards: { seat: number; card: Card }[]; winnerSeat: number; trickSeq: number } | null
  totals: number[]
  roundHistory: { round: number; bids: (number | null)[]; tricksWon: number[]; points: number[] }[]
  instantWinSeat: number | null
  winnerSeat: number | null
}

function asState(msg: { type: string; payload: unknown }): GameStateView {
  expect(msg.type).toBe('state')
  return msg.payload as GameStateView
}

async function errorOf(msg: { type: string; payload: unknown }): Promise<string> {
  expect(msg.type).toBe('error')
  return (msg.payload as { message: string }).message
}

describe('GameRoom lobby', () => {
  it('assigns seats in join order and makes the first joiner host', async () => {
    const room = await createRoom('game')
    const { sockets } = await joinFour(room)

    for (let seat = 0; seat < 4; seat++) {
      sockets[seat].send('request_state')
      const state = asState(await sockets[seat].next())
      expect(state.yourSeat).toBe(seat)
      expect(state.players[seat]?.isHost).toBe(seat === 0)
      expect(state.phase).toBe('lobby')
    }
  })

  it('rejects a 5th join once the room is full', async () => {
    const room = await createRoom('game')
    await joinFour(room)
    const fifth = await connect(room, 'game')
    fifth.send('join', { name: 'Extra' })
    expect(await errorOf(await fifth.next())).toMatch(/full/i)
  })

  it('only the host can start the game', async () => {
    const room = await createRoom('game')
    const { sockets } = await joinFour(room)
    sockets[1].send('start_game')
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)
  })

  it('two different rooms are fully isolated', async () => {
    const roomA = await createRoom('game')
    const roomB = await createRoom('game')
    const a = await connect(roomA, 'game')
    const b = await connect(roomB, 'game')
    a.send('join', { name: 'A-Host' })
    b.send('join', { name: 'B-Host' })
    const stateA = asState(await a.next())
    const stateB = asState(await b.next())
    expect(stateA.players[0]?.name).toBe('A-Host')
    expect(stateB.players[0]?.name).toBe('B-Host')
    expect(stateA.players[1]).toBeNull()
    expect(stateB.players[1]).toBeNull()
  })
})

describe('GameRoom bidding', () => {
  it('enforces turn order and transitions to playing once all 4 have bid', async () => {
    const room = await createRoom('game')
    const { sockets } = await joinFour(room)
    sockets[0].send('start_game')
    await collectAll(sockets) // deal broadcast (bidding phase) to everyone

    // dealerSeat=0 for round 1, so bidding starts at seat 1.
    sockets[2].send('submit_bid', { call: 3 })
    expect(await errorOf(await sockets[2].next())).toMatch(/not your turn/i)

    sockets[1].send('submit_bid', { call: 3 })
    let state = asState((await collectAll(sockets))[1])
    expect(state.phase).toBe('bidding')
    expect(state.turnSeat).toBe(2)

    sockets[2].send('submit_bid', { call: 15 })
    expect(await errorOf(await sockets[2].next())).toMatch(/between 1 and 13/i)

    sockets[2].send('submit_bid', { call: 4 })
    await collectAll(sockets)
    sockets[3].send('submit_bid', { call: 2 })
    await collectAll(sockets)
    sockets[0].send('submit_bid', { call: 5 })
    state = asState((await collectAll(sockets))[0])

    expect(state.phase).toBe('playing')
    expect(state.bids).toEqual([5, 3, 4, 2])
    expect(state.turnSeat).toBe(1) // left of dealer leads first trick
  })
})

/** Drives every seat through bidding with the given calls (turn order
 * 1,2,3,0 for a fresh round-1 room), draining the resulting broadcast from
 * all 4 sockets after each bid. */
async function bidAll(sockets: import('./helpers').TestSocket[], calls: [number, number, number, number]) {
  const order = [1, 2, 3, 0] as const
  for (const seat of order) {
    sockets[seat].send('submit_bid', { call: calls[seat] })
    await collectAll(sockets)
  }
}

describe('GameRoom trick play — must-trump-if-void rule', () => {
  it('rejects an off-suit discard when the player holds a spade, accepts the spade', async () => {
    const room = await createRoom('game')
    const { sockets } = await joinFour(room)
    sockets[0].send('start_game')
    await collectAll(sockets)

    await bidAll(sockets, [1, 1, 1, 1])

    // Overwrite the dealt hands with a contrived, deterministic arrangement
    // for this one trick: seat1 leads a Heart; seat2 is void in hearts but
    // holds a spade (must play it); seat3 and seat0 both hold the led suit.
    const stub = env.GAME_ROOM.getByName(room)
    await runInDurableObject(stub, async (instance: GameRoom) => {
      const state = (instance as unknown as { roomState: { hands: Card[][] } }).roomState
      state.hands = [
        [{ suit: 'H', rank: 14 }], // seat0
        [{ suit: 'H', rank: 10 }], // seat1 (leader)
        [
          { suit: 'D', rank: 5 },
          { suit: 'S', rank: 7 },
        ], // seat2 — void in hearts, holds a spade
        [{ suit: 'H', rank: 2 }], // seat3
      ]
    })

    sockets[1].send('play_card', { card: { suit: 'H', rank: 10 } })
    let state = asState((await collectAll(sockets))[1])
    expect(state.turnSeat).toBe(2)

    // Illegal: discarding the diamond while holding a spade and being void in hearts.
    sockets[2].send('play_card', { card: { suit: 'D', rank: 5 } })
    expect(await errorOf(await sockets[2].next())).toMatch(/not legal/i)

    // Legal: must trump with the spade.
    sockets[2].send('play_card', { card: { suit: 'S', rank: 7 } })
    state = asState((await collectAll(sockets))[2])
    expect(state.turnSeat).toBe(3)

    sockets[3].send('play_card', { card: { suit: 'H', rank: 2 } })
    await collectAll(sockets)
    sockets[0].send('play_card', { card: { suit: 'H', rank: 14 } })
    state = asState((await collectAll(sockets))[0])

    expect(state.lastTrick?.winnerSeat).toBe(2) // the only spade played wins
    expect(state.tricksWon[2]).toBe(1)
    expect(state.turnSeat).toBe(2) // trick winner leads next
  })
})

describe('GameRoom full round → scoring → next round', () => {
  it('sweeps 13 tricks with a contrived all-spades hand and scores correctly', async () => {
    const room = await createRoom('game')
    const { sockets } = await joinFour(room)
    sockets[0].send('start_game')
    await collectAll(sockets)

    // Bids: seat0 calls 5 (comfortably under the instant-win threshold of 8,
    // so this round tests ordinary overtrick scoring + round continuation,
    // not the instant-win rule — that gets its own dedicated test below).
    await bidAll(sockets, [5, 1, 1, 1])

    // seat0 holds every spade; seats 1-3 split the other 3 suits, so seat0
    // wins every trick regardless of play order (spades always beat non-trump).
    const ranks = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const
    const stub = env.GAME_ROOM.getByName(room)
    await runInDurableObject(stub, async (instance: GameRoom) => {
      const state = (instance as unknown as { roomState: { hands: Card[][]; turnSeat: number } }).roomState
      state.hands = [
        ranks.map((rank) => ({ suit: 'S', rank }) as Card),
        ranks.map((rank) => ({ suit: 'H', rank }) as Card),
        ranks.map((rank) => ({ suit: 'D', rank }) as Card),
        ranks.map((rank) => ({ suit: 'C', rank }) as Card),
      ]
      state.turnSeat = 1 // seat1 leads first (left of dealer)
    })

    let state: GameStateView | undefined
    for (let trick = 0; trick < 13; trick++) {
      // Play order each trick: whoever's turn it is; after the first trick,
      // seat0 (the winner) always leads.
      const order = trick === 0 ? [1, 2, 3, 0] : [0, 1, 2, 3]
      for (const seat of order) {
        const hand = await runInDurableObject(env.GAME_ROOM.getByName(room), async (instance: GameRoom) => {
          return (instance as unknown as { roomState: { hands: Card[][] } }).roomState.hands[seat].slice()
        })
        const card = hand[0]
        sockets[seat].send('play_card', { card })
        state = asState((await collectAll(sockets))[seat])
      }
    }

    expect(state?.phase).toBe('roundEnd')
    expect(state?.tricksWon[0]).toBe(13)
    expect(state?.roundHistory[0].points).toEqual([5.8, -1, -1, -1])
    expect(state?.totals).toEqual([5.8, -1, -1, -1])
    expect(state?.instantWinSeat).toBeNull() // call of 5 is under the instant-win threshold

    sockets[1].send('next_round')
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('next_round')
    state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('bidding')
    expect(state.round).toBe(2)
    expect(state.dealerSeat).toBe(1)
  })

  it('calling 8+ and making it ends the game instantly, regardless of rounds remaining', async () => {
    const room = await createRoom('game')
    const { sockets } = await joinFour(room)
    sockets[0].send('start_game') // default roundCount is 5
    await collectAll(sockets)

    // seat0 calls 8 (the instant-win threshold) and sweeps every trick again.
    await bidAll(sockets, [8, 1, 1, 1])

    const ranks = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2] as const
    await runInDurableObject(env.GAME_ROOM.getByName(room), async (instance: GameRoom) => {
      const state = (instance as unknown as { roomState: { hands: Card[][]; turnSeat: number } }).roomState
      state.hands = [
        ranks.map((rank) => ({ suit: 'S', rank }) as Card),
        ranks.map((rank) => ({ suit: 'H', rank }) as Card),
        ranks.map((rank) => ({ suit: 'D', rank }) as Card),
        ranks.map((rank) => ({ suit: 'C', rank }) as Card),
      ]
      state.turnSeat = 1
    })

    let state: GameStateView | undefined
    for (let trick = 0; trick < 13; trick++) {
      const order = trick === 0 ? [1, 2, 3, 0] : [0, 1, 2, 3]
      for (const seat of order) {
        const hand = await runInDurableObject(env.GAME_ROOM.getByName(room), async (instance: GameRoom) => {
          return (instance as unknown as { roomState: { hands: Card[][] } }).roomState.hands[seat].slice()
        })
        sockets[seat].send('play_card', { card: hand[0] })
        state = asState((await collectAll(sockets))[seat])
      }
    }

    expect(state?.phase).toBe('roundEnd')
    expect(state?.instantWinSeat).toBe(0)

    sockets[0].send('next_round')
    state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('gameOver')
    expect(state.winnerSeat).toBe(0)
    expect(state.round).toBe(1) // ended after round 1, not all 5 configured rounds
  })
})
