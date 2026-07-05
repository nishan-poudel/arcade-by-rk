/**
 * Socket.IO event handlers.
 *
 * Architecture:
 *  - Every handler validates its payload BEFORE calling GameService.
 *  - Every handler is rate-limited via checkRateLimit().
 *  - Sensitive data (imposterIds) is stripped for non-host sockets.
 *  - Events use snake_case consistently (client ↔ server).
 */
import type { Server, Socket } from 'socket.io'
import { gameService } from '../game/GameService.js'
import { logger } from '../utils/logger.js'
import {
  checkRateLimit,
  cleanupSocket,
  startBucketPurge,
} from '../security/rateLimiter.js'
import {
  validateName,
  validateRoomCode,
  validateDifficulty,
  validateImposterCount,
  isObject,
} from '../security/validator.js'
import type { GameReveal } from '../../../shared/types/index.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Emit a structured error to a single socket. Never leaks internal details. */
function emitError(socket: Socket, message: string): void {
  socket.emit('error', { message })
}

/**
 * Rate-limit guard.
 * Returns true if the event should be dropped (caller should return early).
 */
function rateLimited(socket: Socket, eventName: string): boolean {
  if (!checkRateLimit(socket.id, eventName)) {
    logger.warn('Rate limit exceeded', { socketId: socket.id, event: eventName })
    emitError(socket, 'Too many requests. Slow down.')
    return true
  }
  return false
}

/** Broadcast updated game state to everyone in the room. */
function broadcastState(io: Server, roomCode: string): void {
  const room = gameService.getRoom(roomCode)
  if (!room) {return}
  const state = gameService.buildGameState(room)
  io.to(roomCode).emit('game_state', state)
}

/**
 * Send individual assignments to all players in a round.
 * SECURITY: imposterIds are stripped for every non-host socket.
 */
function dispatchAssignments(
  io: Server,
  assignments: Map<string, { role: string; word: string | null; imposterIds: string[] }>,
  hostId: string,
): void {
  for (const [playerId, assignment] of assignments) {
    const secureAssignment =
      playerId === hostId
        ? assignment
        : { ...assignment, imposterIds: [] }
    io.to(playerId).emit('player_assignment', secureAssignment)
  }
}

/**
 * Tally votes for a room and broadcast the public round reveal.
 * Used both when voting completes naturally (all connected players voted)
 * and when the host force-reveals early. No-ops (returns false) if the
 * round was already tallied (idempotency guard inside GameService).
 */
function tallyAndBroadcastReveal(io: Server, roomCode: string): boolean {
  const tally = gameService.tallyVotes(roomCode)
  if (!tally) {return false}

  broadcastState(io, roomCode)

  const base = gameService.buildReveal(roomCode)
  if (base) {
    const fullReveal: GameReveal = { ...base, ...tally }
    io.to(roomCode).emit('round_reveal', fullReveal)
  }
  return true
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerSocketHandlers(io: Server): void {
  // Start the stale-bucket purge loop once at registration
  startBucketPurge()

  io.on('connection', (socket: Socket) => {
    logger.info('Socket connected', { socketId: socket.id })

    // ── create_room ──────────────────────────────────────────────────────────
    socket.on('create_room', (payload: unknown) => {
      if (rateLimited(socket, 'create_room')) {return}

      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const nameResult = validateName(payload.hostName)
      if (!nameResult.ok) {return emitError(socket, nameResult.error)}

      const diffResult = validateDifficulty(payload.difficulty ?? 'easy')
      if (!diffResult.ok) {return emitError(socket, diffResult.error)}

      const countResult = validateImposterCount(payload.imposterCount ?? 1)
      if (!countResult.ok) {return emitError(socket, countResult.error)}

      const roomCode = gameService.createRoom(
        socket.id,
        nameResult.value,
        diffResult.value,
        countResult.value,
      )

      if (!roomCode) {return emitError(socket, 'Server is at capacity. Try again later.')}

      socket.join(roomCode)

      const room = gameService.getRoom(roomCode)!
      const state = gameService.buildGameState(room)
      const assignment = { role: 'crewmate' as const, word: null, imposterIds: [] }

      socket.emit('room_created', { roomCode, gameState: state, assignment })
      logger.info('Room created', { roomCode, host: nameResult.value })
    })

    // ── join_room ────────────────────────────────────────────────────────────
    socket.on('join_room', (payload: unknown) => {
      if (rateLimited(socket, 'join_room')) {return}

      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const nameResult = validateName(payload.playerName)
      if (!nameResult.ok) {return emitError(socket, nameResult.error)}

      const joinError = gameService.joinRoom(codeResult.value, socket.id, nameResult.value)
      if (joinError) {return emitError(socket, joinError)}

      socket.join(codeResult.value)

      const room = gameService.getRoom(codeResult.value)!
      const state = gameService.buildGameState(room)
      const assignment = { role: 'crewmate' as const, word: null, imposterIds: [] }

      socket.emit('room_joined', { gameState: state, assignment })
      broadcastState(io, codeResult.value)
      logger.info('Player joined', { roomCode: codeResult.value, name: nameResult.value })
    })

    // ── rejoin_room ──────────────────────────────────────────────────────────
    socket.on('rejoin_room', (payload: unknown) => {
      if (rateLimited(socket, 'rejoin_room')) {return}

      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const nameResult = validateName(payload.playerName)
      if (!nameResult.ok) {return emitError(socket, nameResult.error)}

      const result = gameService.rejoinRoom(socket.id, codeResult.value, nameResult.value)
      if (!result) {
        return emitError(socket, 'Could not rejoin. Room may have ended or name not found.')
      }

      socket.join(codeResult.value)

      const state = gameService.buildGameState(result.room)
      // SECURITY: only send imposterIds back to the rejoining host
      const secureAssignment =
        result.room.hostId === socket.id
          ? result.assignment
          : { ...result.assignment, imposterIds: [] }
      socket.emit('room_joined', { gameState: state, assignment: secureAssignment })
      broadcastState(io, codeResult.value)
      logger.info('Player rejoined', { roomCode: codeResult.value, name: nameResult.value })
    })

    // ── start_game ───────────────────────────────────────────────────────────
    socket.on('start_game', (rawCode: unknown) => {
      if (rateLimited(socket, 'start_game')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can start the game.')}
      if (room.players.size < 3) {return emitError(socket, 'Need at least 3 players to start.')}

      const assignments = gameService.startRound(codeResult.value)
      if (!assignments) {return emitError(socket, 'Failed to start game.')}

      // SECURITY: dispatch private assignments BEFORE the public game_state broadcast.
      // This ensures every client already has their role/word when the screen
      // transitions to 'game', preventing a brief flash of the stale lobby assignment.
      dispatchAssignments(io, assignments, room.hostId)
      io.to(codeResult.value).emit('game_state', gameService.buildGameState(room))
      logger.info('Game started', { roomCode: codeResult.value, round: room.round })
    })

    // ── player_done ──────────────────────────────────────────────────────────
    socket.on('player_done', (rawCode: unknown) => {
      if (rateLimited(socket, 'player_done')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const result = gameService.playerDone(codeResult.value, socket.id)
      if (!result) {return emitError(socket, 'Not your turn or invalid room.')}

      const room = gameService.getRoom(codeResult.value)!
      io.to(codeResult.value).emit('game_state', gameService.buildGameState(room))
      if (result.allDone) {io.to(codeResult.value).emit('discussion_time')}
    })

    // ── submit_vote ──────────────────────────────────────────────────────────
    socket.on('submit_vote', (payload: unknown) => {
      if (rateLimited(socket, 'submit_vote')) {return}

      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      if (typeof payload.votedPlayerId !== 'string' || !payload.votedPlayerId) {
        return emitError(socket, 'votedPlayerId must be a non-empty string.')
      }

      const result = gameService.submitVote(codeResult.value, socket.id, payload.votedPlayerId)
      if (!result.ok) {return emitError(socket, result.error)}

      broadcastState(io, codeResult.value)

      // Auto-reveal the moment every connected player has voted
      const room = gameService.getRoom(codeResult.value)
      if (room && gameService.allVotesIn(room)) {
        tallyAndBroadcastReveal(io, codeResult.value)
        logger.info('Voting complete (auto)', { roomCode: codeResult.value })
      }
    })

    // ── force_reveal_votes ───────────────────────────────────────────────────
    // Host-only escape hatch: tally whatever votes have been cast so far,
    // useful if an AFK/disconnected player is blocking the auto-reveal.
    socket.on('force_reveal_votes', (rawCode: unknown) => {
      if (rateLimited(socket, 'force_reveal_votes')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can force a reveal.')}
      if (room.phase !== 'discussion') {return emitError(socket, 'Voting not in progress.')}

      const revealed = tallyAndBroadcastReveal(io, codeResult.value)
      if (!revealed) {return emitError(socket, 'Result already recorded for this round.')}

      logger.info('Voting complete (host forced)', { roomCode: codeResult.value })
    })

    // ── next_round ───────────────────────────────────────────────────────────
    socket.on('next_round', (rawCode: unknown) => {
      if (rateLimited(socket, 'next_round')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can start next round.')}

      const assignments = gameService.startRound(codeResult.value)
      if (!assignments) {return emitError(socket, 'Failed to start next round.')}

      // SECURITY: same ordering as start_game – assignments before state broadcast
      dispatchAssignments(io, assignments, room.hostId)
      io.to(codeResult.value).emit('game_state', gameService.buildGameState(room))
      logger.info('Next round started', { roomCode: codeResult.value, round: room.round })
    })

    // ── skip_turn ─────────────────────────────────────────────────────────
    socket.on('skip_turn', (rawCode: unknown) => {
      if (rateLimited(socket, 'skip_turn')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can skip turns.')}

      const result = gameService.skipTurn(codeResult.value)
      if (!result) {return emitError(socket, 'Cannot skip turn right now.')}

      const updatedRoom = gameService.getRoom(codeResult.value)!
      io.to(codeResult.value).emit('game_state', gameService.buildGameState(updatedRoom))
      if (result.allDone) {io.to(codeResult.value).emit('discussion_time')}
      logger.info('Turn skipped', { roomCode: codeResult.value })
    })

    // ── end_game ─────────────────────────────────────────────────────────────
    socket.on('end_game', (rawCode: unknown) => {
      if (rateLimited(socket, 'end_game')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can end the game.')}

      gameService.endGame(codeResult.value)
      broadcastState(io, codeResult.value)
      io.to(codeResult.value).emit('game_ended')
      logger.info('Game ended', { roomCode: codeResult.value })
    })

    // ── reset_scores ─────────────────────────────────────────────────────────
    socket.on('reset_scores', (rawCode: unknown) => {
      if (rateLimited(socket, 'reset_scores')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can reset scores.')}

      gameService.resetScores(codeResult.value)
      broadcastState(io, codeResult.value)
    })

    // ── set_difficulty ───────────────────────────────────────────────────────
    socket.on('set_difficulty', (payload: unknown) => {
      if (rateLimited(socket, 'set_difficulty')) {return}

      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const diffResult = validateDifficulty(payload.difficulty)
      if (!diffResult.ok) {return emitError(socket, diffResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can change difficulty.')}

      gameService.setDifficulty(codeResult.value, diffResult.value)
      broadcastState(io, codeResult.value)
    })

    // ── set_imposter_count ────────────────────────────────────────────────────
    socket.on('set_imposter_count', (payload: unknown) => {
      if (rateLimited(socket, 'set_imposter_count')) {return}

      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const countResult = validateImposterCount(payload.imposterCount)
      if (!countResult.ok) {return emitError(socket, countResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can change settings.')}

      gameService.setImposterCount(codeResult.value, countResult.value)
      broadcastState(io, codeResult.value)
    })

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { socketId: socket.id, reason })

      // Clean up rate-limit buckets to prevent memory growth
      cleanupSocket(socket.id)

      // Mark player as disconnected but keep them in room for potential rejoin
      const room = gameService.setPlayerConnected(socket.id, false)
      if (room) {broadcastState(io, room.code)}
    })
  })
}
