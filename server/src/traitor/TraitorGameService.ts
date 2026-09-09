/**
 * TraitorGameService – pure game logic for the Traitor game, no Socket.IO
 * coupling. Structurally mirrors `server/src/game/GameService.ts` but is a
 * completely separate instance (its own `rooms` Map + janitor) so it can never
 * interfere with the Imposter game.
 *
 * Round flow (in-person adaptation of findthetraitor.com):
 *   lobby → answering → discussion → voting → roundResult → (loop) → ended
 *
 *  - answering: each player privately picks another player as their answer to
 *    their prompt (Detectives share one question; the Traitor has a different
 *    one). Only `hasAnswered` is public.
 *  - discussion: all picks revealed at once; the group talks in person.
 *  - voting: one locked accusation vote each (no self-vote).
 *  - roundResult: reveal the Traitor + both prompts, apply scores.
 *
 * All state is in-process memory (same scalability caveat as GameService).
 */
import { pickPrompt, CATEGORIES, isValidCategory } from './config.js'
import { logger } from '../utils/logger.js'
import type {
  TraitorPhase,
  TraitorRole,
  RoundOutcome,
  TotalRounds,
  TraitorPublicPlayer,
  TraitorGameState,
  RoundAssignment,
  TraitorRoundResult,
  TraitorScoreLine,
} from '../../../shared/types/traitor.js'

// ─── Internal types ──────────────────────────────────────────────────────────

interface Player {
  id: string
  name: string
  avatar: string
  score: number
  isHost: boolean
  connected: boolean
  /** Lobby readiness (host is always ready). */
  ready: boolean
  /** Role for the current round. */
  role: TraitorRole
  /** This player's prompt for the current round. */
  prompt: string
  /** Who this player picked as their answer this round (null until they answer). */
  pick: string | null
  /** Points earned in the most recently finished round. */
  lastRoundPoints: number
  /** Prose rows explaining `lastRoundPoints` (rebuilt each round, no ballot data). */
  lastRoundBreakdown: string[]
  /** Round number this player was last the Traitor (0 = never) — spreads the role. */
  lastTraitorRound: number
}

interface Room {
  code: string
  hostId: string
  phase: TraitorPhase
  category: string
  totalRounds: TotalRounds
  /** 1-based number of the round in progress (0 in the lobby). */
  round: number
  players: Map<string, Player>
  /** The Detectives' shared question this round. */
  detectivePrompt: string
  /** The Traitor's (different) question this round. */
  traitorPrompt: string
  /** Socket id of this round's Traitor. */
  traitorId: string
  /** voterId → accused playerId, cast during the current voting phase. */
  votes: Map<string, string>
  /** Set once the current round is decided; null mid-round. */
  roundOutcome: RoundOutcome | null
  /** Cached full result of the most recently finished round. */
  lastResult: TraitorRoundResult | null
  lastActivityAt: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_ROOMS = 500
const ROOM_TTL_MS = 2 * 60 * 60 * 1_000
const JANITOR_INTERVAL_MS = 15 * 60 * 1_000
const MIN_PLAYERS = 3
const MAX_PLAYERS = 12
const VALID_TOTAL_ROUNDS: ReadonlySet<number> = new Set([3, 5, 8])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {code += chars[Math.floor(Math.random() * chars.length)]}
  return code
}

/** Weighted random sampling without replacement (higher weight → more likely). */
function weightedSample<T>(pool: T[], weightOf: (item: T) => number, count: number): T[] {
  const items = [...pool]
  const weights = items.map((it) => Math.max(0.0001, weightOf(it)))
  const picked: T[] = []
  while (picked.length < count && items.length > 0) {
    const total = weights.reduce((s, w) => s + w, 0)
    let r = Math.random() * total
    let idx = 0
    for (; idx < items.length; idx++) {
      r -= weights[idx]
      if (r <= 0) {break}
    }
    if (idx >= items.length) {idx = items.length - 1}
    picked.push(items[idx])
    items.splice(idx, 1)
    weights.splice(idx, 1)
  }
  return picked
}

function toPublic(p: Player, room: Room): TraitorPublicPlayer {
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    score: p.score,
    isHost: p.isHost,
    connected: p.connected,
    ready: p.ready,
    hasAnswered: p.pick !== null,
    hasVoted: room.votes.has(p.id),
    lastRoundPoints: p.lastRoundPoints,
  }
}

function makePlayer(id: string, name: string, avatar: string, isHost: boolean): Player {
  return {
    id,
    name,
    avatar,
    score: 0,
    isHost,
    connected: true,
    ready: isHost,
    role: 'detective',
    prompt: '',
    pick: null,
    lastRoundPoints: 0,
    lastRoundBreakdown: [],
    lastTraitorRound: 0,
  }
}

// ─── TraitorGameService ──────────────────────────────────────────────────────

export class TraitorGameService {
  private rooms = new Map<string, Room>()

  constructor() {
    setInterval(() => this.evictStaleRooms(), JANITOR_INTERVAL_MS)
  }

  // ── Room lifecycle ─────────────────────────────────────────────────────────

  createRoom(
    hostId: string,
    hostName: string,
    avatar: string,
    category: string,
    totalRounds: number,
  ): string | null {
    if (this.rooms.size >= MAX_ROOMS) {
      logger.warn('Traitor room cap reached', { cap: MAX_ROOMS })
      return null
    }

    let code = generateRoomCode()
    while (this.rooms.has(code)) {code = generateRoomCode()}

    const cat = isValidCategory(category) ? category : CATEGORIES[0]
    const rounds = (VALID_TOTAL_ROUNDS.has(totalRounds) ? totalRounds : 5) as TotalRounds

    const room: Room = {
      code,
      hostId,
      phase: 'lobby',
      category: cat,
      totalRounds: rounds,
      round: 0,
      players: new Map([[hostId, makePlayer(hostId, hostName, avatar, true)]]),
      detectivePrompt: '',
      traitorPrompt: '',
      traitorId: '',
      votes: new Map(),
      roundOutcome: null,
      lastResult: null,
      lastActivityAt: Date.now(),
    }

    this.rooms.set(code, room)
    return code
  }

  joinRoom(
    roomCode: string,
    playerId: string,
    playerName: string,
    avatar: string,
  ): string | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return 'Room not found. Check the code and try again.'}
    if (room.phase !== 'lobby') {return 'This game has already started.'}
    if (room.players.size >= MAX_PLAYERS) {return `Room is full (max ${MAX_PLAYERS} players).`}

    const nameLower = playerName.trim().toLowerCase()
    for (const p of room.players.values()) {
      if (p.name.toLowerCase() === nameLower) {
        return `Name "${playerName}" is already taken. Choose a different name.`
      }
    }

    room.players.set(playerId, makePlayer(playerId, playerName.trim(), avatar, false))
    room.lastActivityAt = Date.now()
    return null
  }

  removePlayer(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (!room.players.has(playerId)) {continue}

      room.players.delete(playerId)
      room.votes.delete(playerId)
      for (const [voterId, votedId] of room.votes) {
        if (votedId === playerId) {room.votes.delete(voterId)}
      }
      // Clear any pick that pointed at the departed player.
      for (const p of room.players.values()) {
        if (p.pick === playerId) {p.pick = null}
      }

      if (room.players.size === 0) {
        this.rooms.delete(room.code)
        return null
      }
      return room
    }
    return null
  }

  removeOfflinePlayer(
    roomCode: string,
    hostId: string,
    targetId: string,
  ): { ok: true; room: Room | null } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return { ok: false, error: 'Room not found.' }}
    if (room.hostId !== hostId) {return { ok: false, error: 'Only the host can remove players.' }}

    const target = room.players.get(targetId)
    if (!target) {return { ok: false, error: 'That player is no longer in the room.' }}
    if (target.id === room.hostId) {return { ok: false, error: 'The host cannot be removed.' }}
    if (target.connected) {
      return { ok: false, error: 'That player is online. You can only remove offline players.' }
    }
    if (room.phase !== 'lobby' && room.phase !== 'roundResult' && room.players.size - 1 < MIN_PLAYERS) {
      return {
        ok: false,
        error: `Removing them would leave fewer than ${MIN_PLAYERS} players. End the session instead.`,
      }
    }

    return { ok: true, room: this.removePlayer(targetId) }
  }

  setPlayerConnected(playerId: string, connected: boolean): Room | null {
    for (const room of this.rooms.values()) {
      const player = room.players.get(playerId)
      if (player) {
        player.connected = connected
        return room
      }
    }
    return null
  }

  rejoinRoom(
    newSocketId: string,
    roomCode: string,
    playerName: string,
  ): { room: Room; assignment: RoundAssignment | null } | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return null}

    const nameLower = playerName.trim().toLowerCase()
    let found: Player | undefined

    for (const [id, player] of room.players) {
      if (player.name.toLowerCase() !== nameLower || player.connected) {continue}
      found = player
      room.players.delete(id)
      found.id = newSocketId
      found.connected = true
      room.players.set(newSocketId, found)
      if (room.hostId === id) {room.hostId = newSocketId}
      if (room.traitorId === id) {room.traitorId = newSocketId}
      // Remap votes (this player's own + any cast for them) and picks.
      const remapped = new Map<string, string>()
      for (const [voterId, votedId] of room.votes) {
        remapped.set(voterId === id ? newSocketId : voterId, votedId === id ? newSocketId : votedId)
      }
      room.votes = remapped
      for (const p of room.players.values()) {
        if (p.pick === id) {p.pick = newSocketId}
      }
      break
    }

    if (!found) {return null}
    return { room, assignment: this.buildAssignment(room, found) }
  }

  // ── Lobby settings ─────────────────────────────────────────────────────────

  setReady(roomCode: string, playerId: string, ready: boolean): Room | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room || room.phase !== 'lobby') {return null}
    const player = room.players.get(playerId)
    if (!player) {return null}
    player.ready = player.isHost ? true : ready
    room.lastActivityAt = Date.now()
    return room
  }

  setCategory(roomCode: string, category: string): void {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (room && room.phase === 'lobby' && isValidCategory(category)) {
      room.category = category
      room.lastActivityAt = Date.now()
    }
  }

  setTotalRounds(roomCode: string, totalRounds: number): void {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (room && room.phase === 'lobby' && VALID_TOTAL_ROUNDS.has(totalRounds)) {
      room.totalRounds = totalRounds as TotalRounds
      room.lastActivityAt = Date.now()
    }
  }

  // ── Round control ──────────────────────────────────────────────────────────

  /**
   * Start the next round: pick a fresh prompt pair, assign exactly one Traitor
   * (weighted so the role spreads), clear picks/votes, phase → 'answering'.
   * Returns per-player assignments for the socket handler to dispatch privately,
   * or null if the room can't start a round.
   */
  startRound(roomCode: string): Map<string, RoundAssignment> | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return null}
    if (room.players.size < MIN_PLAYERS) {return null}
    if (room.phase !== 'lobby' && room.phase !== 'roundResult') {return null}
    if (room.round >= room.totalRounds) {return null}

    const pair = pickPrompt(room.category)
    room.phase = 'answering'
    room.round += 1
    room.detectivePrompt = pair.detective
    room.traitorPrompt = pair.traitor
    room.votes = new Map()
    room.roundOutcome = null
    room.lastResult = null
    room.lastActivityAt = Date.now()

    const players = Array.from(room.players.values())
    for (const p of players) {
      p.role = 'detective'
      p.prompt = pair.detective
      p.pick = null
    }

    // ── Weighted Traitor selection ──────────────────────────────────────────
    const prevRound = room.round - 1
    let candidates = players
    const withoutRecent = players.filter((p) => p.lastTraitorRound !== prevRound || prevRound <= 0)
    if (withoutRecent.length >= 1 && withoutRecent.length < players.length) {
      candidates = withoutRecent
    }
    const weightOf = (p: Player): number => {
      if (p.lastTraitorRound === 0) {return room.round + 3}
      return Math.max(1, room.round - p.lastTraitorRound)
    }
    const [traitor] = weightedSample(candidates, weightOf, 1)
    traitor.role = 'traitor'
    traitor.prompt = pair.traitor
    traitor.lastTraitorRound = room.round
    room.traitorId = traitor.id

    const assignments = new Map<string, RoundAssignment>()
    for (const [id, player] of room.players) {
      assignments.set(id, { role: player.role, prompt: player.prompt })
    }
    return assignments
  }

  /**
   * Lock in a player's answer (which other player they picked). One per round.
   */
  submitAnswer(
    roomCode: string,
    voterId: string,
    pickedPlayerId: string,
  ): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return { ok: false, error: 'Room not found.' }}
    if (room.phase !== 'answering') {return { ok: false, error: 'Answers are not open right now.' }}

    const player = room.players.get(voterId)
    const target = room.players.get(pickedPlayerId)
    if (!player) {return { ok: false, error: 'You are not part of this room.' }}
    if (player.pick !== null) {return { ok: false, error: 'Your answer is locked in for this round.' }}
    if (!target) {return { ok: false, error: 'That player is not in this room.' }}
    if (voterId === pickedPlayerId) {return { ok: false, error: 'Pick someone other than yourself.' }}

    player.pick = pickedPlayerId
    room.lastActivityAt = Date.now()
    return { ok: true }
  }

  answerProgress(room: Room): { answeredCount: number; activeCount: number } {
    let answeredCount = 0
    let activeCount = 0
    for (const p of room.players.values()) {
      activeCount += 1
      if (p.pick !== null) {answeredCount += 1}
    }
    return { answeredCount, activeCount }
  }

  /** True once every connected player has locked in an answer. */
  allAnswersIn(room: Room): boolean {
    for (const p of room.players.values()) {
      if (p.connected && p.pick === null) {return false}
    }
    return true
  }

  /**
   * Move answering → discussion (all picks now public). Any player who never
   * answered simply has no pick on the board. Returns the room or null.
   */
  revealAnswers(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room || room.phase !== 'answering') {return null}
    room.phase = 'discussion'
    room.lastActivityAt = Date.now()
    return room
  }

  /** Host opens the accusation vote: discussion → voting. */
  openVote(roomCode: string): Room | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room || room.phase !== 'discussion') {return null}
    room.phase = 'voting'
    room.lastActivityAt = Date.now()
    return room
  }

  /**
   * Cast (lock) an accusation vote. One per round, no self-vote.
   */
  submitVote(
    roomCode: string,
    voterId: string,
    votedPlayerId: string,
  ): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return { ok: false, error: 'Room not found.' }}
    if (room.phase !== 'voting') {return { ok: false, error: 'Voting is not open right now.' }}

    const voter = room.players.get(voterId)
    const target = room.players.get(votedPlayerId)
    if (!voter) {return { ok: false, error: 'You are not part of this room.' }}
    if (room.votes.has(voterId)) {return { ok: false, error: 'Your vote is locked in.' }}
    if (!target) {return { ok: false, error: 'That player is not in this room.' }}
    if (voterId === votedPlayerId) {return { ok: false, error: 'You cannot vote for yourself.' }}

    room.votes.set(voterId, votedPlayerId)
    room.lastActivityAt = Date.now()
    return { ok: true }
  }

  voteProgress(room: Room): { votedCount: number; activeCount: number } {
    let votedCount = 0
    let activeCount = 0
    for (const p of room.players.values()) {
      activeCount += 1
      if (room.votes.has(p.id)) {votedCount += 1}
    }
    return { votedCount, activeCount }
  }

  /** True once every connected player has voted. */
  allVotesIn(room: Room): boolean {
    for (const p of room.players.values()) {
      if (p.connected && !room.votes.has(p.id)) {return false}
    }
    return true
  }

  /** Anonymous tally: playerId → number of accusation votes received. */
  private tallyCounts(room: Room): Map<string, number> {
    const counts = new Map<string, number>()
    for (const [, targetId] of room.votes) {
      if (!room.players.has(targetId)) {continue}
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1)
    }
    return counts
  }

  /**
   * Decide the round outcome from the votes:
   *  - unique top-voted player IS the Traitor → 'detectives'
   *  - tie for top / top is a Detective / no votes → 'traitor' (survives)
   */
  private decideOutcome(room: Room, counts: Map<string, number>): RoundOutcome {
    let maxVotes = 0
    let top: string[] = []
    for (const [id, c] of counts) {
      if (c > maxVotes) {maxVotes = c; top = [id]}
      else if (c === maxVotes) {top.push(id)}
    }
    if (maxVotes === 0 || top.length !== 1) {return 'traitor'}
    return top[0] === room.traitorId ? 'detectives' : 'traitor'
  }

  /**
   * Score a finished round (once). Per player:
   *  - Detective who voted the actual Traitor: +2
   *  - Each Detective on a round win (Traitor caught): +3
   *  - Traitor on surviving the round: +5
   *  - Caught Traitor / losing Detective: 0 (never negative)
   */
  private applyRoundScore(room: Room, outcome: RoundOutcome): void {
    for (const p of room.players.values()) {
      const rows: string[] = []
      let pts = 0

      if (p.role === 'traitor') {
        if (outcome === 'traitor') {
          pts += 5
          rows.push('Got away with it  +5')
        }
      } else {
        if (room.votes.get(p.id) === room.traitorId) {
          pts += 2
          rows.push('Fingered the Traitor  +2')
        }
        if (outcome === 'detectives') {
          pts += 3
          rows.push('Caught the Traitor  +3')
        }
      }

      p.lastRoundPoints = pts
      p.lastRoundBreakdown = rows
      p.score += pts
    }
  }

  /**
   * Tally the accusation vote and finish the round: decide the outcome, apply
   * scores, phase → 'roundResult'. Returns the full result, or null if there's
   * nothing to tally.
   */
  tallyRound(roomCode: string): TraitorRoundResult | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room || room.phase !== 'voting' || room.roundOutcome) {return null}

    const counts = this.tallyCounts(room)
    const outcome = this.decideOutcome(room, counts)
    room.roundOutcome = outcome
    this.applyRoundScore(room, outcome)
    room.phase = 'roundResult'
    room.lastActivityAt = Date.now()
    room.lastResult = this.buildRoundResult(room)
    return room.lastResult
  }

  /** Host ends the whole session early. */
  endGame(roomCode: string): void {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (room) {
      room.phase = 'ended'
      room.lastActivityAt = Date.now()
    }
  }

  /** Re-check whether a departure stranded the session (dropped below min). */
  resolveIfDeparturesEndedGame(roomCode: string): boolean {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return false}
    if (room.phase === 'lobby' || room.phase === 'ended') {return false}
    if (room.players.size >= MIN_PLAYERS) {return false}
    room.phase = 'ended'
    room.lastActivityAt = Date.now()
    return true
  }

  // ── State builders ─────────────────────────────────────────────────────────

  buildGameState(room: Room): TraitorGameState {
    const players = Array.from(room.players.values()).map((p) => toPublic(p, room))
    const showPicks =
      room.phase === 'discussion' || room.phase === 'voting' || room.phase === 'roundResult'
    const picks: Record<string, string> = {}
    if (showPicks) {
      for (const p of room.players.values()) {
        if (p.pick) {picks[p.id] = p.pick}
      }
    }
    return {
      roomCode: room.code,
      phase: room.phase,
      category: room.category,
      totalRounds: room.totalRounds,
      round: room.round,
      players,
      picks,
      roundOutcome: room.roundOutcome,
      hostId: room.hostId,
    }
  }

  buildAssignment(room: Room, player: Player): RoundAssignment | null {
    if (room.phase === 'lobby' || !player.prompt) {return null}
    return { role: player.role, prompt: player.prompt }
  }

  buildRoundResult(room: Room): TraitorRoundResult {
    const players = Array.from(room.players.values())
    const traitor = room.players.get(room.traitorId)
    const counts = this.tallyCounts(room)

    const picks: Record<string, string> = {}
    for (const p of players) {
      if (p.pick) {picks[p.id] = p.pick}
    }

    const scores: TraitorScoreLine[] = players
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        points: p.lastRoundPoints,
        total: p.score,
        wasTraitor: p.id === room.traitorId,
        pointsBreakdown: [...p.lastRoundBreakdown],
      }))
      .sort((a, b) => b.total - a.total || b.points - a.points)

    return {
      round: room.round,
      totalRounds: room.totalRounds,
      outcome: room.roundOutcome ?? 'traitor',
      traitorId: room.traitorId,
      traitorName: traitor?.name ?? '?',
      detectivePrompt: room.detectivePrompt,
      traitorPrompt: room.traitorPrompt,
      picks,
      voteCounts: Object.fromEntries(counts),
      scores,
      sessionOver: room.round >= room.totalRounds,
    }
  }

  getLastResult(roomCode: string): TraitorRoundResult | null {
    return this.rooms.get(roomCode.toUpperCase())?.lastResult ?? null
  }

  getRoom(roomCode: string): Room | null {
    return this.rooms.get(roomCode.toUpperCase()) ?? null
  }

  getRoomByPlayerId(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) {return room}
    }
    return null
  }

  get roomCount(): number {
    return this.rooms.size
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private evictStaleRooms(): void {
    const cutoff = Date.now() - ROOM_TTL_MS
    let evicted = 0
    for (const [code, room] of this.rooms) {
      if (room.lastActivityAt < cutoff) {
        this.rooms.delete(code)
        evicted++
      }
    }
    if (evicted > 0) {
      logger.info('Stale traitor rooms evicted', { count: evicted, remaining: this.rooms.size })
    }
  }
}

/** Singleton – imported by the traitor socket handlers. */
export const traitorGameService = new TraitorGameService()

export { MIN_PLAYERS as TRAITOR_MIN_PLAYERS, MAX_PLAYERS as TRAITOR_MAX_PLAYERS }
