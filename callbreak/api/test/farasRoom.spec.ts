import { env, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { Card } from '@callbreak/shared-logic'
import type { FarasRoom } from '../src/FarasRoom'
import { collectAll, createRoom, joinN } from './helpers'

interface FarasPlayerView {
  id: string
  name: string
  isHost: boolean
  connected: boolean
  score: number
}

interface FarasStateView {
  phase: 'lobby' | 'hand' | 'handResult' | 'gameOver'
  players: FarasPlayerView[]
  handState: Record<string, { folded: boolean; seen: boolean }>
  turnPlayerId: string | null
  dealerIndex: number
  lastResult: { winnerIds: string[]; category: string | null; revealedHands: Record<string, Card[]> } | null
  yourPlayerId: string
  yourHand: Card[]
}

function asState(msg: { type: string; payload: unknown }): FarasStateView {
  expect(msg.type).toBe('state')
  return msg.payload as FarasStateView
}

async function errorOf(msg: { type: string; payload: unknown }): Promise<string> {
  expect(msg.type).toBe('error')
  return (msg.payload as { message: string }).message
}

async function setHands(room: string, hands: Record<string, Card[]>): Promise<void> {
  const stub = env.FARAS_ROOM.getByName(room)
  await runInDurableObject(stub, async (instance: FarasRoom) => {
    const state = (instance as unknown as { roomState: { hands: Record<string, Card[]> } }).roomState
    state.hands = hands
  })
}

describe('FarasRoom lobby', () => {
  it('makes the first joiner host and lists players in join order', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)

    sockets[0].send('request_state')
    const state = asState(await sockets[0].next())
    expect(state.players.map((p) => p.id)).toEqual(playerIds)
    expect(state.players[0].isHost).toBe(true)
    expect(state.players.slice(1).every((p) => !p.isHost)).toBe(true)
  })

  it('only the host can start a hand, and needs at least 2 players', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 2)

    sockets[1].send('start_hand')
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('start_hand')
    const state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('hand')
  })
})

describe('FarasRoom dealing and turn order', () => {
  it('deals 3 cards to each player and sets the turn to the player left of the dealer', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    const states = await collectAll(sockets)

    for (const [seat, msg] of states.entries()) {
      const state = asState(msg)
      expect(state.yourHand).toHaveLength(3)
      expect(state.yourPlayerId).toBe(playerIds[seat])
    }
    expect(asState(states[0]).turnPlayerId).toBe(playerIds[1]) // dealerIndex 0 -> left of dealer is seat 1
  })

  it('rejects fold/stay from anyone other than the current turn player', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    sockets[2].send('fold') // turn is playerIds[1], not playerIds[2]
    expect(await errorOf(await sockets[2].next())).toMatch(/not your turn/i)
    void playerIds
  })

  it('ghotchu marks a hand as seen without ending the turn', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 2)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    sockets[1].send('ghotchu') // turn belongs to playerIds[1]
    let state = asState((await collectAll(sockets))[0])
    expect(state.handState[playerIds[1]].seen).toBe(true)
    expect(state.turnPlayerId).toBe(playerIds[1]) // still their turn

    sockets[1].send('stay')
    state = asState((await collectAll(sockets))[0])
    expect(state.turnPlayerId).toBe(playerIds[0])
  })
})

describe('FarasRoom hand resolution', () => {
  it('folding down to one player auto-resolves the hand with no reveal', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    // Turn order starting left of dealer (seat0): seat1, seat2, seat0.
    sockets[1].send('fold')
    await collectAll(sockets)
    sockets[2].send('fold')
    const state = asState((await collectAll(sockets))[0])

    expect(state.phase).toBe('handResult')
    expect(state.lastResult?.winnerIds).toEqual([playerIds[0]])
    expect(state.lastResult?.category).toBeNull()
    expect(state.lastResult?.revealedHands).toEqual({})
    expect(state.players.find((p) => p.id === playerIds[0])?.score).toBe(1)
  })

  it('rejects a show unless exactly 2 players remain in the hand', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    sockets[1].send('request_show')
    expect(await errorOf(await sockets[1].next())).toMatch(/exactly 2/i)
  })

  it('a show between the last two compares hands and reveals both', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    // seat2 folds, leaving seat0 (trail of kings) vs seat1 (high card).
    sockets[1].send('stay')
    await collectAll(sockets)
    sockets[2].send('fold')
    await collectAll(sockets)

    await setHands(room, {
      [playerIds[0]]: [
        { suit: 'S', rank: 13 },
        { suit: 'H', rank: 13 },
        { suit: 'D', rank: 13 },
      ],
      [playerIds[1]]: [
        { suit: 'S', rank: 2 },
        { suit: 'H', rank: 9 },
        { suit: 'D', rank: 4 },
      ],
    })

    sockets[0].send('request_show')
    const state = asState((await collectAll(sockets))[0])

    expect(state.phase).toBe('handResult')
    expect(state.lastResult?.winnerIds).toEqual([playerIds[0]])
    expect(state.lastResult?.category).toBe('trail')
    expect(Object.keys(state.lastResult?.revealedHands ?? {}).sort()).toEqual([playerIds[0], playerIds[1]].sort())
    expect(state.players.find((p) => p.id === playerIds[0])?.score).toBe(1)
  })

  it('host can start the next hand, rotating the dealer', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 2)
    sockets[0].send('start_hand')
    await collectAll(sockets)
    sockets[1].send('fold')
    await collectAll(sockets)

    sockets[1].send('next_hand')
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('next_hand')
    const state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('hand')
    expect(state.dealerIndex).toBe(1)
    expect(state.turnPlayerId).toBe(playerIds[0]) // left of the new dealer (seat1) is seat0
  })

  it('host can end the session anytime, moving to gameOver', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 2)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    sockets[1].send('end_session')
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('end_session')
    const state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('gameOver')
  })
})

describe('FarasRoom leaving the table', () => {
  it('leaving mid-hand forces an implicit fold and the game continues with the rest', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    // Turn belongs to seat1 — they leave instead of acting.
    sockets[1].send('leave_table')
    const remaining = [sockets[0], sockets[2]]
    const state = asState((await collectAll(remaining))[0])

    expect(state.players.map((p) => p.id)).toEqual([playerIds[0], playerIds[2]])
    expect(state.phase).toBe('hand') // still 2 active players (seat0, seat2)
    expect(state.turnPlayerId).toBe(playerIds[2])
  })

  it('leaving down to 1 player pauses the room to the lobby, preserving scores', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 2)
    sockets[0].send('start_hand')
    await collectAll(sockets)
    sockets[1].send('fold') // seat0 wins a point
    await collectAll(sockets) // now in 'handResult', not a live hand

    sockets[1].send('leave_table')
    const state = asState(await sockets[0].next())

    expect(state.players.map((p) => p.id)).toEqual([playerIds[0]])
    expect(state.phase).toBe('lobby')
    expect(state.players[0].score).toBe(1) // untouched by the pause
  })

  it('promotes the next player to host if the host leaves', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)

    sockets[0].send('leave_table')
    const state = asState((await collectAll([sockets[1], sockets[2]]))[0])
    expect(state.players[0].id).toBe(playerIds[1])
    expect(state.players[0].isHost).toBe(true)
  })
})
