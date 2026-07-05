/**
 * GameService – pure game logic, no Socket.IO coupling.
 *
 * Responsible for:
 *  - Creating / destroying rooms
 *  - Managing player lifecycle
 *  - Running round logic (role assignment, turn order, scoring)
 *
 * Scalability notes:
 *  - All state is in-process memory. For multi-instance deployments,
 *    replace the `rooms` Map with a Redis adapter.
 *  - The stale-room janitor runs every JANITOR_INTERVAL_MS and evicts
 *    rooms inactive for more than ROOM_TTL_MS.
 */
import { pickWord } from '../config/index.js'
import { logger } from '../utils/logger.js'
import type {
  GamePhase,
  Difficulty,
  PlayerRole,
  PublicPlayer,
  GameState,
  PlayerAssignment,
} from '../../../shared/types/index.js'

// ─── Internal Types ───────────────────────────────────────────────────────────

interface Player {
  id: string
  name: string
  score: number
  isHost: boolean
  connected: boolean
  role: PlayerRole
  hasDone: boolean
}

interface Room {
  code: string
  hostId: string
  phase: GamePhase
  difficulty: Difficulty
  imposterCount: number
  players: Map<string, Player>
  /** Ordered list of socket IDs defining turn sequence */
  playerOrder: string[]
  currentTurnIndex: number
  currentWord: string | null
  round: number
  /** Unix ms timestamp of the last meaningful activity – used for TTL eviction */
  lastActivityAt: number
  /** True once voting has been tallied and scored for this round (idempotency guard) */
  resultRecordedThisRound: boolean
  /** voterId → votedForId, cast during the discussion phase */
  votes: Map<string, string>
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum concurrent rooms (prevents unbounded memory growth) */
const MAX_ROOMS = 500

/** Rooms inactive longer than this are evicted (2 hours) */
const ROOM_TTL_MS = 2 * 60 * 60 * 1_000

/** How often the janitor checks for stale rooms */
const JANITOR_INTERVAL_MS = 15 * 60 * 1_000  // every 15 min

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random 6-character alphanumeric room code */
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // omit confusable chars
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/** Shuffle an array in-place using Fisher-Yates */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Convert internal Player to PublicPlayer (strips role) */
function toPublic(p: Player, room: Room): PublicPlayer {
  return {
    id: p.id,
    name: p.name,
    score: p.score,
    isHost: p.isHost,
    connected: p.connected,
    hasDone: p.hasDone,
    hasVoted: room.votes.has(p.id),
  }
}

// ─── GameService ──────────────────────────────────────────────────────────────

export class GameService {
  /** Map of roomCode → Room */
  private rooms = new Map<string, Room>()

  constructor() {
    // Stale-room janitor: evict rooms idle longer than ROOM_TTL_MS
    setInterval(() => this.evictStaleRooms(), JANITOR_INTERVAL_MS)
  }

  // ── Room lifecycle ──────────────────────────────────────────────────────────

  /**
   * Create a new room. Returns the new room code.
   * Returns null if the server has hit the room cap.
   */
  createRoom(
    hostId: string,
    hostName: string,
    difficulty: Difficulty,
    imposterCount: number,
  ): string | null {
    if (this.rooms.size >= MAX_ROOMS) {
      logger.warn('Room cap reached', { cap: MAX_ROOMS })
      return null
    }

    // Ensure unique room code
    let code = generateRoomCode()
    while (this.rooms.has(code)) {code = generateRoomCode()}

    const host: Player = {
      id: hostId,
      name: hostName,
      score: 0,
      isHost: true,
      connected: true,
      role: 'crewmate',
      hasDone: false,
    }

    const room: Room = {
      code,
      hostId,
      phase: 'lobby',
      difficulty,
      imposterCount: Math.max(1, imposterCount),
      players: new Map([[hostId, host]]),
      playerOrder: [],
      currentTurnIndex: 0,
      currentWord: null,
      round: 0,
      lastActivityAt: Date.now(),
      resultRecordedThisRound: false,
      votes: new Map(),
    }

    this.rooms.set(code, room)
    logger.info('Room created', { roomCode: code, host: hostName })
    return code
  }

  /** Add a player to an existing room. Returns error string or null on success. */
  joinRoom(roomCode: string, playerId: string, playerName: string): string | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return 'Room not found. Check the code and try again.'}
    if (room.phase !== 'lobby') {return 'Game has already started.'}
    if (room.players.size >= 12) {return 'Room is full (max 12 players).'}

    // Check for duplicate names (case-insensitive)
    const nameLower = playerName.trim().toLowerCase()
    for (const p of room.players.values()) {
      if (p.name.toLowerCase() === nameLower) {
        return `Name "${playerName}" is already taken. Choose a different name.`
      }
    }

    room.players.set(playerId, {
      id: playerId,
      name: playerName.trim(),
      score: 0,
      isHost: false,
      connected: true,
      role: 'crewmate',
      hasDone: false,
    })

    room.lastActivityAt = Date.now()
    return null
  }

  /** Remove a player from their room. Returns updated room or null if not found. */
  removePlayer(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) {
        room.players.delete(playerId)
        // Also remove from turn order
        room.playerOrder = room.playerOrder.filter((id) => id !== playerId)
        // Purge any vote cast by this player, and any votes cast FOR this player
        room.votes.delete(playerId)
        for (const [voterId, votedId] of room.votes) {
          if (votedId === playerId) {room.votes.delete(voterId)}
        }
        // Adjust currentTurnIndex if needed
        if (room.currentTurnIndex >= room.playerOrder.length && room.playerOrder.length > 0) {
          room.currentTurnIndex = 0
        }
        // Auto-clamp imposterCount so it never exceeds (playerCount - 1)
        const maxImposters = Math.max(1, room.players.size - 1)
        if (room.imposterCount > maxImposters) {
          room.imposterCount = maxImposters
        }
        if (room.players.size === 0) {
          this.rooms.delete(room.code)
          return null
        }
        return room
      }
    }
    return null
  }

  /** Mark a disconnected player as disconnected (but keep them in the room). */
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

  /**
   * Attempt to rejoin a room by matching name.
   * Reassigns the old player entry to the new socket ID.
   * Returns the room and assignment if successful.
   */
  rejoinRoom(
    newSocketId: string,
    roomCode: string,
    playerName: string,
  ): { room: Room; assignment: PlayerAssignment } | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return null}

    const nameLower = playerName.trim().toLowerCase()
    let foundPlayer: Player | undefined

    for (const [id, player] of room.players) {
      if (player.name.toLowerCase() === nameLower && !player.connected) {
        foundPlayer = player
        // Re-key under new socket ID
        room.players.delete(id)
        foundPlayer.id = newSocketId
        foundPlayer.connected = true
        room.players.set(newSocketId, foundPlayer)
        // Update playerOrder reference
        room.playerOrder = room.playerOrder.map((oid) => (oid === id ? newSocketId : oid))
        if (room.hostId === id) {room.hostId = newSocketId}
        // Remap votes: this player's own vote (key) and any votes cast FOR them (value)
        const remappedVotes = new Map<string, string>()
        for (const [voterId, votedId] of room.votes) {
          const newVoter = voterId === id ? newSocketId : voterId
          const newVoted = votedId === id ? newSocketId : votedId
          remappedVotes.set(newVoter, newVoted)
        }
        room.votes = remappedVotes
        break
      }
    }

    if (!foundPlayer) {return null}

    return {
      room,
      assignment: this.buildAssignment(room, foundPlayer),
    }
  }

  // ── Game control ────────────────────────────────────────────────────────────

  /**
   * Start or restart a round.
   * Picks a word, assigns roles, shuffles turn order.
   * Returns per-player assignments for the socket handler to dispatch privately.
   */
  startRound(roomCode: string): Map<string, PlayerAssignment> | null {
    const room = this.rooms.get(roomCode)
    if (!room) {return null}
    if (room.players.size < 3) {return null}

    room.phase = 'playing'
    room.round += 1
    room.currentWord = pickWord(room.difficulty)
    room.resultRecordedThisRound = false
    room.votes = new Map()
    room.lastActivityAt = Date.now()

    const playerIds = Array.from(room.players.keys())

    // Reset hasDone for all players
    for (const p of room.players.values()) {
      p.hasDone = false
      p.role = 'crewmate'
    }

    // Pick imposters randomly (never pick the host as the only imposter when possible)
    const shuffledIds = shuffle([...playerIds])
    const actualImposterCount = Math.min(room.imposterCount, playerIds.length - 1)
    const imposterIds = new Set(shuffledIds.slice(0, actualImposterCount))

    for (const id of imposterIds) {
      const p = room.players.get(id)
      if (p) {p.role = 'imposter'}
    }

    // Build random turn order starting at index 0
    room.playerOrder = shuffle([...playerIds])
    room.currentTurnIndex = 0

    // Build assignment map for socket handler.
    // SECURITY: handlers.ts strips imposterIds for all non-host sockets before
    // emitting — this map carries the full data only so the handler can selectively
    // send it to the correct socket.
    const assignments = new Map<string, PlayerAssignment>()
    const imposterIdList = Array.from(imposterIds)

    for (const [id, player] of room.players) {
      assignments.set(id, {
        role: player.role,
        word: player.role === 'crewmate' ? room.currentWord : null,
        imposterIds: imposterIdList,
      })
    }

    return assignments
  }

  /**
   * Mark a player as done for the current turn.
   * Advances turn index.
   * Returns { allDone, nextPlayerId } or null on error.
   */
  playerDone(
    roomCode: string,
    playerId: string,
  ): { allDone: boolean; nextPlayerId: string } | null {
    const room = this.rooms.get(roomCode)
    if (!room || room.phase !== 'playing') {return null}

    const player = room.players.get(playerId)
    if (!player) {return null}

    // Only the current turn player can press Done
    const currentId = room.playerOrder[room.currentTurnIndex]
    if (currentId !== playerId) {return null}

    player.hasDone = true
    room.currentTurnIndex++
    room.lastActivityAt = Date.now()

    // Check if all players have gone
    const allDone = room.currentTurnIndex >= room.playerOrder.length

    if (allDone) {
      room.phase = 'discussion'
    }

    const nextPlayerId =
      !allDone && room.currentTurnIndex < room.playerOrder.length
        ? room.playerOrder[room.currentTurnIndex]
        : ''

    return { allDone, nextPlayerId }
  }

  /**
   * Record voting result and update scores.
   * imposterCaught = true  → crewmates each get +1
   * imposterCaught = false → imposters each get +2
   *
   * Idempotency: returns false if a result was already recorded this round.
   * Normally invoked internally by `tallyVotes()`, never directly by a handler.
   */
  recordResult(roomCode: string, imposterCaught: boolean): boolean {
    const room = this.rooms.get(roomCode)
    if (!room) {return false}
    if (room.resultRecordedThisRound) {return false}

    room.resultRecordedThisRound = true
    for (const player of room.players.values()) {
      if (imposterCaught && player.role === 'crewmate') {
        player.score += 1
      } else if (!imposterCaught && player.role === 'imposter') {
        player.score += 2
      }
    }
    room.lastActivityAt = Date.now()
    return true
  }

  // ── In-app voting ────────────────────────────────────────────────────────────

  /**
   * Cast (or change) a vote during the discussion phase.
   * A player may vote for any other connected player as the suspected imposter.
   * Re-submitting overwrites the previous vote (no error) so players can change
   * their mind up until the round is tallied.
   */
  submitVote(
    roomCode: string,
    voterId: string,
    votedPlayerId: string,
  ): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return { ok: false, error: 'Room not found.' }}
    if (room.phase !== 'discussion') {return { ok: false, error: 'Voting is not open right now.' }}
    if (room.resultRecordedThisRound) {
      return { ok: false, error: 'Voting has already ended for this round.' }
    }
    if (!room.players.has(voterId)) {return { ok: false, error: 'You are not part of this room.' }}
    if (!room.players.has(votedPlayerId)) {
      return { ok: false, error: 'That player is not in this room.' }
    }
    if (voterId === votedPlayerId) {return { ok: false, error: 'You cannot vote for yourself.' }}

    room.votes.set(voterId, votedPlayerId)
    room.lastActivityAt = Date.now()
    return { ok: true }
  }

  /** True once every currently-connected player has cast a vote this round. */
  allVotesIn(room: Room): boolean {
    for (const player of room.players.values()) {
      if (player.connected && !room.votes.has(player.id)) {return false}
    }
    return true
  }

  /**
   * Tally votes cast so far, determine who (if anyone) gets ejected, score the
   * round via `recordResult`, and return everything the client needs to render
   * the reveal screen.
   *
   * Ejection rule: the player with the strict majority of votes is ejected.
   * A tie for the top spot (or zero votes) means nobody is ejected, which
   * counts as the imposter(s) surviving.
   *
   * Idempotency: returns null if the round has already been tallied/scored.
   */
  tallyVotes(
    roomCode: string,
  ): {
    imposterCaught: boolean
    ejectedPlayerId: string | null
    ejectedPlayerName: string | null
    voteCounts: Record<string, number>
    votes: Record<string, string>
  } | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return null}
    if (room.resultRecordedThisRound) {return null}

    // Initialize every player at 0 so the client can render a full bar chart,
    // even for players nobody voted for.
    const voteCounts: Record<string, number> = {}
    for (const id of room.players.keys()) {voteCounts[id] = 0}
    for (const votedId of room.votes.values()) {
      if (voteCounts[votedId] !== undefined) {voteCounts[votedId] += 1}
    }

    let maxVotes = 0
    let topCandidates: string[] = []
    for (const [id, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count
        topCandidates = [id]
      } else if (count === maxVotes && count > 0) {
        topCandidates.push(id)
      }
    }

    // Only eject when there's a single, unambiguous top vote-getter
    const ejectedPlayerId = maxVotes > 0 && topCandidates.length === 1 ? topCandidates[0] : null
    const ejectedPlayer = ejectedPlayerId ? room.players.get(ejectedPlayerId) : undefined
    const imposterCaught = !!ejectedPlayer && ejectedPlayer.role === 'imposter'

    // Apply scoring through the existing idempotent path
    this.recordResult(roomCode, imposterCaught)

    return {
      imposterCaught,
      ejectedPlayerId,
      ejectedPlayerName: ejectedPlayer?.name ?? null,
      voteCounts,
      votes: Object.fromEntries(room.votes),
    }
  }

  /** End the game – set phase to 'ended'. */
  endGame(roomCode: string): void {
    const room = this.rooms.get(roomCode)
    if (room) {
      room.phase = 'ended'
      room.lastActivityAt = Date.now()
    }
  }

  /** Reset all scores to 0. */
  resetScores(roomCode: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) {return}
    for (const p of room.players.values()) {p.score = 0}
    room.lastActivityAt = Date.now()
  }

  /** Update room difficulty. Only valid in lobby. */
  setDifficulty(roomCode: string, difficulty: Difficulty): void {
    const room = this.rooms.get(roomCode)
    if (room && room.phase === 'lobby') {
      room.difficulty = difficulty
      room.lastActivityAt = Date.now()
    }
  }

  /** Update imposter count. Only valid in lobby. */
  setImposterCount(roomCode: string, count: number): void {
    const room = this.rooms.get(roomCode)
    if (room && room.phase === 'lobby') {
      const maxImposters = Math.max(1, room.players.size - 1)
      room.imposterCount = Math.min(Math.max(1, count), maxImposters)
      room.lastActivityAt = Date.now()
    }
  }

  // ── State builders ──────────────────────────────────────────────────────────

  /** Build the public GameState to broadcast to all clients in the room. */
  buildGameState(room: Room): GameState {
    const players = Array.from(room.players.values()).map((p) => toPublic(p, room))
    const currentTurnId = room.playerOrder[room.currentTurnIndex] ?? ''
    const currentTurnPlayer = room.players.get(currentTurnId)

    return {
      roomCode: room.code,
      phase: room.phase,
      difficulty: room.difficulty,
      players,
      currentTurnPlayerId: currentTurnId,
      currentTurnName: currentTurnPlayer?.name ?? '',
      currentTurnIndex: room.currentTurnIndex,
      round: room.round,
      imposterCount: room.imposterCount,
      hostId: room.hostId,
    }
  }

  /** Build a PlayerAssignment for an individual player. */
  buildAssignment(room: Room, player: Player): PlayerAssignment {
    const imposterIds = Array.from(room.players.values())
      .filter((p) => p.role === 'imposter')
      .map((p) => p.id)

    return {
      role: player.role,
      word: player.role === 'crewmate' ? room.currentWord : null,
      imposterIds,
    }
  }

  /**
   * Build the base public round reveal payload (word + imposter names + round).
   * The caller (socket handler) merges this with the result of `tallyVotes()`
   * to produce the full `GameReveal` sent to clients.
   */
  buildReveal(
    roomCode: string,
  ): { word: string; imposterNames: string[]; round: number } | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return null}
    const imposterNames = Array.from(room.players.values())
      .filter((p) => p.role === 'imposter')
      .map((p) => p.name)
    return {
      word: room.currentWord ?? '',
      imposterNames,
      round: room.round,
    }
  }

  /**
   * Skip the current player's turn (host action for AFK players).
   * Advances turn index without marking hasDone on the skipped player.
   * Returns the same result shape as playerDone.
   */
  skipTurn(roomCode: string): { allDone: boolean; nextPlayerId: string } | null {
    const room = this.rooms.get(roomCode)
    if (!room || room.phase !== 'playing') {return null}
    if (room.playerOrder.length === 0) {return null}

    room.currentTurnIndex++
    room.lastActivityAt = Date.now()

    const allDone = room.currentTurnIndex >= room.playerOrder.length
    if (allDone) {room.phase = 'discussion'}

    const nextPlayerId =
      !allDone && room.currentTurnIndex < room.playerOrder.length
        ? room.playerOrder[room.currentTurnIndex]
        : ''

    return { allDone, nextPlayerId }
  }

  /** Get room by code (public accessor for handlers). */
  getRoom(roomCode: string): Room | null {
    return this.rooms.get(roomCode.toUpperCase()) ?? null
  }

  /** Find which room a socket ID belongs to. */
  getRoomByPlayerId(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) {return room}
    }
    return null
  }

  /** Current number of active rooms (for monitoring). */
  get roomCount(): number {
    return this.rooms.size
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Evict rooms that have had no activity for longer than ROOM_TTL_MS.
   * Called on a periodic interval to prevent unbounded memory growth.
   */
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
      logger.info('Stale rooms evicted', { count: evicted, remaining: this.rooms.size })
    }
  }
}

// Export a singleton – the same instance is imported by all handlers
export const gameService = new GameService()
