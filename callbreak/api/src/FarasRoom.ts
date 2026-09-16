import { DurableObject } from 'cloudflare:workers'
import {
  compareFarasHands,
  dealFaras,
  FARAS_MAX_PLAYERS,
  FARAS_MIN_PLAYERS,
  rankFarasHand,
  type Card,
  type FarasCategory,
} from '@callbreak/shared-logic'
import type { Env } from './env'
import { RateLimiter } from './rateLimiter'
import { type InboundMessage, parseMessage, send, sendError } from './roomSocket'
import { validateName, type ValidationResult } from './validate'

/**
 * Faras (Teen Patti), no chips: 2-10 players, 3 cards each, fold/stay/show,
 * a point per hand won. Unlike GameRoom/ScoreRoom's fixed 4 seats, the
 * roster here is a dynamic array — players can explicitly leave the table
 * (permanent) as distinct from merely disconnecting (temporary, rejoinable,
 * same pattern as the other rooms), and the game just continues with
 * whoever's left as long as at least 2 remain.
 */

type Phase = 'lobby' | 'hand' | 'handResult' | 'gameOver'

interface FarasPlayer {
  id: string
  name: string
  connectionId: string | null
  isHost: boolean
  score: number
}

interface HandPlayerState {
  folded: boolean
  seen: boolean
}

interface LastResult {
  winnerIds: string[]
  /** null for a fold-out win — nobody's hand had to be revealed. */
  category: FarasCategory | null
  revealedHands: Record<string, Card[]>
}

interface RoomState {
  code: string
  phase: Phase
  players: FarasPlayer[] // join order = turn order; 2-10 long, or empty pre-join
  hands: Record<string, Card[]> // playerId -> this hand's 3 cards
  handState: Record<string, HandPlayerState>
  turnPlayerId: string | null
  dealerIndex: number
  lastResult: LastResult | null
  createdAt: number
  lastActivityAt: number
}

const STORAGE_KEY = 'state'

function initialState(): RoomState {
  return {
    code: '',
    phase: 'lobby',
    players: [],
    hands: {},
    handState: {},
    turnPlayerId: null,
    dealerIndex: 0,
    lastResult: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

function must<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.value
}

export class FarasRoom extends DurableObject<Env> {
  private roomState: RoomState = initialState()
  private readonly rateLimiter = new RateLimiter()
  private readonly ready: Promise<void>

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RoomState>(STORAGE_KEY)
      if (stored) this.roomState = stored
    })
  }

  private async persist(): Promise<void> {
    this.roomState.lastActivityAt = Date.now()
    // allowUnconfirmed: see the matching comment in GameRoom.ts — opts this
    // write out of the platform's output gate so broadcastState() doesn't
    // wait on a storage round trip for every fold/stay/ghotchu.
    await this.ctx.storage.put(STORAGE_KEY, this.roomState, { allowUnconfirmed: true })
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready
    const url = new URL(request.url)

    if (url.pathname === '/meta') {
      return Response.json({ exists: this.roomState.players.length > 0 })
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected a WebSocket upgrade', { status: 426 })
    }

    if (!this.roomState.code) {
      this.roomState.code = (url.searchParams.get('room') || '').toUpperCase()
      await this.persist()
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)
    const connectionId = crypto.randomUUID()
    this.ctx.acceptWebSocket(server, [connectionId])
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    await this.ready
    const connectionId = this.ctx.getTags(ws)[0]
    if (!connectionId) return

    const message = parseMessage(raw)
    if (!message) {
      sendError(ws, 'Malformed message.')
      return
    }

    if (!this.rateLimiter.check(connectionId, message.type)) {
      sendError(ws, "Slow down, you're doing that too fast.")
      return
    }

    try {
      await this.handleMessage(ws, connectionId, message)
    } catch (e) {
      sendError(ws, e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.ready
    const connectionId = this.ctx.getTags(ws)[0]
    if (connectionId) this.rateLimiter.cleanup(connectionId)

    const player = this.roomState.players.find((p) => p.connectionId === connectionId)
    if (player) {
      player.connectionId = null
      await this.persist()
      this.broadcastState()
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }

  private async handleMessage(ws: WebSocket, connectionId: string, message: InboundMessage): Promise<void> {
    switch (message.type) {
      case 'join':
        return this.handleJoin(connectionId, message.payload)
      case 'rejoin':
        return this.handleRejoin(connectionId, message.payload)
      case 'remove_player':
        return this.handleRemovePlayer(connectionId, message.payload)
      case 'start_hand':
        return this.handleStartHand(connectionId)
      case 'ghotchu':
        return this.handleGhotchu(connectionId)
      case 'fold':
        return this.handleFoldOrStay(connectionId, true)
      case 'stay':
        return this.handleFoldOrStay(connectionId, false)
      case 'request_show':
        return this.handleRequestShow(connectionId)
      case 'next_hand':
        return this.handleNextHand(connectionId)
      case 'end_session':
        return this.handleEndSession(connectionId)
      case 'leave_table':
        return this.handleLeaveTable(connectionId)
      case 'request_state':
        this.sendStateTo(ws, connectionId)
        return
      default:
        sendError(ws, `Unknown message type: ${message.type}`)
    }
  }

  private playerByConnection(connectionId: string): FarasPlayer {
    const player = this.roomState.players.find((p) => p.connectionId === connectionId)
    if (!player) throw new Error('You are not in this room.')
    return player
  }

  private requireHost(connectionId: string): FarasPlayer {
    const player = this.playerByConnection(connectionId)
    if (!player.isHost) throw new Error('Only the host can do that.')
    return player
  }

  private activePlayerIds(): string[] {
    return this.roomState.players.filter((p) => !this.roomState.handState[p.id]?.folded).map((p) => p.id)
  }

  private nextActivePlayerId(afterId: string): string | null {
    const ids = this.roomState.players.map((p) => p.id)
    const startIdx = ids.indexOf(afterId)
    if (startIdx === -1) return null
    for (let step = 1; step <= ids.length; step++) {
      const candidate = ids[(startIdx + step) % ids.length]
      if (!this.roomState.handState[candidate]?.folded) return candidate
    }
    return null
  }

  private async handleJoin(connectionId: string, payload: unknown): Promise<void> {
    if (this.roomState.phase === 'hand') throw new Error('Wait for the current hand to finish before joining.')
    if (this.roomState.phase === 'gameOver') throw new Error('This session has ended.')
    if (this.roomState.players.length >= FARAS_MAX_PLAYERS) throw new Error(`This table is full (${FARAS_MAX_PLAYERS} max).`)

    const body = payload as Record<string, unknown> | undefined
    const name = must(validateName(body?.name))

    const player: FarasPlayer = {
      id: crypto.randomUUID(),
      name,
      connectionId,
      isHost: this.roomState.players.length === 0,
      score: 0,
    }
    this.roomState.players.push(player)

    await this.persist()
    this.broadcastState()
  }

  private async handleRejoin(connectionId: string, payload: unknown): Promise<void> {
    const body = payload as Record<string, unknown> | undefined
    const playerId = typeof body?.playerId === 'string' ? body.playerId : null
    if (!playerId) throw new Error('Missing player id.')

    const player = this.roomState.players.find((p) => p.id === playerId)
    if (!player) throw new Error('Player not found in this session. Please rejoin.')

    player.connectionId = connectionId
    await this.persist()
    this.broadcastState()
  }

  private async handleRemovePlayer(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('Players can only be removed from the lobby.')

    const body = payload as Record<string, unknown> | undefined
    const playerId = typeof body?.playerId === 'string' ? body.playerId : null
    if (!playerId) throw new Error('Invalid player id.')

    const target = this.roomState.players.find((p) => p.id === playerId)
    if (!target) return
    if (target.connectionId !== null) throw new Error('Only a disconnected player can be removed.')

    this.roomState.players = this.roomState.players.filter((p) => p.id !== playerId)
    await this.persist()
    this.broadcastState()
  }

  private dealHand(): void {
    const n = this.roomState.players.length
    this.roomState.dealerIndex = this.roomState.dealerIndex % n
    const dealt = dealFaras(n)

    const hands: Record<string, Card[]> = {}
    const handState: Record<string, HandPlayerState> = {}
    this.roomState.players.forEach((p, i) => {
      hands[p.id] = dealt[i]
      handState[p.id] = { folded: false, seen: false }
    })

    this.roomState.hands = hands
    this.roomState.handState = handState
    this.roomState.lastResult = null
    this.roomState.turnPlayerId = this.roomState.players[(this.roomState.dealerIndex + 1) % n].id
    this.roomState.phase = 'hand'
  }

  private async handleStartHand(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('A hand is already in progress.')
    if (this.roomState.players.length < FARAS_MIN_PLAYERS) {
      throw new Error(`Faras needs at least ${FARAS_MIN_PLAYERS} players.`)
    }

    this.dealHand()
    await this.persist()
    this.broadcastState()
  }

  private async handleGhotchu(connectionId: string): Promise<void> {
    if (this.roomState.phase !== 'hand') throw new Error('There is no hand in progress.')
    const player = this.playerByConnection(connectionId)
    const hs = this.roomState.handState[player.id]
    if (!hs || hs.folded) throw new Error('You are not in this hand.')

    hs.seen = true
    await this.persist()
    this.broadcastState()
  }

  private resolveHand(winnerIds: string[], category: FarasCategory | null, revealedHands: Record<string, Card[]>): void {
    for (const id of winnerIds) {
      const player = this.roomState.players.find((p) => p.id === id)
      if (player) player.score += 1
    }
    this.roomState.lastResult = { winnerIds, category, revealedHands }
    this.roomState.turnPlayerId = null
    this.roomState.phase = 'handResult'
  }

  private async handleFoldOrStay(connectionId: string, folding: boolean): Promise<void> {
    if (this.roomState.phase !== 'hand') throw new Error('There is no hand in progress.')
    const player = this.playerByConnection(connectionId)
    if (player.id !== this.roomState.turnPlayerId) throw new Error('It is not your turn.')

    if (folding) this.roomState.handState[player.id].folded = true

    const active = this.activePlayerIds()
    if (active.length === 1) {
      this.resolveHand(active, null, {})
    } else {
      this.roomState.turnPlayerId = this.nextActivePlayerId(player.id)
    }

    await this.persist()
    this.broadcastState()
  }

  private async handleRequestShow(connectionId: string): Promise<void> {
    if (this.roomState.phase !== 'hand') throw new Error('There is no hand in progress.')
    const player = this.playerByConnection(connectionId)
    const active = this.activePlayerIds()
    if (active.length !== 2) throw new Error('Show is only available once exactly 2 players are left in the hand.')
    if (!active.includes(player.id)) throw new Error('You have already folded this hand.')

    const [idA, idB] = active
    const handA = this.roomState.hands[idA] as [Card, Card, Card]
    const handB = this.roomState.hands[idB] as [Card, Card, Card]
    const cmp = compareFarasHands(handA, handB)
    const revealedHands = { [idA]: handA, [idB]: handB }
    const category = rankFarasHand(cmp >= 0 ? handA : handB).category
    const winnerIds = cmp === 0 ? [idA, idB] : cmp > 0 ? [idA] : [idB]

    this.resolveHand(winnerIds, category, revealedHands)
    await this.persist()
    this.broadcastState()
  }

  private async handleNextHand(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'handResult') throw new Error('There is no hand result to continue from.')
    if (this.roomState.players.length < FARAS_MIN_PLAYERS) {
      this.roomState.phase = 'lobby'
      await this.persist()
      this.broadcastState()
      return
    }

    this.roomState.dealerIndex += 1
    this.dealHand()
    await this.persist()
    this.broadcastState()
  }

  private async handleEndSession(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase === 'gameOver') throw new Error('This session has already ended.')

    this.roomState.phase = 'gameOver'
    this.roomState.turnPlayerId = null
    await this.persist()
    this.broadcastState()
  }

  /**
   * Explicit, permanent departure — distinct from a disconnect (which just
   * marks connectionId null and stays rejoinable). The game continues with
   * whoever's left as long as at least 2 players remain; otherwise it
   * pauses back to the lobby without losing anyone's score.
   */
  private async handleLeaveTable(connectionId: string): Promise<void> {
    const player = this.playerByConnection(connectionId)
    const wasHost = player.isHost
    const inLiveHand = this.roomState.phase === 'hand'

    let forcedFold = false
    let nextTurnId = this.roomState.turnPlayerId
    if (inLiveHand && !this.roomState.handState[player.id]?.folded) {
      this.roomState.handState[player.id].folded = true
      forcedFold = true
    }
    if (inLiveHand && this.roomState.turnPlayerId === player.id) {
      nextTurnId = this.nextActivePlayerId(player.id)
    }

    this.roomState.players = this.roomState.players.filter((p) => p.id !== player.id)
    delete this.roomState.hands[player.id]
    delete this.roomState.handState[player.id]

    if (wasHost && this.roomState.players.length > 0) {
      this.roomState.players[0].isHost = true
    }

    if (inLiveHand) {
      const active = this.activePlayerIds()
      if (forcedFold && active.length === 1) {
        this.resolveHand(active, null, {})
      } else {
        this.roomState.turnPlayerId = nextTurnId
      }
    }

    if (this.roomState.players.length < FARAS_MIN_PLAYERS) {
      this.roomState.phase = 'lobby'
      this.roomState.hands = {}
      this.roomState.handState = {}
      this.roomState.turnPlayerId = null
      this.roomState.lastResult = null
    }

    await this.persist()
    this.broadcastState()
  }

  // ─── Broadcast ─────────────────────────────────────────────────────────

  private sharedFields() {
    const { hands, players, ...publicFields } = this.roomState
    return {
      publicFields,
      players: players.map((p) => ({ id: p.id, name: p.name, isHost: p.isHost, connected: p.connectionId !== null, score: p.score })),
    }
  }

  private viewFor(playerId: string | null) {
    const shared = this.sharedFields()
    return {
      ...shared.publicFields,
      players: shared.players,
      yourPlayerId: playerId,
      yourHand: playerId ? (this.roomState.hands[playerId] ?? []) : [],
    }
  }

  private sendStateTo(ws: WebSocket, connectionId: string): void {
    const player = this.roomState.players.find((p) => p.connectionId === connectionId)
    send(ws, 'state', this.viewFor(player?.id ?? null))
  }

  private broadcastState(): void {
    const shared = this.sharedFields()
    for (const player of this.roomState.players) {
      if (!player.connectionId) continue
      const sockets = this.ctx.getWebSockets(player.connectionId)
      if (sockets.length === 0) continue
      const view = {
        ...shared.publicFields,
        players: shared.players,
        yourPlayerId: player.id,
        yourHand: this.roomState.hands[player.id] ?? [],
      }
      for (const ws of sockets) {
        send(ws, 'state', view)
      }
    }
  }
}
