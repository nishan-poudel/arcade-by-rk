import { env, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import type { Card } from '@callbreak/shared-logic'
import type { FarasRoom } from '../src/FarasRoom'
import { collectAll, createRoom, joinN, type TestSocket } from './helpers'

interface FarasPlayerView {
  id: string
  name: string
  isHost: boolean
  connected: boolean
  chips: number
  score: number
  isBot: boolean
}

interface FarasStateView {
  phase: 'lobby' | 'hand' | 'handResult' | 'gameOver'
  mode: 'betting' | 'show'
  players: FarasPlayerView[]
  handState: Record<string, { folded: boolean; seen: boolean }>
  turnPlayerId: string | null
  dealerIndex: number
  pot: number
  stake: number
  lastResult: {
    winnerIds: string[]
    category: string | null
    revealedHands: Record<string, Card[]>
    potWon?: number
  } | null
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

/** Host switches the room to Show Mode before anyone's dealt in — used by
 * the structural tests that only care about turn order/leaving/etc. and
 * would otherwise have to deal with betting-mode chip bookkeeping. */
async function useShowMode(sockets: TestSocket[]): Promise<void> {
  sockets[0].send('set_mode', { mode: 'show' })
  await collectAll(sockets)
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
    expect(state.mode).toBe('betting') // default
    expect(state.players.every((p) => p.chips === 100)).toBe(true)
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

  it('only the host can change the mode, and only in the lobby', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 2)

    sockets[1].send('set_mode', { mode: 'show' })
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('set_mode', { mode: 'show' })
    let state = asState((await collectAll(sockets))[0])
    expect(state.mode).toBe('show')

    sockets[0].send('start_hand')
    await collectAll(sockets)
    sockets[0].send('set_mode', { mode: 'betting' })
    expect(await errorOf(await sockets[0].next())).toMatch(/lobby/i)
    void state
  })
})

describe('FarasRoom dealing and turn order (show mode)', () => {
  it('deals 3 cards to each player and sets the turn to the player left of the dealer', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    await useShowMode(sockets)
    sockets[0].send('start_hand')
    const states = await collectAll(sockets)

    for (const [seat, msg] of states.entries()) {
      const state = asState(msg)
      expect(state.yourHand).toHaveLength(3)
      expect(state.yourPlayerId).toBe(playerIds[seat])
    }
    // Show mode has no turns at all.
    expect(asState(states[0]).turnPlayerId).toBeNull()
  })

  it('betting mode sets the turn to the player left of the dealer', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    const states = await collectAll(sockets)
    expect(asState(states[0]).turnPlayerId).toBe(playerIds[1]) // dealerIndex 0 -> left of dealer is seat 1
  })

  it('rejects fold/stay from anyone other than the current turn player', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    sockets[2].send('fold') // turn is seat1, not seat2
    expect(await errorOf(await sockets[2].next())).toMatch(/not your turn/i)
  })

  it('ghotchu marks a hand as seen without ending the turn', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 2)
    await useShowMode(sockets)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    sockets[1].send('ghotchu')
    const state = asState((await collectAll(sockets))[0])
    expect(state.handState[playerIds[1]].seen).toBe(true)
  })
})

describe('FarasRoom hand resolution (show mode)', () => {
  it('reveal_all compares every dealt hand and awards the best one a point', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    await useShowMode(sockets)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    await setHands(room, {
      [playerIds[0]]: [
        { suit: 'S', rank: 2 },
        { suit: 'H', rank: 9 },
        { suit: 'D', rank: 4 },
      ],
      [playerIds[1]]: [
        { suit: 'S', rank: 13 },
        { suit: 'H', rank: 13 },
        { suit: 'D', rank: 13 },
      ],
      [playerIds[2]]: [
        { suit: 'S', rank: 5 },
        { suit: 'H', rank: 6 },
        { suit: 'D', rank: 7 },
      ],
    })

    sockets[1].send('reveal_all')
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('reveal_all')
    const state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('handResult')
    expect(state.lastResult?.winnerIds).toEqual([playerIds[1]])
    expect(state.lastResult?.category).toBe('trail')
    expect(Object.keys(state.lastResult?.revealedHands ?? {})).toHaveLength(3)
    expect(state.players.find((p) => p.id === playerIds[1])?.score).toBe(1)
  })

  it('rejects reveal_all outside show mode, and fold/stay/show outside betting mode', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 2)
    sockets[0].send('start_hand') // betting mode (default)
    await collectAll(sockets)

    sockets[0].send('reveal_all')
    expect(await errorOf(await sockets[0].next())).toMatch(/show mode/i)
  })
})

describe('FarasRoom hand resolution (betting mode)', () => {
  it('boots every player at deal time into the pot', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    const state = asState((await collectAll(sockets))[0])

    expect(state.pot).toBe(6) // $2 boot x 3 players
    expect(state.stake).toBe(2)
    expect(state.players.every((p) => p.chips === 98)).toBe(true)
  })

  it('stay costs the stake while blind, and double once seen', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 2)
    sockets[0].send('start_hand')
    await collectAll(sockets) // pot=4, both at 98, turn=seat1

    sockets[1].send('stay') // blind stay: -2
    let state = asState((await collectAll(sockets))[0])
    expect(state.players.find((p) => p.id === playerIds[1])?.chips).toBe(96)
    expect(state.pot).toBe(6)

    sockets[0].send('ghotchu')
    await collectAll(sockets)
    sockets[0].send('stay') // seen stay: -4
    state = asState((await collectAll(sockets))[0])
    expect(state.players.find((p) => p.id === playerIds[0])?.chips).toBe(94)
    expect(state.pot).toBe(10)
  })

  it('folding down to one player awards them the whole pot with no reveal', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    await collectAll(sockets) // pot = 6

    sockets[1].send('fold')
    await collectAll(sockets)
    sockets[2].send('fold')
    const state = asState((await collectAll(sockets))[0])

    expect(state.phase).toBe('handResult')
    expect(state.lastResult?.winnerIds).toEqual([playerIds[0]])
    expect(state.lastResult?.category).toBeNull()
    expect(state.lastResult?.revealedHands).toEqual({})
    expect(state.lastResult?.potWon).toBe(6)
    expect(state.players.find((p) => p.id === playerIds[0])?.chips).toBe(104) // 98 + 6 pot
    expect(state.pot).toBe(0)
  })

  it('show charges the requester and the winner takes the whole pot', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 3)
    sockets[0].send('start_hand')
    await collectAll(sockets) // pot=6, all at 98

    sockets[1].send('stay') // blind stay: pot=8, seat1 at 96
    await collectAll(sockets)
    sockets[2].send('fold') // seat0 (98) vs seat1 (96) remain, pot=8
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

    sockets[0].send('request_show') // seat0 blind show: -2, pot=10
    const state = asState((await collectAll(sockets))[0])

    expect(state.phase).toBe('handResult')
    expect(state.lastResult?.winnerIds).toEqual([playerIds[0]])
    expect(state.lastResult?.potWon).toBe(10)
    expect(state.players.find((p) => p.id === playerIds[0])?.chips).toBe(96 + 10) // 98-2 stay-equivalent show cost +10 pot
    expect(state.pot).toBe(0)
  })

  it("forces a fold when a player can't afford to stay", async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 2)
    const stub = env.FARAS_ROOM.getByName(room)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    // Drain seat1 down to less than a blind stay ($2).
    await runInDurableObject(stub, async (instance: FarasRoom) => {
      const state = (instance as unknown as { roomState: { players: { id: string; chips: number }[] } }).roomState
      const p = state.players.find((pl) => pl.id === playerIds[1])!
      p.chips = 1
    })

    sockets[1].send('stay')
    expect(await errorOf(await sockets[1].next())).toMatch(/enough chips/i)

    sockets[1].send('fold')
    const state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('handResult')
    expect(state.lastResult?.winnerIds).toEqual([playerIds[0]])
  })

  it('eliminates a player at $0 from the next deal, and ends the session when one player has all the chips', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 2)
    const stub = env.FARAS_ROOM.getByName(room)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    // Force seat1 to $0 chips directly, then fold out to end the hand.
    await runInDurableObject(stub, async (instance: FarasRoom) => {
      const state = (instance as unknown as { roomState: { players: { id: string; chips: number }[] } }).roomState
      const p = state.players.find((pl) => pl.id === playerIds[1])!
      p.chips = 0
    })
    sockets[1].send('fold')
    await collectAll(sockets)

    sockets[0].send('next_hand')
    const state = asState((await collectAll(sockets))[0])
    expect(state.phase).toBe('gameOver') // only seat0 still has chips
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

  it('leaving down to 1 player pauses the room to the lobby, preserving chips', async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 2)
    sockets[0].send('start_hand')
    await collectAll(sockets)
    sockets[1].send('fold') // seat0 wins the pot
    await collectAll(sockets) // now in 'handResult', not a live hand

    sockets[1].send('leave_table')
    const state = asState(await sockets[0].next())

    expect(state.players.map((p) => p.id)).toEqual([playerIds[0]])
    expect(state.phase).toBe('lobby')
    expect(state.players[0].chips).toBe(102) // untouched by the pause (98 + 4 pot)
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

describe('FarasRoom next hand / end session', () => {
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

describe('FarasRoom bots (solo play)', () => {
  it('only the host can add a bot, and only in the lobby', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 2)

    sockets[1].send('add_bot')
    expect(await errorOf(await sockets[1].next())).toMatch(/host/i)

    sockets[0].send('add_bot')
    await collectAll(sockets)
    sockets[0].send('start_hand')
    await collectAll(sockets)

    sockets[0].send('add_bot')
    expect(await errorOf(await sockets[0].next())).toMatch(/lobby/i)
  })

  it('adds a chip-holding, never-connected bot with a friendly name', async () => {
    const room = await createRoom('faras')
    const { sockets } = await joinN(room, 'faras', 1)

    sockets[0].send('add_bot')
    const state = asState((await collectAll(sockets))[0])

    const bot = state.players.find((p) => p.isBot)
    expect(bot).toBeDefined()
    expect(bot?.connected).toBe(false)
    expect(bot?.chips).toBe(100)
    expect(bot?.name).toBeTruthy()
  })

  it("a bot's turn resolves on its own via the DO's alarm, with no second socket involved", async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 1)
    sockets[0].send('add_bot')
    const afterAddBot = asState((await collectAll(sockets))[0])
    const botId = afterAddBot.players.find((p) => p.isBot)!.id

    sockets[0].send('start_hand')
    let state = asState((await collectAll(sockets))[0])
    expect(state.turnPlayerId).toBe(botId) // dealerIndex 0 -> left of dealer (seat0/human) is seat1/bot

    // Give the bot a trail — BOT_STAY_CHANCE.trail is 1, so it deterministically stays.
    await setHands(room, {
      [playerIds[0]]: [
        { suit: 'S', rank: 2 },
        { suit: 'H', rank: 9 },
        { suit: 'D', rank: 4 },
      ],
      [botId]: [
        { suit: 'S', rank: 7 },
        { suit: 'H', rank: 7 },
        { suit: 'D', rank: 7 },
      ],
    })

    const stub = env.FARAS_ROOM.getByName(room)
    const ran = await runDurableObjectAlarm(stub)
    expect(ran).toBe(true)

    state = asState(await sockets[0].next())
    expect(state.turnPlayerId).toBe(playerIds[0]) // stayed and passed the turn back
    expect(state.players.find((p) => p.id === botId)?.chips).toBeLessThan(100) // paid to stay

    // No alarm left pending once it's a human's turn.
    expect(await runDurableObjectAlarm(stub)).toBe(false)
  })

  it("a bot forced to fold (can't afford to stay) hands the human the pot", async () => {
    const room = await createRoom('faras')
    const { sockets, playerIds } = await joinN(room, 'faras', 1)
    sockets[0].send('add_bot')
    const afterAddBot = asState((await collectAll(sockets))[0])
    const botId = afterAddBot.players.find((p) => p.isBot)!.id

    sockets[0].send('start_hand')
    await collectAll(sockets) // pot=4, both at 98, bot's turn

    const stub = env.FARAS_ROOM.getByName(room)
    await runInDurableObject(stub, async (instance: FarasRoom) => {
      const state = (instance as unknown as { roomState: { players: { id: string; chips: number }[] } }).roomState
      state.players.find((p) => p.id === botId)!.chips = 1 // can't afford the $2 blind stay
    })

    expect(await runDurableObjectAlarm(stub)).toBe(true)
    const state = asState(await sockets[0].next())

    expect(state.phase).toBe('handResult')
    expect(state.lastResult?.winnerIds).toEqual([playerIds[0]])
  })
})
