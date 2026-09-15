import { DurableObject } from 'cloudflare:workers'
import {
  allBidsMissed,
  DEFAULT_ROUND_COUNT,
  dealNewRound,
  isInstantWin,
  isLegalPlay,
  resolveTrickWinner,
  scoreRoundForPlayers,
  type Card,
  type RoundCount,
  type TrickPlay,
} from '@callbreak/shared-logic'
import type { Env } from './env'
import { RateLimiter } from './rateLimiter'
import { type InboundMessage, parseMessage, send, sendError } from './roomSocket'
import { validateCall, validateCardShape, validateName, validateRoundCount, type ValidationResult } from './validate'

type Phase = 'lobby' | 'bidding' | 'playing' | 'roundEnd' | 'gameOver'

interface Player {
  id: string
  name: string
  seat: number
  connectionId: string | null
  isHost: boolean
}

interface RoundHistoryEntry {
  round: number
  bids: (number | null)[]
  tricksWon: number[]
  points: number[]
}

interface LastTrick {
  cards: TrickPlay[]
  winnerSeat: number
  trickSeq: number
}

interface RoomState {
  code: string
  phase: Phase
  roundCount: RoundCount
  round: number
  dealerSeat: number
  turnSeat: number
  players: (Player | null)[]
  hands: Card[][]
  bids: (number | null)[]
  currentTrick: TrickPlay[]
  tricksWon: number[]
  lastTrick: LastTrick | null
  /** Every card played so far this round (all completed tricks plus the
   * current one), in play order — a "cards tracker" so players can see
   * what's already out. Reset at the start of each round. */
  playedThisRound: TrickPlay[]
  roundHistory: RoundHistoryEntry[]
  totals: number[]
  /** Set when a player calls 8+ and makes it — that seat wins the game
   * outright at the end of this round, regardless of point totals or
   * rounds remaining (Nepali "instant win" rule). */
  instantWinSeat: number | null
  /** Set when every single player misses their call in the same round —
   * "Dhoos Dismiss" forces the game to end right there too, same as
   * reaching the last configured round (no special winner, highest total
   * as usual). */
  dhoosEnd: boolean
  /** The declared winner once phase is 'gameOver': the instant-win seat if
   * one occurred, otherwise whoever has the highest total. */
  winnerSeat: number | null
  createdAt: number
  lastActivityAt: number
}

const STORAGE_KEY = 'state'
const SEAT_COUNT = 4

function initialState(): RoomState {
  return {
    code: '',
    phase: 'lobby',
    roundCount: DEFAULT_ROUND_COUNT,
    round: 0,
    dealerSeat: 0,
    turnSeat: 0,
    players: [null, null, null, null],
    hands: [[], [], [], []],
    bids: [null, null, null, null],
    currentTrick: [],
    tricksWon: [0, 0, 0, 0],
    lastTrick: null,
    playedThisRound: [],
    roundHistory: [],
    totals: [0, 0, 0, 0],
    instantWinSeat: null,
    dhoosEnd: false,
    winnerSeat: null,
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  }
}

function must<T>(result: ValidationResult<T>): T {
  if (!result.ok) throw new Error(result.error)
  return result.value
}

/** Ties broken by lowest seat index — rare with 0.1-granularity scoring. */
function indexOfHighest(values: readonly number[]): number {
  return values.reduce((best, v, i) => (v > values[best] ? i : best), 0)
}

export class GameRoom extends DurableObject<Env> {
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
    // allowUnconfirmed: the platform's output gate would otherwise hold the
    // broadcastState() that follows every persist() call until this write
    // is confirmed durable on disk — fine for correctness, but it puts a
    // storage round trip on the critical path of every single bid/card
    // play/lock. Opting out trades a vanishingly small durability window
    // (a literal crash between the write and its disk confirmation) for
    // lower latency on every real-time action; a reconnecting player is
    // already covered by the existing resync-on-reconnect + periodic
    // request_state poll if that window is ever actually hit.
    await this.ctx.storage.put(STORAGE_KEY, this.roomState, { allowUnconfirmed: true })
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready
    const url = new URL(request.url)

    if (url.pathname === '/meta') {
      const exists = this.roomState.players.some((p) => p !== null)
      return Response.json({ exists })
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

    const player = this.roomState.players.find((p) => p?.connectionId === connectionId)
    if (player) {
      player.connectionId = null
      await this.persist()
      this.broadcastState()
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws)
  }

  // ─── Message handlers ──────────────────────────────────────────────────

  private async handleMessage(ws: WebSocket, connectionId: string, message: InboundMessage): Promise<void> {
    switch (message.type) {
      case 'join':
        return this.handleJoin(connectionId, message.payload)
      case 'rejoin':
        return this.handleRejoin(connectionId, message.payload)
      case 'set_round_count':
        return this.handleSetRoundCount(connectionId, message.payload)
      case 'start_game':
        return this.handleStartGame(connectionId)
      case 'submit_bid':
        return this.handleSubmitBid(connectionId, message.payload)
      case 'play_card':
        return this.handlePlayCard(connectionId, message.payload)
      case 'next_round':
        return this.handleNextRound(connectionId)
      case 'remove_player':
        return this.handleRemovePlayer(connectionId, message.payload)
      case 'request_state':
        this.sendStateTo(ws, connectionId)
        return
      default:
        sendError(ws, `Unknown message type: ${message.type}`)
    }
  }

  private seatOf(connectionId: string): number | null {
    const player = this.roomState.players.find((p) => p?.connectionId === connectionId)
    return player ? player.seat : null
  }

  private playerAt(seat: number): Player {
    const player = this.roomState.players[seat]
    if (!player) throw new Error('Seat is empty.')
    return player
  }

  private requireHost(connectionId: string): Player {
    const seat = this.seatOf(connectionId)
    if (seat === null) throw new Error('You are not in this room.')
    const player = this.playerAt(seat)
    if (!player.isHost) throw new Error('Only the host can do that.')
    return player
  }

  private async handleJoin(connectionId: string, payload: unknown): Promise<void> {
    if (this.roomState.phase !== 'lobby') throw new Error('This game has already started.')

    const body = payload as Record<string, unknown> | undefined
    const name = must(validateName(body?.name))

    const freeSeat = this.roomState.players.findIndex((p) => p === null)
    if (freeSeat === -1) throw new Error('Room is full.')

    const player: Player = {
      id: crypto.randomUUID(),
      name,
      seat: freeSeat,
      connectionId,
      isHost: this.roomState.players.every((p) => p === null),
    }
    this.roomState.players[freeSeat] = player

    await this.persist()
    // broadcastState() already covers the just-joined player (they're in
    // this.roomState.players with a connectionId by now) — no separate
    // sendStateTo needed, that would just double-send them the same state.
    this.broadcastState()
  }

  private async handleRejoin(connectionId: string, payload: unknown): Promise<void> {
    const body = payload as Record<string, unknown> | undefined
    const playerId = typeof body?.playerId === 'string' ? body.playerId : null
    if (!playerId) throw new Error('Missing player id.')

    const player = this.roomState.players.find((p) => p?.id === playerId)
    if (!player) throw new Error('Player not found in this room. Please rejoin.')

    player.connectionId = connectionId
    await this.persist()
    this.broadcastState()
  }

  private async handleSetRoundCount(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('Round count can only be changed in the lobby.')

    const body = payload as Record<string, unknown> | undefined
    this.roomState.roundCount = must(validateRoundCount(body?.roundCount))
    await this.persist()
    this.broadcastState()
  }

  private async handleStartGame(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('The game has already started.')
    if (this.roomState.players.some((p) => p === null)) throw new Error('Call Break needs exactly 4 players.')

    this.dealRound(1, 0)
    await this.persist()
    this.broadcastState()
  }

  private dealRound(round: number, dealerSeat: number): void {
    this.roomState.round = round
    this.roomState.dealerSeat = dealerSeat
    this.roomState.turnSeat = (dealerSeat + 1) % SEAT_COUNT
    this.roomState.hands = dealNewRound()
    this.roomState.bids = [null, null, null, null]
    this.roomState.currentTrick = []
    this.roomState.tricksWon = [0, 0, 0, 0]
    this.roomState.lastTrick = null
    this.roomState.playedThisRound = []
    this.roomState.instantWinSeat = null
    this.roomState.dhoosEnd = false
    this.roomState.phase = 'bidding'
  }

  private async handleSubmitBid(connectionId: string, payload: unknown): Promise<void> {
    const seat = this.seatOf(connectionId)
    if (seat === null) throw new Error('You are not in this room.')
    if (this.roomState.phase !== 'bidding') throw new Error('Bidding is not open right now.')
    if (seat !== this.roomState.turnSeat) throw new Error('It is not your turn to call.')

    const body = payload as Record<string, unknown> | undefined
    const call = must(validateCall(body?.call))

    this.roomState.bids[seat] = call

    if (this.roomState.bids.every((b) => b !== null)) {
      this.roomState.phase = 'playing'
      this.roomState.turnSeat = (this.roomState.dealerSeat + 1) % SEAT_COUNT
    } else {
      this.roomState.turnSeat = (this.roomState.turnSeat + 1) % SEAT_COUNT
    }

    await this.persist()
    this.broadcastState()
  }

  private async handlePlayCard(connectionId: string, payload: unknown): Promise<void> {
    const seat = this.seatOf(connectionId)
    if (seat === null) throw new Error('You are not in this room.')
    if (this.roomState.phase !== 'playing') throw new Error('Card play is not open right now.')
    if (seat !== this.roomState.turnSeat) throw new Error('It is not your turn to play.')

    const body = payload as Record<string, unknown> | undefined
    const card = must(validateCardShape(body?.card))

    const hand = this.roomState.hands[seat]
    const handIndex = hand.findIndex((c) => c.suit === card.suit && c.rank === card.rank)
    if (handIndex === -1) throw new Error("You don't have that card.")

    const trickCards = this.roomState.currentTrick.map((t) => t.card)
    if (!isLegalPlay(hand, trickCards, card)) {
      throw new Error('That card is not legal to play right now.')
    }

    hand.splice(handIndex, 1)
    this.roomState.currentTrick.push({ seat, card })
    this.roomState.playedThisRound.push({ seat, card })

    if (this.roomState.currentTrick.length === SEAT_COUNT) {
      const winnerSeat = resolveTrickWinner(this.roomState.currentTrick)
      this.roomState.tricksWon[winnerSeat]++
      this.roomState.lastTrick = {
        cards: this.roomState.currentTrick,
        winnerSeat,
        trickSeq: (this.roomState.lastTrick?.trickSeq ?? 0) + 1,
      }
      this.roomState.currentTrick = []
      this.roomState.turnSeat = winnerSeat

      const tricksPlayed = this.roomState.tricksWon.reduce((a, b) => a + b, 0)
      if (tricksPlayed === 13) {
        this.finishRound()
      }
    } else {
      this.roomState.turnSeat = (this.roomState.turnSeat + 1) % SEAT_COUNT
    }

    await this.persist()
    this.broadcastState()
  }

  private finishRound(): void {
    const tallies = this.roomState.players.map((p, seat) => ({
      playerId: String(seat),
      call: this.roomState.bids[seat] ?? 0,
      tricksWon: this.roomState.tricksWon[seat],
    }))
    const scored = scoreRoundForPlayers(tallies)

    this.roomState.roundHistory.push({
      round: this.roomState.round,
      bids: [...this.roomState.bids],
      tricksWon: [...this.roomState.tricksWon],
      points: scored.map((s) => s.points),
    })
    scored.forEach((s, seat) => {
      this.roomState.totals[seat] = Math.round((this.roomState.totals[seat] + s.points) * 10) / 10
    })

    const instantWinner = tallies.findIndex((t) => isInstantWin(t.call, t.tricksWon))
    this.roomState.instantWinSeat = instantWinner === -1 ? null : instantWinner
    this.roomState.dhoosEnd = instantWinner === -1 && allBidsMissed(tallies)

    this.roomState.phase = 'roundEnd'
  }

  private async handleNextRound(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'roundEnd') throw new Error('The current round is not finished yet.')

    if (this.roomState.instantWinSeat !== null || this.roomState.dhoosEnd || this.roomState.round >= this.roomState.roundCount) {
      this.roomState.phase = 'gameOver'
      this.roomState.winnerSeat = this.roomState.instantWinSeat ?? indexOfHighest(this.roomState.totals)
    } else {
      this.dealRound(this.roomState.round + 1, (this.roomState.dealerSeat + 1) % SEAT_COUNT)
    }

    await this.persist()
    this.broadcastState()
  }

  private async handleRemovePlayer(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('Players can only be removed from the lobby.')

    const body = payload as Record<string, unknown> | undefined
    const seat = Number(body?.seat)
    if (!Number.isInteger(seat) || seat < 0 || seat >= SEAT_COUNT) throw new Error('Invalid seat.')

    const target = this.roomState.players[seat]
    if (!target) return
    if (target.connectionId !== null) throw new Error('Only a disconnected player can be removed.')

    this.roomState.players[seat] = null
    await this.persist()
    this.broadcastState()
  }

  // ─── Broadcast ─────────────────────────────────────────────────────────

  /** The parts of the redacted state that are identical for every
   * recipient — computed once per broadcast rather than once per
   * connected player. */
  private sharedRedactedFields() {
    const { hands, players, ...publicFields } = this.roomState
    return {
      publicFields,
      players: players.map((p) =>
        p ? { id: p.id, name: p.name, seat: p.seat, connected: p.connectionId !== null, isHost: p.isHost } : null,
      ),
      hands,
      handCounts: hands.map((h) => h.length),
    }
  }

  private redactedStateFor(seat: number | null) {
    const shared = this.sharedRedactedFields()
    return {
      ...shared.publicFields,
      players: shared.players,
      yourSeat: seat,
      yourPlayerId: seat !== null ? (this.roomState.players[seat]?.id ?? null) : null,
      hand: seat !== null ? shared.hands[seat] : [],
      handCounts: shared.handCounts,
    }
  }

  private sendStateTo(ws: WebSocket, connectionId: string): void {
    send(ws, 'state', this.redactedStateFor(this.seatOf(connectionId)))
  }

  private broadcastState(): void {
    const shared = this.sharedRedactedFields()
    for (const player of this.roomState.players) {
      if (!player?.connectionId) continue
      const sockets = this.ctx.getWebSockets(player.connectionId)
      if (sockets.length === 0) continue
      const view = {
        ...shared.publicFields,
        players: shared.players,
        yourSeat: player.seat,
        yourPlayerId: player.id,
        hand: shared.hands[player.seat],
        handCounts: shared.handCounts,
      }
      for (const ws of sockets) {
        send(ws, 'state', view)
      }
    }
  }
}
