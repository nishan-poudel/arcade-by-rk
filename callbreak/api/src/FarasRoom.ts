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
 * Faras (Teen Patti): 2-10 players, 3 cards each. Two modes, chosen by the
 * host before the first hand:
 *  - 'betting': real stakes — $100 starting chips, a boot every hand, Stay
 *    costs the boot (blind) or double (once you've Ghotchu'd/seen), Show
 *    costs the same and is only available between the last 2, the winner
 *    takes the whole pot. Hitting $0 puts you out of future hands; the
 *    session ends when only one player still has chips.
 *  - 'show': no betting, no folding, no turns at all — everyone can
 *    Ghotchu whenever they like and the host reveals every hand at once
 *    for comparison; the best hand gets a point.
 * Unlike GameRoom/ScoreRoom's fixed 4 seats, the roster here is a dynamic
 * array — players can explicitly leave the table (permanent) as distinct
 * from merely disconnecting (temporary, rejoinable), and the game just
 * continues with whoever's left as long as at least 2 remain.
 */

type Phase = 'lobby' | 'hand' | 'handResult' | 'gameOver'
type FarasMode = 'betting' | 'show'

interface FarasPlayer {
  id: string
  name: string
  connectionId: string | null
  isHost: boolean
  /** Betting mode currency. Always present, only meaningful in that mode. */
  chips: number
  /** Show mode's running total. Always present, only meaningful in that mode. */
  score: number
  /** Bots always have connectionId: null and act on their own turn via the
   * DO's alarm (see currentTurnBot/syncBotAlarm) instead of a message from
   * a client — no socket involved at all. */
  isBot: boolean
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
  /** Betting mode only: the pot the winner(s) just split. */
  potWon?: number
}

interface RoomState {
  code: string
  phase: Phase
  mode: FarasMode
  players: FarasPlayer[] // join order = turn order; 2-10 long, or empty pre-join
  hands: Record<string, Card[]> // playerId -> this hand's 3 cards
  handState: Record<string, HandPlayerState>
  turnPlayerId: string | null
  dealerIndex: number
  /** Betting mode only. */
  pot: number
  /** Betting mode only: this hand's boot/base bet unit — fixed for the
   * whole hand since there's no raising in v1. */
  stake: number
  lastResult: LastResult | null
  createdAt: number
  lastActivityAt: number
}

const STORAGE_KEY = 'state'
const STARTING_CHIPS = 100
const BOOT_AMOUNT = 2
/** How long a bot "thinks" before acting on its own turn — purely pacing,
 * randomized within a range so a run of decisions doesn't feel like a
 * metronome. */
const BOT_THINK_MS_MIN = 1100
const BOT_THINK_MS_MAX = 2400
const BOT_NAME_POOL = ['Kancha Bot', 'Kanchi Bot', 'Bhai Bot', 'Didi Bot']

/** Blind means genuinely uninformed — a bot hasn't looked, so (like a real
 * player) its blind decision can't be driven by hand strength. A blind
 * Stay is also half the price of a seen one, so the rational default is to
 * ride it out most of the time rather than fold cheap bets at random. */
const BOT_BLIND_BASE_STAY = 0.8

/** Once a bot has actually looked (Ghotchu), it plays its real hand
 * strength — the same category-tier lookup a simple rule-based card-game
 * bot typically leans on instead of full hand-equity math. Calibrated so a
 * bare high card is usually let go and anything pair-or-better is usually
 * defended, with pot odds/table-size/bankroll adjustments layered on top
 * in botDecideAndAct(). */
const BOT_SEEN_STAY_CHANCE: Record<FarasCategory, number> = {
  trail: 1,
  pureSequence: 0.95,
  sequence: 0.8,
  color: 0.62,
  pair: 0.4,
  highCard: 0.15,
}

/** Chance a bot peeks (Ghotchu) before deciding, given how much the
 * required bet already eats into its stack — a cautious player is far more
 * likely to check their cards once a blind bet stops being pocket change,
 * not on a flat coin flip every single turn. */
function botPeekChance(betFraction: number): number {
  return Math.min(0.85, 0.25 + betFraction * 1.5)
}

function initialState(): RoomState {
  return {
    code: '',
    phase: 'lobby',
    mode: 'betting',
    players: [],
    hands: {},
    handState: {},
    turnPlayerId: null,
    dealerIndex: 0,
    pot: 0,
    stake: BOOT_AMOUNT,
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
      case 'add_bot':
        return this.handleAddBot(connectionId)
      case 'set_mode':
        return this.handleSetMode(connectionId, message.payload)
      case 'start_hand':
        return this.handleStartHand(connectionId)
      case 'ghotchu':
        return this.handleGhotchu(connectionId)
      case 'fold':
        return this.handleFold(connectionId)
      case 'stay':
        return this.handleStay(connectionId)
      case 'request_show':
        return this.handleRequestShow(connectionId)
      case 'reveal_all':
        return this.handleRevealAll(connectionId)
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

  /** Players who can be dealt into the next hand — everyone in show mode,
   * only chip-holders in betting mode (a $0 player is out until the
   * session ends). */
  private eligiblePlayers(): FarasPlayer[] {
    return this.roomState.mode === 'show' ? this.roomState.players : this.roomState.players.filter((p) => p.chips > 0)
  }

  /** Who's still in the *current* hand — derived from handState (only
   * players actually dealt this hand appear there at all), not the full
   * roster, so eliminated/ineligible players are never candidates. */
  private activePlayerIds(): string[] {
    return Object.keys(this.roomState.handState).filter((id) => !this.roomState.handState[id].folded)
  }

  private nextActivePlayerId(afterId: string): string | null {
    const ids = this.roomState.players.map((p) => p.id).filter((id) => this.roomState.handState[id])
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
      chips: STARTING_CHIPS,
      score: 0,
      isBot: false,
    }
    this.roomState.players.push(player)

    await this.finishTurn()
  }

  /** Adds a bot for solo/short-handed play — no connection, ever; it acts
   * on its own turn via the DO's alarm (see botDecideAndAct/alarm). */
  private async handleAddBot(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('Bots can only be added in the lobby.')
    if (this.roomState.players.length >= FARAS_MAX_PLAYERS) throw new Error(`This table is full (${FARAS_MAX_PLAYERS} max).`)

    const botCount = this.roomState.players.filter((p) => p.isBot).length
    const name =
      botCount < BOT_NAME_POOL.length ? BOT_NAME_POOL[botCount] : `${BOT_NAME_POOL[botCount % BOT_NAME_POOL.length]} ${botCount + 1}`

    const bot: FarasPlayer = {
      id: crypto.randomUUID(),
      name,
      connectionId: null,
      isHost: this.roomState.players.length === 0,
      chips: STARTING_CHIPS,
      score: 0,
      isBot: true,
    }
    this.roomState.players.push(bot)

    await this.finishTurn()
  }

  private async handleRejoin(connectionId: string, payload: unknown): Promise<void> {
    const body = payload as Record<string, unknown> | undefined
    const playerId = typeof body?.playerId === 'string' ? body.playerId : null
    if (!playerId) throw new Error('Missing player id.')

    const player = this.roomState.players.find((p) => p.id === playerId)
    if (!player) throw new Error('Player not found in this session. Please rejoin.')

    player.connectionId = connectionId
    await this.finishTurn()
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
    await this.finishTurn()
  }

  private async handleSetMode(connectionId: string, payload: unknown): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('Mode can only be changed in the lobby.')

    const body = payload as Record<string, unknown> | undefined
    const mode = body?.mode
    if (mode !== 'betting' && mode !== 'show') throw new Error('Invalid mode.')

    this.roomState.mode = mode
    await this.finishTurn()
  }

  private dealHand(): void {
    const eligible = this.eligiblePlayers()
    const n = eligible.length
    this.roomState.dealerIndex = this.roomState.dealerIndex % n
    const dealt = dealFaras(n)

    const hands: Record<string, Card[]> = {}
    const handState: Record<string, HandPlayerState> = {}
    eligible.forEach((p, i) => {
      hands[p.id] = dealt[i]
      handState[p.id] = { folded: false, seen: false }
    })

    this.roomState.hands = hands
    this.roomState.handState = handState
    this.roomState.lastResult = null

    if (this.roomState.mode === 'betting') {
      this.roomState.stake = BOOT_AMOUNT
      this.roomState.pot = 0
      for (const p of eligible) {
        const boot = Math.min(BOOT_AMOUNT, p.chips)
        p.chips -= boot
        this.roomState.pot += boot
      }
      this.roomState.turnPlayerId = eligible[(this.roomState.dealerIndex + 1) % n].id
    } else {
      this.roomState.turnPlayerId = null
    }

    this.roomState.phase = 'hand'
  }

  private async handleStartHand(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'lobby') throw new Error('A hand is already in progress.')
    if (this.roomState.players.length < FARAS_MIN_PLAYERS) {
      throw new Error(`Faras needs at least ${FARAS_MIN_PLAYERS} players.`)
    }

    this.dealHand()
    await this.finishTurn()
  }

  private async handleGhotchu(connectionId: string): Promise<void> {
    if (this.roomState.phase !== 'hand') throw new Error('There is no hand in progress.')
    const player = this.playerByConnection(connectionId)
    const hs = this.roomState.handState[player.id]
    if (!hs || hs.folded) throw new Error('You are not in this hand.')

    hs.seen = true
    await this.finishTurn()
  }

  private resolveHand(winnerIds: string[], category: FarasCategory | null, revealedHands: Record<string, Card[]>): void {
    if (this.roomState.mode === 'betting') {
      const share = Math.floor((this.roomState.pot / winnerIds.length) * 100) / 100
      for (const id of winnerIds) {
        const player = this.roomState.players.find((p) => p.id === id)
        if (player) player.chips += share
      }
      const remainder = Math.round((this.roomState.pot - share * winnerIds.length) * 100) / 100
      if (remainder > 0) {
        const firstWinner = this.roomState.players.find((p) => p.id === winnerIds[0])
        if (firstWinner) firstWinner.chips += remainder
      }
      this.roomState.lastResult = { winnerIds, category, revealedHands, potWon: this.roomState.pot }
      this.roomState.pot = 0
    } else {
      for (const id of winnerIds) {
        const player = this.roomState.players.find((p) => p.id === id)
        if (player) player.score += 1
      }
      this.roomState.lastResult = { winnerIds, category, revealedHands }
    }
    this.roomState.turnPlayerId = null
    this.roomState.phase = 'handResult'
  }

  private advanceTurnOrResolve(afterId: string): void {
    const active = this.activePlayerIds()
    if (active.length === 1) {
      this.resolveHand(active, null, {})
    } else {
      this.roomState.turnPlayerId = this.nextActivePlayerId(afterId)
    }
  }

  /** The Stay/Show cost for a player right now: the hand's stake, doubled
   * once they've Ghotchu'd — the real rule's core idea (seeing costs
   * more) without a variable player-chosen raise range. */
  private requiredBet(playerId: string): number {
    const seen = this.roomState.handState[playerId]?.seen ?? false
    return seen ? this.roomState.stake * 2 : this.roomState.stake
  }

  private async handleFold(connectionId: string): Promise<void> {
    if (this.roomState.phase !== 'hand') throw new Error('There is no hand in progress.')
    const player = this.playerByConnection(connectionId)
    if (player.id !== this.roomState.turnPlayerId) throw new Error('It is not your turn.')

    this.roomState.handState[player.id].folded = true
    this.advanceTurnOrResolve(player.id)

    await this.finishTurn()
  }

  private async handleStay(connectionId: string): Promise<void> {
    if (this.roomState.phase !== 'hand') throw new Error('There is no hand in progress.')
    const player = this.playerByConnection(connectionId)
    if (player.id !== this.roomState.turnPlayerId) throw new Error('It is not your turn.')

    if (this.roomState.mode === 'betting') {
      const bet = this.requiredBet(player.id)
      if (player.chips < bet) throw new Error("You don't have enough chips to stay — fold instead.")
      player.chips -= bet
      this.roomState.pot += bet
    }

    this.advanceTurnOrResolve(player.id)

    await this.finishTurn()
  }

  private async handleRequestShow(connectionId: string): Promise<void> {
    if (this.roomState.phase !== 'hand') throw new Error('There is no hand in progress.')
    const player = this.playerByConnection(connectionId)
    const active = this.activePlayerIds()
    if (active.length !== 2) throw new Error('Show is only available once exactly 2 players are left in the hand.')
    if (!active.includes(player.id)) throw new Error('You have already folded this hand.')

    if (this.roomState.mode === 'betting') {
      const bet = this.requiredBet(player.id)
      if (player.chips < bet) throw new Error("You don't have enough chips to call for a show.")
      player.chips -= bet
      this.roomState.pot += bet
    }

    const [idA, idB] = active
    const handA = this.roomState.hands[idA] as [Card, Card, Card]
    const handB = this.roomState.hands[idB] as [Card, Card, Card]
    const cmp = compareFarasHands(handA, handB)
    const revealedHands = { [idA]: handA, [idB]: handB }
    const category = rankFarasHand(cmp >= 0 ? handA : handB).category
    const winnerIds = cmp === 0 ? [idA, idB] : cmp > 0 ? [idA] : [idB]

    this.resolveHand(winnerIds, category, revealedHands)
    await this.finishTurn()
  }

  /** Show mode only: host reveals every dealt hand at once and the best
   * one (ties split) wins the point. No turns, no folding, so every id in
   * `hands` is always "in" for this comparison. */
  private async handleRevealAll(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.mode !== 'show') throw new Error('This action is only available in Show Mode.')
    if (this.roomState.phase !== 'hand') throw new Error('There is no hand in progress.')

    const ids = Object.keys(this.roomState.hands)
    const revealedHands: Record<string, Card[]> = {}
    for (const id of ids) revealedHands[id] = this.roomState.hands[id]

    let bestIds: string[] = [ids[0]]
    for (const id of ids.slice(1)) {
      const cmp = compareFarasHands(
        this.roomState.hands[id] as [Card, Card, Card],
        this.roomState.hands[bestIds[0]] as [Card, Card, Card],
      )
      if (cmp > 0) bestIds = [id]
      else if (cmp === 0) bestIds.push(id)
    }
    const category = rankFarasHand(this.roomState.hands[bestIds[0]] as [Card, Card, Card]).category

    this.resolveHand(bestIds, category, revealedHands)
    await this.finishTurn()
  }

  private async handleNextHand(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase !== 'handResult') throw new Error('There is no hand result to continue from.')

    if (this.roomState.players.length < FARAS_MIN_PLAYERS) {
      this.roomState.phase = 'lobby'
      await this.finishTurn()
      return
    }

    if (this.roomState.mode === 'betting' && this.eligiblePlayers().length < FARAS_MIN_PLAYERS) {
      this.roomState.phase = 'gameOver'
      await this.finishTurn()
      return
    }

    this.roomState.dealerIndex += 1
    this.dealHand()
    await this.finishTurn()
  }

  private async handleEndSession(connectionId: string): Promise<void> {
    this.requireHost(connectionId)
    if (this.roomState.phase === 'gameOver') throw new Error('This session has already ended.')

    this.roomState.phase = 'gameOver'
    this.roomState.turnPlayerId = null
    await this.finishTurn()
  }

  /**
   * Explicit, permanent departure — distinct from a disconnect (which just
   * marks connectionId null and stays rejoinable). The game continues with
   * whoever's left as long as at least 2 remain; otherwise it pauses back
   * to the lobby without losing anyone's chips/score.
   */
  private async handleLeaveTable(connectionId: string): Promise<void> {
    const player = this.playerByConnection(connectionId)
    const wasHost = player.isHost
    const inLiveHand = this.roomState.phase === 'hand'

    let forcedFold = false
    let nextTurnId = this.roomState.turnPlayerId
    if (inLiveHand && this.roomState.handState[player.id] && !this.roomState.handState[player.id].folded) {
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
      this.roomState.pot = 0
    }

    await this.finishTurn()
  }

  // ─── Bots ──────────────────────────────────────────────────────────────

  /** The bot whose turn it is right now, if any — only meaningful mid-hand
   * in betting mode, since Show Mode has no turns at all. */
  private currentTurnBot(): FarasPlayer | null {
    if (this.roomState.phase !== 'hand' || this.roomState.mode !== 'betting') return null
    if (!this.roomState.turnPlayerId) return null
    const player = this.roomState.players.find((p) => p.id === this.roomState.turnPlayerId)
    return player?.isBot ? player : null
  }

  /** Keeps the DO's alarm in sync with whether it's currently a bot's
   * turn — schedules one if so, cancels any pending one otherwise, so a
   * stale alarm never fires after the hand's already moved on some other
   * way (a human folding/staying, leaving, the hand resolving, etc). */
  private async syncBotAlarm(): Promise<void> {
    if (this.currentTurnBot()) {
      const thinkMs = BOT_THINK_MS_MIN + Math.random() * (BOT_THINK_MS_MAX - BOT_THINK_MS_MIN)
      await this.ctx.storage.setAlarm(Date.now() + thinkMs)
    } else {
      await this.ctx.storage.deleteAlarm()
    }
  }

  /** Common tail for every mutating handler: keep the bot alarm in sync,
   * persist, then broadcast — one place instead of threading the alarm
   * sync through each handler by hand. */
  private async finishTurn(): Promise<void> {
    await this.syncBotAlarm()
    await this.persist()
    this.broadcastState()
  }

  /** A medium-skill opponent, not a Teen Patti solver: a rule-based tier
   * lookup plus a few situational adjustments, the same shape most simple
   * card-game bots use (hand-strength tier -> pot odds / stack pressure /
   * table size modifiers -> a probabilistic decision, not a hard cutoff).
   * Folds outright if it can't afford to stay — the same rule a human is
   * held to. Never proactively calls Show; a human at the table can always
   * do that once eligible. */
  private botDecideAndAct(bot: FarasPlayer): void {
    const hs = this.roomState.handState[bot.id]
    if (!hs) return

    const bet = this.requiredBet(bot.id)
    const betFraction = bet / Math.max(bot.chips, 1)

    if (!hs.seen && Math.random() < botPeekChance(betFraction)) hs.seen = true

    // Blind is genuinely uninformed — no category to look up — so it plays
    // the odds of a cheap blind bet instead of (unknown-to-it) hand
    // strength. Only once seen does actual hand strength drive the call.
    const category = hs.seen
      ? rankFarasHand(this.roomState.hands[bot.id] as [Card, Card, Card]).category
      : null
    let stayChance = category ? BOT_SEEN_STAY_CHANCE[category] : BOT_BLIND_BASE_STAY

    if (category) {
      // Pot odds: a fat pot relative to the cost of staying is worth
      // chasing looser, same reasoning a human calls "pot odds."
      const potOdds = this.roomState.pot / Math.max(bet, 1)
      if (potOdds >= 4) stayChance = Math.min(1, stayChance + 0.1)
    }

    // Short-handed looseness: fewer opponents left in the hand means a
    // marginal hand is more likely to actually be best.
    if (this.activePlayerIds().length <= 2) stayChance = Math.min(1, stayChance + 0.12)

    // Bankroll caution: don't let a bet that would burn a big chunk of the
    // stack slide by on autopilot — unless the hand is strong enough that
    // folding it would never be right regardless of stack size.
    const nearNuts = category === 'trail' || category === 'pureSequence'
    if (betFraction > 0.4 && !nearNuts) stayChance *= 0.5

    stayChance = Math.min(1, Math.max(0, stayChance))

    const canAfford = bot.chips >= bet
    const wantsToStay = canAfford && Math.random() < stayChance

    if (wantsToStay) {
      bot.chips -= bet
      this.roomState.pot += bet
    } else {
      hs.folded = true
    }
    this.advanceTurnOrResolve(bot.id)
  }

  /** Runs when a bot's scheduled "thinking" time is up — see
   * syncBotAlarm(). No client, no socket, no message: the DO wakes
   * itself and acts on the bot's behalf. */
  async alarm(): Promise<void> {
    await this.ready
    const bot = this.currentTurnBot()
    if (!bot) return // state moved on since this alarm was scheduled
    this.botDecideAndAct(bot)
    await this.finishTurn()
  }

  // ─── Broadcast ─────────────────────────────────────────────────────────

  private sharedFields() {
    const { hands, players, ...publicFields } = this.roomState
    return {
      publicFields,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost,
        connected: p.connectionId !== null,
        chips: p.chips,
        score: p.score,
        isBot: p.isBot,
      })),
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
