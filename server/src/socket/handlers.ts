/**
 * Socket.IO event handlers.
 *
 * Architecture:
 *  - Every handler validates its payload BEFORE calling GameService.
 *  - Every handler is rate-limited via checkRateLimit().
 *  - The host is a normal player: their private assignment never reveals
 *    other players' roles, and they can themselves be assigned imposter.
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
 * Build the `state_synced` payload for one player. Includes the finished-game
 * `result` when a game has been decided, so a client that refreshes during the
 * reveal / score modal is restored to the right place.
 */
function syncedPayload(roomCode: string, playerId: string) {
  const room = gameService.getRoom(roomCode)!
  const player = room.players.get(playerId)
  return {
    gameState: gameService.buildGameState(room),
    assignment: player
      ? gameService.buildAssignment(room, player)
      : { role: 'crewmate' as const, word: null, hint: null },
    result: room.gameOutcome ? gameService.getLastResult(roomCode) : null,
  }
}

/**
 * Send individual assignments to all players in a round.
 * SECURITY: every assignment only ever contains the recipient's own role and
 * word — including the host's, since the host is just another player and
 * must not learn who else is the imposter.
 */
function dispatchAssignments(
  io: Server,
  assignments: Map<string, { role: string; word: string | null; hint: string | null }>,
): void {
  for (const [playerId, assignment] of assignments) {
    io.to(playerId).emit('player_assignment', assignment)
  }
}

/**
 * Tally the current voting round and broadcast the outcome.
 *  - tie / no clear winner → `vote_tie` (unless `forceEject`)
 *  - someone ejected → `ejection_result`, plus `game_result` if the game is now
 *    decided (imposter caught, or imposters reached parity with the crew)
 * No-ops (returns false) if there's nothing to tally.
 */
function tallyAndBroadcast(io: Server, roomCode: string, forceEject = false): boolean {
  const tally = gameService.tallyVoteRound(roomCode, { forceEject })
  if (!tally) {return false}

  broadcastState(io, roomCode)

  if (tally.kind === 'tie') {
    io.to(roomCode).emit('vote_tie')
    return true
  }

  io.to(roomCode).emit('ejection_result', {
    ejectedId: tally.ejectedId,
    ejectedName: tally.ejectedName,
    wasImposter: tally.wasImposter,
    voteRound: tally.voteRound,
    ballotNames: tally.ballotNames,
    remaining: tally.remaining,
    gameOver: tally.gameOver,
    outcome: tally.outcome,
  })

  if (tally.gameOver && tally.result) {
    io.to(roomCode).emit('game_result', tally.result)
  }
  return true
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerSocketHandlers(io: Server): void {
  // Start the stale-bucket purge loop once at registration
  startBucketPurge()

  io.on('connection', (socket: Socket) => {
    logger.info('Socket connected', { socketId: socket.id, recovered: socket.recovered })

    // connectionStateRecovery kicked in: same socket id, briefly dropped and
    // now back. Flip the player back to connected and re-broadcast so the rest
    // of the room stops showing them as offline.
    if (socket.recovered) {
      const room = gameService.setPlayerConnected(socket.id, true)
      if (room) {
        socket.emit('state_synced', syncedPayload(room.code, socket.id))
        broadcastState(io, room.code)
      }
    }

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
      const assignment = { role: 'crewmate' as const, word: null, hint: null }

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
      const assignment = { role: 'crewmate' as const, word: null, hint: null }

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
      socket.emit('room_joined', { gameState: state, assignment: result.assignment })
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
      dispatchAssignments(io, assignments)
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

      // Tally the moment every connected player still in the game has voted
      const room = gameService.getRoom(codeResult.value)
      if (room && gameService.allVotesIn(room)) {
        tallyAndBroadcast(io, codeResult.value)
        logger.info('Vote round tallied (auto)', { roomCode: codeResult.value })
      }
    })

    // ── force_reveal_votes ───────────────────────────────────────────────────
    // Host-only escape hatch: tally the votes cast so far right now, useful if
    // an AFK/disconnected player is blocking the auto-tally. Breaks a tie
    // (or a zero-vote round) by ejecting a random candidate so it always moves.
    socket.on('force_reveal_votes', (rawCode: unknown) => {
      if (rateLimited(socket, 'force_reveal_votes')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can force a vote.')}
      if (room.phase !== 'discussion') {return emitError(socket, 'Voting not in progress.')}
      if (room.gameOutcome) {return emitError(socket, 'This game is already over.')}

      const done = tallyAndBroadcast(io, codeResult.value, true)
      if (!done) {return emitError(socket, 'Nothing to tally right now.')}

      logger.info('Vote round tallied (host forced)', { roomCode: codeResult.value })
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
      dispatchAssignments(io, assignments)
      io.to(codeResult.value).emit('game_state', gameService.buildGameState(room))
      logger.info('Next round started', { roomCode: codeResult.value, round: room.round })
    })

    // ── change_word ──────────────────────────────────────────────────────────
    // Host-only: the group doesn't like the current word. Reshuffle the CURRENT
    // round with a fresh word — new word/decoy, imposters re-picked, turn order
    // reset — without advancing the round counter and without scoring anything.
    // The confirmation prompt lives on the client (host may misclick).
    socket.on('change_word', (rawCode: unknown) => {
      if (rateLimited(socket, 'change_word')) {return}

      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can change the word.')}
      if (room.phase !== 'playing' && room.phase !== 'discussion') {
        return emitError(socket, 'The word can only be changed during a round.')
      }

      const assignments = gameService.startRound(codeResult.value, false)
      if (!assignments) {return emitError(socket, 'Could not change the word.')}

      dispatchAssignments(io, assignments)
      io.to(codeResult.value).emit('game_state', gameService.buildGameState(room))
      io.to(codeResult.value).emit('word_changed')
      logger.info('Word changed', { roomCode: codeResult.value, round: room.round })
    })

    // ── remove_player ────────────────────────────────────────────────────────
    // Host-only: drop a player who is currently offline from the room.
    socket.on('remove_player', (payload: unknown) => {
      if (rateLimited(socket, 'remove_player')) {return}

      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      if (typeof payload.targetPlayerId !== 'string' || !payload.targetPlayerId) {
        return emitError(socket, 'targetPlayerId must be a non-empty string.')
      }

      const result = gameService.removeOfflinePlayer(
        codeResult.value,
        socket.id,
        payload.targetPlayerId,
      )
      if (!result.ok) {return emitError(socket, result.error)}

      // Tell the removed client (in case it reconnects) to drop its session,
      // then sever any socket it still has open.
      io.to(payload.targetPlayerId).emit('removed_from_room')
      void io.in(payload.targetPlayerId).disconnectSockets(true)

      if (result.room) {
        broadcastState(io, result.room.code)
        // Losing a player can decide the game (imposter now has parity, or the
        // last imposter just left) or unblock a stalled vote round.
        const ended = gameService.resolveIfDeparturesEndedGame(result.room.code)
        if (ended) {
          broadcastState(io, result.room.code)
          io.to(result.room.code).emit('game_result', ended)
        } else if (result.room.phase === 'discussion' && gameService.allVotesIn(result.room)) {
          tallyAndBroadcast(io, result.room.code)
        }
      }
      logger.info('Player removed by host', {
        roomCode: codeResult.value,
        target: payload.targetPlayerId,
      })
    })

    // ── request_state ────────────────────────────────────────────────────────
    // Any client can ask for a fresh authoritative snapshot (+ its own private
    // assignment). Powers the manual "Refresh" button and the periodic /
    // tab-focus resync that keeps every client from drifting out of sync.
    // If the server no longer recognises this socket (e.g. it restarted),
    // fall back to a full rejoin using the name the client remembered.
    socket.on('request_state', (payload: unknown) => {
      if (rateLimited(socket, 'request_state')) {return}

      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = gameService.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'That room has ended.')}

      const existing = room.players.get(socket.id)
      if (existing) {
        socket.join(codeResult.value)
        const wasOffline = !existing.connected
        existing.connected = true
        socket.emit('state_synced', syncedPayload(codeResult.value, socket.id))
        // Only disturb everyone else if this actually changed something
        // (a routine keep-in-sync poll must not trigger a room-wide broadcast).
        if (wasOffline) {broadcastState(io, codeResult.value)}
        return
      }

      // Unknown socket — try to reattach by name.
      const nameResult = validateName(payload.playerName)
      if (!nameResult.ok) {return emitError(socket, 'Could not resync — please rejoin.')}

      const rejoined = gameService.rejoinRoom(socket.id, codeResult.value, nameResult.value)
      if (!rejoined) {return emitError(socket, 'Could not resync — please rejoin.')}

      socket.join(codeResult.value)
      socket.emit('state_synced', syncedPayload(codeResult.value, socket.id))
      broadcastState(io, codeResult.value)
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
      if (room) {
        broadcastState(io, room.code)
        // If an AFK player drops mid-vote, the remaining connected players may
        // now all have voted — don't leave the round hanging on a ghost.
        // (A disconnected player is still "in the game" for win-condition math,
        // so a drop alone never ends the game — only a removal does.)
        if (room.phase === 'discussion' && !room.gameOutcome && gameService.allVotesIn(room)) {
          tallyAndBroadcast(io, room.code)
        }
      }
    })
  })
}
