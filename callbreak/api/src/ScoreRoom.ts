import { DurableObject } from 'cloudflare:workers'
import { allBidsMissed, DEFAULT_ROUND_COUNT, isInstantWin, scoreRound, type RoundCount } from '@callbreak/shared-logic'
import type { Env } from './env'
import { RateLimiter } from './rateLimiter'
import { type InboundMessage, parseMessage, send, sendError } from './roomSocket'
import { validateName, validateRoundCount, validateTricksWon, validateCall, type ValidationResult } from './validate'

/**
 * The in-person score-keeper: no cards are dealt or played by the app at
 * all — people play with a physical deck, and the host enters what actually
 * happened at the table each round. Every connected phone sees the same
 * live leaderboard. Much simpler state machine than GameRoom: there is
 * nothing private to redact per player.
 */

type Phase = 'lobby' | 'roundEntry' | 'roundResult' | 'gameOver'

interface Player {
  id: string
  name: string
  seat: number
  connectionId: string | null
  isHost: boolean
}

interface RoundEntry {
  call: number
  tricksWon: number
  points: number
}

/**
 * One seat's not-yet-finalized entry for the round currently being entered.
 * Entry is a guided two-pass flow, same shape as the real game's own
 * bid-then-play phases: every seat's call is asked and locked in turn
 * first, then — once all 4 calls are in — every seat's tricks won is asked
 * and locked in turn. Each lock is deliberate and final until explicitly
 * unlocked; there is no casual mid-round editing after a lock. The round
 * only finalizes once all 4 tricks are locked and add up to 13 (the client
 * caps each pick at what's still available, so in practice this always
 * holds by the last seat). The only way to change an already-recorded
 * round is `edit_round`, and only once the whole session is over (see
 * handleEditRound).
 */
interface PendingEntry {
  call: number | null
  callLocked: boolean
  tricksWon: number | null
  tricksLocked: boolean
}

function emptyPendingEntries(): PendingEntry[] {
  return Array.from({ length: SEAT_COUNT }, () => ({ call: null, callLocked: false, tricksWon: null, tricksLocked: false }))
}

interface RoomState {
  code: string
  phase: Phase
  roundCount: RoundCount
  round: number // rounds completed so far
  players: (Player | null)[]
  pendingEntries: PendingEntry[] // this round's in-progress, seat-locked entries
  history: RoundEntry[][] // [roundIndex][seat]
  totals: number[]
  /** Set when a player calls 8+ and makes it — that seat wins outright at
   * the end of this round, regardless of point totals or rounds remaining
   * (Nepali "instant win" rule). */
  instantWinSeat: number | null
  /** Set when every single player misses their call in the same round —
   * "Dhoos Dismiss" forces the session to end right there too, same as
   * reaching the last configured round. */
  dhoosEnd: boolean
  /** The declared winner once phase is 'gameOver'. */
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
    players: [null, null, null, null],
    pendingEntries: emptyPendingEntries(),
    history: [],
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

interface RawRoundEntryInput {
  seat: number
  call: number
  tricksWon: number
}

export class ScoreRoom extends DurableObject<Env> {
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
    // wait on a storage round trip for every lock/unlock/edit.
    await this.ctx.storage.put(STORAGE_KEY, this.roomState, { allowUnconfirmed: true })
  }

  async fetch(request: Request): Promise<Response> {
    await this.ready
    const url = new URL(request.url)

    if (url.pathname === '/meta') {
      return Response.json({ exists: this.roomState.players.some((p) => p !== null) })
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

  private async handleMessage(ws: WebSocket, connectionId: string, message: InboundMessage): Promise<void> {
    switch (message.type) {
      case 'join':
        return this.handleJoin(connectionId, message.payload)
      case 'rejoin':
        return this.handleRejoin(connectionId, message.payload)
      case 'add_player':
        return this.handleAddPlayer(connectionId, message.payload)
      case 'set_round_count':
        return this.handleSetRoundCount(connectionId, message.payload)
      case 'start_game':
        return this.handleStartGame(connectionId)
      case 'lock_call':
        return this.handleLockCall(connectionId, message.payload)
      case 'unlock_call':
        return this.handleUnlockCall(connectionId, message.payload)
      case 'lock_tricks':
        return this.handleLockTricks(connectionId, message.payload)
      case 'unlock_tricks':
        return this.handleUnlockTricks(connectionId, message.payload)
      case 'continue':
        return this.handleContinue(connectionId)
      case 'edit_round':
        return this.handleEditRound(connectionId, message.payload)
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

  private requireHost(connectionId: string): Player {
    const seat = this.seatOf(connectionId)
    const player = seat !== null ? this.roomState.players[seat] : null
    if (!player) throw new Error('You are not in this room.')
    if (!player.isHost) throw new Error('Only the host can do that.')
    return player
  }

  private async handleJoin(connectionId: string, payload: unknown): Promise<void> {
    if (this.roomState.phase !== 'lobby') throw new Error('This session has already started.')

    const body = payload as Record<string, unknown> | undefined
    const name = must(validateName(body?.name))

    const freeSeat = this.roomState.players.findIndex((p) => p === null)
    if (freeSeat === -1) throw new Error('This session already has 4 players.')

    const player: Player = {
      id: crypto.randomUUID(),
      name,
      seat: freeSeat,
      connectionId,
      isHost: this.roomState.players.every((p) => p === null),
    }
    this.roomState.players[freeSeat] = player

    await this.persist()
    // broadcastState() already covers the just-joined player — no separate
    // sendStateTo needed, that would just double-send them the same state.
    this.broadcastState()
  }

  /**
   * Host adds a player by name only, with no connection of their own — the
   * usual case for this feature: one person runs the whole session on their
   * phone and everyone else just plays with a physical deck. A name-only
   * seat is indistinguishable from a disconnected one (`connected: false`),
   * so it can still be edited via `remove_player` if the host mistypes a
   * name, and nothing else needs to special-case it.
   */
  private async handleAddPlayer(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('Players can only be added in the lobby.')

    const body = payload as Record<string, unknown> | undefined
    const name = must(validateName(body?.name))

    const freeSeat = this.roomState.players.findIndex((p) => p === null)
    if (freeSeat === -1) throw new Error('This session already has 4 players.')

    this.roomState.players[freeSeat] = {
      id: crypto.randomUUID(),
      name,
      seat: freeSeat,
      connectionId: null,
      isHost: false,
    }

    await this.persist()
    this.broadcastState()
  }

  private async handleRejoin(connectionId: string, payload: unknown): Promise<void> {
    const body = payload as Record<string, unknown> | undefined
    const playerId = typeof body?.playerId === 'string' ? body.playerId : null
    if (!playerId) throw new Error('Missing player id.')

    const player = this.roomState.players.find((p) => p?.id === playerId)
    if (!player) throw new Error('Player not found in this session. Please rejoin.')

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
    if (this.roomState.phase !== 'lobby') throw new Error('This session has already started.')
    if (this.roomState.players.some((p) => p === null)) throw new Error('Call Break needs exactly 4 players.')

    this.roomState.pendingEntries = emptyPendingEntries()
    this.roomState.phase = 'roundEntry'
    await this.persist()
    this.broadcastState()
  }

  private seatFromPayload(payload: unknown): number {
    const body = payload as Record<string, unknown> | undefined
    const seat = Number(body?.seat)
    if (!Number.isInteger(seat) || seat < 0 || seat >= SEAT_COUNT) throw new Error('Invalid seat.')
    return seat
  }

  private allCallsLocked(): boolean {
    return this.roomState.pendingEntries.every((e) => e.callLocked)
  }

  /**
   * Pass 1 of round entry: lock in one seat's call. Once every seat's call
   * is locked, the round moves on to pass 2 (tricks) automatically — there
   * is no separate "phase" field for this, the client derives which pass
   * it's in from whether every call is locked yet.
   */
  private async handleLockCall(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'roundEntry') throw new Error('Round entry is not open right now.')
    if (this.allCallsLocked()) throw new Error('Every call is already locked in for this round.')

    const seat = this.seatFromPayload(payload)
    const entry = this.roomState.pendingEntries[seat]
    if (entry.callLocked) throw new Error('That call is already locked in — unlock it first to change it.')

    const body = payload as Record<string, unknown> | undefined
    const call = must(validateCall(body?.call))
    this.roomState.pendingEntries[seat] = { ...entry, call, callLocked: true }

    await this.persist()
    this.broadcastState()
  }

  private async handleUnlockCall(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'roundEntry') throw new Error('Round entry is not open right now.')

    const seat = this.seatFromPayload(payload)
    const entry = this.roomState.pendingEntries[seat]
    if (entry.tricksLocked) throw new Error('Unlock the tricks entry first before changing the call.')

    this.roomState.pendingEntries[seat] = { call: null, callLocked: false, tricksWon: null, tricksLocked: false }
    await this.persist()
    this.broadcastState()
  }

  /**
   * Pass 2: lock in one seat's tricks won, only once every seat's call is
   * already locked. Once all 4 are locked, the round finalizes automatically
   * as long as the tricks add up to 13; the client caps each pick at
   * what's still available so this holds by construction, but the check
   * stays here too since the server never trusts client-side arithmetic.
   */
  private async handleLockTricks(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'roundEntry') throw new Error('Round entry is not open right now.')
    if (!this.allCallsLocked()) throw new Error("Lock in everyone's call before entering tricks won.")

    const seat = this.seatFromPayload(payload)
    const entry = this.roomState.pendingEntries[seat]
    if (entry.tricksLocked) throw new Error('That entry is already locked — unlock it first to change it.')

    const body = payload as Record<string, unknown> | undefined
    const tricksWon = must(validateTricksWon(body?.tricksWon))
    this.roomState.pendingEntries[seat] = { ...entry, tricksWon, tricksLocked: true }

    if (this.roomState.pendingEntries.every((e) => e.tricksLocked)) {
      const totalTricks = this.roomState.pendingEntries.reduce((sum, e) => sum + (e.tricksWon ?? 0), 0)
      if (totalTricks === 13) this.finalizeRound()
    }

    await this.persist()
    this.broadcastState()
  }

  private async handleUnlockTricks(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'roundEntry') throw new Error('Round entry is not open right now.')

    const seat = this.seatFromPayload(payload)
    const entry = this.roomState.pendingEntries[seat]
    this.roomState.pendingEntries[seat] = { ...entry, tricksWon: null, tricksLocked: false }
    await this.persist()
    this.broadcastState()
  }

  private finalizeRound(): void {
    const entries = this.roomState.pendingEntries
    const roundResult: RoundEntry[] = entries.map((e) => ({
      call: e.call!,
      tricksWon: e.tricksWon!,
      points: scoreRound(e.call!, e.tricksWon!),
    }))

    this.roomState.history.push(roundResult)
    roundResult.forEach((r, seat) => {
      this.roomState.totals[seat] = Math.round((this.roomState.totals[seat] + r.points) * 10) / 10
    })
    this.roomState.round += 1

    const instantWinner = entries.findIndex((e) => isInstantWin(e.call!, e.tricksWon!))
    this.roomState.instantWinSeat = instantWinner === -1 ? null : instantWinner
    this.roomState.dhoosEnd =
      instantWinner === -1 && allBidsMissed(entries.map((e) => ({ call: e.call!, tricksWon: e.tricksWon! })))

    this.roomState.phase = 'roundResult'
  }

  private async handleContinue(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'roundResult') throw new Error('There is no round result to continue from.')

    if (this.roomState.instantWinSeat !== null || this.roomState.dhoosEnd || this.roomState.round >= this.roomState.roundCount) {
      this.roomState.phase = 'gameOver'
      this.roomState.winnerSeat = this.roomState.instantWinSeat ?? indexOfHighest(this.roomState.totals)
    } else {
      this.roomState.pendingEntries = emptyPendingEntries()
      this.roomState.phase = 'roundEntry'
    }
    await this.persist()
    this.broadcastState()
  }

  /**
   * Post-game correction: once the session is fully over, the host can go
   * back and fix a past round if it was entered wrong (a miscount noticed
   * later, say). This is the *only* way to change a round after it was
   * locked in — never mid-session. Recomputes that round's points and every
   * player's cumulative total from scratch. An instant-win ending is left
   * alone — that's a fact about what happened at the table, not something a
   * stats correction should undo — but the winner is recomputed from the
   * corrected totals when the session ended normally.
   */
  private async handleEditRound(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'gameOver') {
      throw new Error('Rounds can only be corrected after the session is complete.')
    }

    const body = payload as Record<string, unknown> | undefined
    const roundNumber = Number(body?.round)
    if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > this.roomState.history.length) {
      throw new Error('Invalid round number.')
    }

    const rawEntries = body?.entries
    if (!Array.isArray(rawEntries) || rawEntries.length !== SEAT_COUNT) {
      throw new Error('Expected an entry for all 4 players.')
    }

    const bySeat: RawRoundEntryInput[] = new Array(SEAT_COUNT)
    for (const raw of rawEntries) {
      const entry = raw as Record<string, unknown>
      const seat = Number(entry?.seat)
      if (!Number.isInteger(seat) || seat < 0 || seat >= SEAT_COUNT) throw new Error('Invalid seat in entry.')
      if (bySeat[seat]) throw new Error('Duplicate seat in entries.')
      bySeat[seat] = {
        seat,
        call: must(validateCall(entry?.call)),
        tricksWon: must(validateTricksWon(entry?.tricksWon)),
      }
    }
    if (bySeat.some((e) => !e)) throw new Error('Missing an entry for one of the seats.')

    const totalTricks = bySeat.reduce((sum, e) => sum + e.tricksWon, 0)
    if (totalTricks !== 13) throw new Error(`Tricks won must add up to 13 across all 4 players (got ${totalTricks}).`)

    this.roomState.history[roundNumber - 1] = bySeat.map((e) => ({
      call: e.call,
      tricksWon: e.tricksWon,
      points: scoreRound(e.call, e.tricksWon),
    }))

    const totals = [0, 0, 0, 0]
    for (const round of this.roomState.history) {
      round.forEach((r, seat) => {
        totals[seat] = Math.round((totals[seat] + r.points) * 10) / 10
      })
    }
    this.roomState.totals = totals

    if (this.roomState.instantWinSeat === null) {
      this.roomState.winnerSeat = indexOfHighest(this.roomState.totals)
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

  /** The parts of the view that are identical for every recipient —
   * computed once per broadcast rather than once per connected player. */
  private sharedViewFields() {
    const { players, ...publicFields } = this.roomState
    return {
      publicFields,
      players: players.map((p) =>
        p ? { id: p.id, name: p.name, seat: p.seat, connected: p.connectionId !== null, isHost: p.isHost } : null,
      ),
    }
  }

  private viewFor(seat: number | null) {
    const shared = this.sharedViewFields()
    return {
      ...shared.publicFields,
      players: shared.players,
      yourSeat: seat,
      yourPlayerId: seat !== null ? (this.roomState.players[seat]?.id ?? null) : null,
    }
  }

  private sendStateTo(ws: WebSocket, connectionId: string): void {
    send(ws, 'state', this.viewFor(this.seatOf(connectionId)))
  }

  private broadcastState(): void {
    const shared = this.sharedViewFields()
    for (const player of this.roomState.players) {
      if (!player?.connectionId) continue
      const sockets = this.ctx.getWebSockets(player.connectionId)
      if (sockets.length === 0) continue
      const view = {
        ...shared.publicFields,
        players: shared.players,
        yourSeat: player.seat,
        yourPlayerId: player.id,
      }
      for (const ws of sockets) {
        send(ws, 'state', view)
      }
    }
  }
}
