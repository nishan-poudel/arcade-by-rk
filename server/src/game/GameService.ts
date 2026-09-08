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
  GameOutcome,
  PublicPlayer,
  GameState,
  PlayerAssignment,
  VoteRoundRecord,
  GameResult,
  GameScoreLine,
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
  /** Voted out this game — spectating, cannot vote or be voted for */
  eliminated: boolean
  /** Voting round in which this player was ejected (0 = still in) */
  eliminatedInRound: number
  /**
   * How many voting rounds this game the player (as a crewmate) voted for an
   * actual imposter. Tracked live (never exposed) and turned into "deduction"
   * points at game end.
   */
  correctVotes: number
  /** Points earned in the most recently finished game */
  lastGamePoints: number
  /**
   * Human-readable rows explaining `lastGamePoints` (e.g. "Survived to the win
   * +3"). Rebuilt each time a game is scored. Contains no ballot data.
   */
  lastGameBreakdown: string[]
  /**
   * The round number in which this player was last the imposter (0 = never).
   * Used to weight imposter selection so the same person isn't picked over
   * and over — recent imposters are strongly de-prioritised, and whoever
   * was the imposter in the immediately previous round is skipped entirely
   * whenever the pool is big enough to allow it.
   */
  lastImposterRound: number
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
  /** Decoy word shown only to the imposter(s) this round (may be null) */
  currentHint: string | null
  /** Game number — increments each time the host starts a fresh word */
  round: number
  /** Which voting round the current game is on (1-based; 0 before discussion) */
  voteRound: number
  /**
   * Completed voting rounds this game — who was ejected (or null on a tie) and
   * anonymous per-player vote counts. Never any voter→target mapping.
   */
  voteHistory: VoteRoundRecord[]
  /** Set once the current game is decided; null while a game is in progress */
  gameOutcome: GameOutcome | null
  /** Cached full result of the most recently finished game */
  lastResult: GameResult | null
  /** Unix ms timestamp of the last meaningful activity – used for TTL eviction */
  lastActivityAt: number
  /** voterId → votedForId, cast during the current voting round */
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

/**
 * Pick `count` distinct items from `pool` using the given positive weights
 * (weighted random sampling without replacement). Higher weight → more likely
 * to be picked. Falls back gracefully if `count` >= pool size.
 */
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
    eliminated: p.eliminated,
    eliminatedInRound: p.eliminatedInRound,
    lastGamePoints: p.lastGamePoints,
  }
}

/** Players still in the current game (not voted out). */
function activePlayers(room: Room): Player[] {
  return Array.from(room.players.values()).filter((p) => !p.eliminated)
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
      eliminated: false,
      eliminatedInRound: 0,
      correctVotes: 0,
      lastGamePoints: 0,
      lastGameBreakdown: [],
      lastImposterRound: 0,
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
      currentHint: null,
      round: 0,
      voteRound: 0,
      voteHistory: [],
      gameOutcome: null,
      lastResult: null,
      lastActivityAt: Date.now(),
      votes: new Map(),
    }

    this.rooms.set(code, room)
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
      eliminated: false,
      eliminatedInRound: 0,
      correctVotes: 0,
      lastGamePoints: 0,
      lastGameBreakdown: [],
      lastImposterRound: 0,
    })

    room.lastActivityAt = Date.now()
    return null
  }

  /** Remove a player from their room. Returns updated room or null if not found. */
  removePlayer(playerId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.players.has(playerId)) {
        // Remember who is currently "up" so their turn survives the reindex
        // when a player earlier in the order is spliced out mid-round.
        const activeTurnId = room.playerOrder[room.currentTurnIndex]
        const removedIdx = room.playerOrder.indexOf(playerId)

        room.players.delete(playerId)
        // Also remove from turn order
        room.playerOrder = room.playerOrder.filter((id) => id !== playerId)
        // Purge any vote cast by this player, and any votes cast FOR this player
        room.votes.delete(playerId)
        for (const [voterId, votedId] of room.votes) {
          if (votedId === playerId) {room.votes.delete(voterId)}
        }
        // Keep currentTurnIndex pointing at the same active player. If the
        // active player themselves was removed, or the index now runs past the
        // end, fall back to clamping.
        if (activeTurnId && activeTurnId !== playerId) {
          const newIdx = room.playerOrder.indexOf(activeTurnId)
          room.currentTurnIndex = newIdx >= 0 ? newIdx : room.currentTurnIndex
        } else if (removedIdx >= 0 && removedIdx < room.currentTurnIndex) {
          room.currentTurnIndex -= 1
        }
        if (room.currentTurnIndex >= room.playerOrder.length && room.playerOrder.length > 0) {
          room.currentTurnIndex = 0
        }
        if (room.currentTurnIndex < 0) {room.currentTurnIndex = 0}
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

  /**
   * Host action: remove a player who is currently OFFLINE from the room.
   * Refuses to remove a connected player or the host themselves.
   * Returns { ok: true, room } (room may be null if the room emptied) or an
   * { ok: false, error } describing why the removal was rejected.
   */
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
    // A game in progress needs at least 3 players. If removing them would drop
    // below that, the host should end the game instead. (Lobby is exempt.)
    if (room.phase !== 'lobby' && room.players.size - 1 < 3) {
      return {
        ok: false,
        error: 'Removing them would leave fewer than 3 players. End the game instead.',
      }
    }

    return { ok: true, room: this.removePlayer(targetId) }
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
   * Start a new game: pick a fresh word + decoy, assign roles, shuffle turn
   * order, and clear all per-game state (eliminations, vote history, outcome).
   * Returns per-player assignments for the socket handler to dispatch privately.
   *
   * @param incrementRound  when false the game counter is left untouched —
   *   used by the host's "New word" action, which swaps the word for the
   *   current game number rather than advancing to a new one.
   */
  startRound(
    roomCode: string,
    incrementRound = true,
  ): Map<string, PlayerAssignment> | null {
    const room = this.rooms.get(roomCode)
    if (!room) {return null}
    if (room.players.size < 3) {return null}

    room.phase = 'playing'
    if (incrementRound) {room.round += 1}
    const entry = pickWord(room.difficulty)
    room.currentWord = entry.word
    room.currentHint = entry.hint
    room.voteRound = 0
    room.voteHistory = []
    room.gameOutcome = null
    room.lastResult = null
    room.votes = new Map()
    room.lastActivityAt = Date.now()

    const players = Array.from(room.players.values())
    const playerIds = players.map((p) => p.id)

    // Reset per-game player state (role/turn/elimination). lastGamePoints is
    // left alone — it still shows the previous game's result until this one ends.
    for (const p of players) {
      p.hasDone = false
      p.role = 'crewmate'
      p.eliminated = false
      p.eliminatedInRound = 0
      p.correctVotes = 0
    }

    // ── Weighted imposter selection ──────────────────────────────────────────
    // The host is a normal player in the pool — eligible like anyone else.
    // Goal: the same person should not keep being the imposter. Two levers:
    //   1. Hard-skip whoever was the imposter in the immediately previous
    //      round, as long as enough other players remain to fill the slots
    //      and still leave at least one crewmate.
    //   2. Weight the rest by how long ago they were last the imposter, so
    //      players who have never been it (or not for many rounds) are far
    //      more likely to be chosen than someone picked recently.
    const actualImposterCount = Math.max(1, Math.min(room.imposterCount, playerIds.length - 1))
    const prevRound = room.round - 1

    let candidates = players
    const withoutRecent = players.filter((p) => p.lastImposterRound !== prevRound || prevRound <= 0)
    if (withoutRecent.length >= actualImposterCount && withoutRecent.length < players.length) {
      candidates = withoutRecent
    }

    const weightOf = (p: Player): number => {
      // Never been the imposter → strongest pull.
      if (p.lastImposterRound === 0) {return room.round + 3}
      // Otherwise: more rounds since last time → higher weight (min 1).
      return Math.max(1, room.round - p.lastImposterRound)
    }

    const imposters = weightedSample(candidates, weightOf, actualImposterCount)
    for (const p of imposters) {
      p.role = 'imposter'
      p.lastImposterRound = room.round
    }

    // Build random turn order starting at index 0
    room.playerOrder = shuffle([...playerIds])
    room.currentTurnIndex = 0

    // Build assignment map for socket handler.
    // SECURITY: the host is a normal player and can themselves be the imposter,
    // so their assignment must never reveal other players' roles either —
    // only `role`, `word` and `hint` (their own) are ever sent to anyone.
    const assignments = new Map<string, PlayerAssignment>()
    for (const [id, player] of room.players) {
      assignments.set(id, this.buildAssignment(room, player))
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
      room.voteRound = 1
    }

    const nextPlayerId =
      !allDone && room.currentTurnIndex < room.playerOrder.length
        ? room.playerOrder[room.currentTurnIndex]
        : ''

    return { allDone, nextPlayerId }
  }

  // ── In-app voting ────────────────────────────────────────────────────────────

  /**
   * Submit a vote during the discussion phase. One submission per voting round —
   * once cast it is LOCKED (the client selects locally, then submits). Only
   * players still in the game may vote, and only for another still in the game.
   * `room.votes` is cleared each round in `tallyVoteRound`, so the lock lifts
   * automatically for the next round.
   */
  submitVote(
    roomCode: string,
    voterId: string,
    votedPlayerId: string,
  ): { ok: true } | { ok: false; error: string } {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room) {return { ok: false, error: 'Room not found.' }}
    if (room.phase !== 'discussion') {return { ok: false, error: 'Voting is not open right now.' }}
    if (room.gameOutcome) {return { ok: false, error: 'This game is over.' }}

    const voter = room.players.get(voterId)
    const target = room.players.get(votedPlayerId)
    if (!voter) {return { ok: false, error: 'You are not part of this room.' }}
    if (voter.eliminated) {return { ok: false, error: 'You have been voted out — you can only spectate.' }}
    if (room.votes.has(voterId)) {return { ok: false, error: 'Your vote is locked in for this round.' }}
    if (!target) {return { ok: false, error: 'That player is not in this room.' }}
    if (target.eliminated) {return { ok: false, error: 'That player is already out.' }}
    if (voterId === votedPlayerId) {return { ok: false, error: 'You cannot vote for yourself.' }}

    room.votes.set(voterId, votedPlayerId)
    room.lastActivityAt = Date.now()
    return { ok: true }
  }

  /** How many still-in players have voted vs. how many are still in. */
  voteProgress(room: Room): { votedCount: number; activeCount: number } {
    let activeCount = 0
    let votedCount = 0
    for (const p of room.players.values()) {
      if (p.eliminated) {continue}
      activeCount += 1
      if (room.votes.has(p.id)) {votedCount += 1}
    }
    return { votedCount, activeCount }
  }

  /** True once every connected player still in the game has cast a vote. */
  allVotesIn(room: Room): boolean {
    for (const player of room.players.values()) {
      if (player.connected && !player.eliminated && !room.votes.has(player.id)) {return false}
    }
    return true
  }

  /**
   * Decide whether the current game is over based on who's still in.
   *  - all imposters ejected  → crew win
   *  - imposters ≥ remaining crew → imposter win (they can no longer be outvoted)
   */
  private checkWinner(room: Room): GameOutcome | null {
    const alive = activePlayers(room)
    const imposters = alive.filter((p) => p.role === 'imposter').length
    const crew = alive.length - imposters
    if (imposters === 0) {return 'crew'}
    if (imposters >= crew) {return 'imposter'}
    return null
  }

  /**
   * Award points for a finished game and record `lastGamePoints` +
   * `lastGameBreakdown` per player. Runs once, when the game is decided.
   *
   * Points accrue per voting round (see the breakdown rows) and are only ever
   * added to the running total here, at game end:
   *   - crewmate: +1 for every round they voted for an actual imposter
   *   - imposter: +1 for every round that ended without them ejected
   *               (someone else out, OR a tie) — win or loss
   *   - outcome bonus:
   *       crew win     → crew still in +3, crew ejected earlier +1
   *       imposter win → the imposter +5
   *   - the losing side gets 0 (never negative).
   */
  private applyGameScore(room: Room, outcome: GameOutcome): void {
    // Every recorded round the imposter was NOT ejected — crew ejections and
    // ties both count (a tie leaves the imposter in).
    const roundsSurvived = room.voteHistory.filter((h) => !h.wasImposter).length
    for (const p of room.players.values()) {
      const rows: string[] = []
      let pts = 0

      if (p.role === 'imposter') {
        if (roundsSurvived > 0) {
          pts += roundsSurvived
          rows.push(`Survived ${roundsSurvived} vote round${roundsSurvived === 1 ? '' : 's'}  +${roundsSurvived}`)
        }
        if (outcome === 'imposter') {
          pts += 5
          rows.push('Got away with it  +5')
        }
      } else {
        if (p.correctVotes > 0) {
          pts += p.correctVotes
          rows.push(`Spotted the imposter ×${p.correctVotes}  +${p.correctVotes}`)
        }
        if (outcome === 'crew') {
          const bonus = p.eliminated ? 1 : 3
          pts += bonus
          rows.push(p.eliminated ? 'On the winning side  +1' : 'Survived to the win  +3')
        }
      }

      p.lastGamePoints = pts
      p.lastGameBreakdown = rows
      p.score += pts
    }
  }

  /** Votes each still-in player received this round (anonymous — no voters). */
  private tallyCounts(room: Room): Map<string, number> {
    const counts = new Map<string, number>()
    for (const [voterId, targetId] of room.votes) {
      const voter = room.players.get(voterId)
      const target = room.players.get(targetId)
      if (!voter || voter.eliminated || !target || target.eliminated) {continue}
      counts.set(targetId, (counts.get(targetId) ?? 0) + 1)
    }
    return counts
  }

  /**
   * Decide who this vote round ejects, from a pre-computed count map.
   *   - unique top vote-getter        → eject them (imposter or crewmate)
   *   - tie with an imposter tied top → nobody (imposter benefits from the doubt)
   *   - tie of crewmates only         → eject a random one of them
   *   - no votes                      → nobody
   * `forceEject` overrides "nobody" by picking randomly from the top pool.
   */
  private pickEjectedId(room: Room, counts: Map<string, number>, forceEject: boolean): string | null {
    let maxVotes = 0
    let top: string[] = []
    for (const [id, c] of counts) {
      if (c > maxVotes) {maxVotes = c; top = [id]}
      else if (c === maxVotes) {top.push(id)}
    }

    const randomOf = (ids: string[]) => ids[Math.floor(Math.random() * ids.length)]

    if (maxVotes === 0) {
      return forceEject ? randomOf(activePlayers(room).map((p) => p.id)) : null
    }
    if (top.length === 1) {return top[0]}

    // Tie: an imposter among the tied-top survives the round.
    const imposterTied = top.some((id) => room.players.get(id)?.role === 'imposter')
    if (imposterTied) {return forceEject ? randomOf(top) : null}
    // Tie of crewmates only — they all out-polled the imposter, so one goes.
    return randomOf(top)
  }

  /**
   * Tally the current voting round.
   *  - nobody ejected (see `pickEjectedId`) → `{ kind: 'tie' }`
   *  - otherwise → eject a player, record anonymous vote counts, then either
   *    end the game (crew/imposter win) or advance to the next voting round.
   *
   * Also credits each voter who picked an actual imposter (`correctVotes`, used
   * for end-of-game scoring). Ballots (voter→target) are never stored or sent.
   *
   * Returns `null` if there's nothing to tally (wrong phase / game already over).
   */
  tallyVoteRound(
    roomCode: string,
    opts: { forceEject?: boolean } = {},
  ):
    | { kind: 'tie' }
    | {
        kind: 'ejected'
        ejectedId: string
        ejectedName: string
        wasImposter: boolean
        voteRound: number
        remaining: { imposters: number; crew: number }
        gameOver: boolean
        outcome: GameOutcome | null
        result: GameResult | null
      }
    | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room || room.phase !== 'discussion' || room.gameOutcome) {return null}

    const thisRound = room.voteRound

    // Credit correct votes: a *crewmate* voter who picked an actual imposter,
    // before anything clears — every round, ties included. (An imposter voting
    // a co-imposter earns nothing.)
    for (const [voterId, targetId] of room.votes) {
      if (room.players.get(targetId)?.role === 'imposter') {
        const voter = room.players.get(voterId)
        if (voter && voter.role === 'crewmate') {voter.correctVotes += 1}
      }
    }

    const counts = this.tallyCounts(room)
    const voteCounts: Record<string, number> = Object.fromEntries(counts)
    const ejectedId = this.pickEjectedId(room, counts, !!opts.forceEject)

    if (!ejectedId) {
      // Tie — nobody out, but the round still happened: record it (anonymous
      // counts only) so the end reveal shows every iteration and the imposter
      // gets credit for surviving it.
      room.voteHistory.push({
        voteRound: thisRound,
        ejectedId: null,
        ejectedName: null,
        wasImposter: false,
        voteCounts,
      })
      room.voteRound = thisRound + 1
      room.votes = new Map()
      room.lastActivityAt = Date.now()
      return { kind: 'tie' }
    }

    const ejected = room.players.get(ejectedId)
    if (!ejected) {return null}
    ejected.eliminated = true
    ejected.eliminatedInRound = thisRound
    const wasImposter = ejected.role === 'imposter'

    room.voteHistory.push({
      voteRound: thisRound,
      ejectedId,
      ejectedName: ejected.name,
      wasImposter,
      voteCounts,
    })
    room.votes = new Map()
    room.lastActivityAt = Date.now()

    const alive = activePlayers(room)
    const remaining = {
      imposters: alive.filter((p) => p.role === 'imposter').length,
      crew: alive.filter((p) => p.role === 'crewmate').length,
    }
    const outcome = this.checkWinner(room)

    if (outcome) {
      room.gameOutcome = outcome
      this.applyGameScore(room, outcome)
      room.lastResult = this.buildGameResult(room)
    } else {
      room.voteRound = thisRound + 1
    }

    return {
      kind: 'ejected',
      ejectedId,
      ejectedName: ejected.name,
      wasImposter,
      voteRound: thisRound,
      remaining,
      gameOver: !!outcome,
      outcome,
      result: outcome ? room.lastResult : null,
    }
  }

  /**
   * Re-check the win condition after a player leaves mid-game (removing a
   * crewmate can hand the imposter parity; removing the last imposter is a
   * crew win). Returns the outcome if the departure ended the game.
   */
  resolveIfDeparturesEndedGame(roomCode: string): GameResult | null {
    const room = this.rooms.get(roomCode.toUpperCase())
    if (!room || room.phase !== 'discussion' || room.gameOutcome) {return null}
    const outcome = this.checkWinner(room)
    if (!outcome) {return null}
    room.gameOutcome = outcome
    this.applyGameScore(room, outcome)
    room.lastResult = this.buildGameResult(room)
    return room.lastResult
  }

  /** End the game – set phase to 'ended'. */
  endGame(roomCode: string): void {
    const room = this.rooms.get(roomCode)
    if (room) {
      room.phase = 'ended'
      room.lastActivityAt = Date.now()
    }
  }

  /** Reset all scores to 0 and restart the imposter-rotation history. */
  resetScores(roomCode: string): void {
    const room = this.rooms.get(roomCode)
    if (!room) {return}
    for (const p of room.players.values()) {
      p.score = 0
      p.lastGamePoints = 0
      p.lastImposterRound = 0
    }
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
    const nextTurnId = room.playerOrder[room.currentTurnIndex + 1] ?? ''

    return {
      roomCode: room.code,
      phase: room.phase,
      difficulty: room.difficulty,
      players,
      currentTurnPlayerId: currentTurnId,
      currentTurnName: currentTurnPlayer?.name ?? '',
      currentTurnIndex: room.currentTurnIndex,
      nextTurnPlayerId: nextTurnId,
      turnOrder: [...room.playerOrder],
      round: room.round,
      voteRound: room.voteRound,
      gameOutcome: room.gameOutcome,
      imposterCount: room.imposterCount,
      hostId: room.hostId,
    }
  }

  /** Build a PlayerAssignment for an individual player. */
  buildAssignment(room: Room, player: Player): PlayerAssignment {
    const isImposter = player.role === 'imposter'
    return {
      role: player.role,
      word: isImposter ? null : room.currentWord,
      hint: isImposter ? room.currentHint : null,
    }
  }

  /**
   * Build the full public result of the current (finished) game: word, decoy,
   * imposter names, the whole round-by-round vote history, and every player's
   * points + running total. Callable at any time; only meaningful once
   * `room.gameOutcome` is set.
   */
  buildGameResult(room: Room): GameResult {
    const players = Array.from(room.players.values())
    const imposterNames = players.filter((p) => p.role === 'imposter').map((p) => p.name)
    const scores: GameScoreLine[] = players
      .map((p) => ({
        playerId: p.id,
        name: p.name,
        points: p.lastGamePoints,
        total: p.score,
        isImposter: p.role === 'imposter',
        eliminatedInRound: p.eliminatedInRound,
        pointsBreakdown: [...p.lastGameBreakdown],
      }))
      .sort((a, b) => b.total - a.total || b.points - a.points)

    return {
      outcome: room.gameOutcome ?? 'imposter',
      round: room.round,
      word: room.currentWord ?? '',
      imposterHint: room.currentHint,
      imposterNames,
      voteHistory: room.voteHistory.map((h) => ({ ...h })),
      scores,
    }
  }

  /** The cached result of the most recently finished game, if any. */
  getLastResult(roomCode: string): GameResult | null {
    return this.rooms.get(roomCode.toUpperCase())?.lastResult ?? null
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
    if (allDone) {
      room.phase = 'discussion'
      room.voteRound = 1
    }

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
