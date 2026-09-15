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
 * Locking is deliberate: the host enters a player's call/tricks, locks it
 * in (it stops being editable), moves to the next player, and so on. The
 * round only finalizes once all 4 are locked and the tricks add up to 13 —
 * if they don't, the host has to unlock and fix one before it can finish.
 * There is no casual mid-round editing after a lock; the only way to
 * change an already-recorded round is `edit_round`, and only once the
 * whole session is over (see handleEditRound).
 */
interface PendingEntry {
  call: number | null
  tricksWon: number | null
  locked: boolean
}

function emptyPendingEntries(): PendingEntry[] {
  return Array.from({ length: SEAT_COUNT }, () => ({ call: null, tricksWon: null, locked: false }))
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
    await this.ctx.storage.put(STORAGE_KEY, this.roomState)
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
      case 'lock_entry':
        return this.handleLockEntry(connectionId, message.payload)
      case 'unlock_entry':
        return this.handleUnlockEntry(connectionId, message.payload)
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

  /**
   * Locks in one seat's call + tricks for the round in progress. Once
   * locked, that seat can't be changed except by explicitly unlocking it
   * first (handleUnlockEntry) — there's no casual mid-round editing. Once
   * all 4 seats are locked, the round finalizes automatically as long as
   * the tricks add up to 13; if they don't, everything stays locked as-is
   * and the host has to unlock one seat to fix it (checked client-side —
   * broadcasting the mismatched pendingEntries is itself the signal, not a
   * rejected request, since every individual lock was valid).
   */
  private async handleLockEntry(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'roundEntry') throw new Error('Round entry is not open right now.')

    const body = payload as Record<string, unknown> | undefined
    const seat = Number(body?.seat)
    if (!Number.isInteger(seat) || seat < 0 || seat >= SEAT_COUNT) throw new Error('Invalid seat.')
    if (this.roomState.pendingEntries[seat].locked) {
      throw new Error('That entry is already locked — unlock it first to change it.')
    }

    const call = must(validateCall(body?.call))
    const tricksWon = must(validateTricksWon(body?.tricksWon))
    this.roomState.pendingEntries[seat] = { call, tricksWon, locked: true }

    if (this.roomState.pendingEntries.every((e) => e.locked)) {
      const totalTricks = this.roomState.pendingEntries.reduce((sum, e) => sum + (e.tricksWon ?? 0), 0)
      if (totalTricks === 13) this.finalizeRound()
    }

    await this.persist()
    this.broadcastState()
  }

  private async handleUnlockEntry(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'roundEntry') throw new Error('Round entry is not open right now.')

    const body = payload as Record<string, unknown> | undefined
    const seat = Number(body?.seat)
    if (!Number.isInteger(seat) || seat < 0 || seat >= SEAT_COUNT) throw new Error('Invalid seat.')

    this.roomState.pendingEntries[seat] = { call: null, tricksWon: null, locked: false }
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

  private viewFor(seat: number | null) {
    const { players, ...publicFields } = this.roomState
    return {
      ...publicFields,
      players: players.map((p) =>
        p ? { id: p.id, name: p.name, seat: p.seat, connected: p.connectionId !== null, isHost: p.isHost } : null,
      ),
      yourSeat: seat,
      yourPlayerId: seat !== null ? (players[seat]?.id ?? null) : null,
    }
  }

  private sendStateTo(ws: WebSocket, connectionId: string): void {
    send(ws, 'state', this.viewFor(this.seatOf(connectionId)))
  }

  private broadcastState(): void {
    for (const player of this.roomState.players) {
      if (!player?.connectionId) continue
      const sockets = this.ctx.getWebSockets(player.connectionId)
      for (const ws of sockets) {
        send(ws, 'state', this.viewFor(player.seat))
      }
    }
  }
}
