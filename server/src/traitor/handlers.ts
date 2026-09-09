/**
 * Socket.IO event handlers for the Traitor game.
 *
 * Registered on a dedicated namespace: `registerTraitorHandlers(io.of('/traitor'))`.
 * The default namespace (the Imposter game) is completely untouched.
 *
 * Architecture (mirrors `server/src/socket/handlers.ts`):
 *  - every handler validates its payload BEFORE calling the game service
 *  - every handler is rate-limited via checkRateLimit()
 *  - the host is a normal player: their private assignment never reveals other
 *    players' roles, and they can themselves be assigned the Traitor
 *  - events use snake_case
 */
import type { Namespace, Socket } from 'socket.io'
import { traitorGameService as svc, TRAITOR_MIN_PLAYERS } from './TraitorGameService.js'
import { CATEGORIES } from './config.js'
import { validateAvatar, validateCategory, validateTotalRounds } from './validate.js'
import { logger } from '../utils/logger.js'
import { checkRateLimit, cleanupSocket } from '../security/rateLimiter.js'
import { validateName, validateRoomCode, isObject } from '../security/validator.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function emitError(socket: Socket, message: string): void {
  socket.emit('error', { message })
}

function rateLimited(socket: Socket, eventName: string): boolean {
  if (!checkRateLimit(socket.id, `traitor:${eventName}`)) {
    logger.warn('Traitor rate limit exceeded', { socketId: socket.id, event: eventName })
    emitError(socket, 'Too many requests. Slow down.')
    return true
  }
  return false
}

function broadcastState(nsp: Namespace, roomCode: string): void {
  const room = svc.getRoom(roomCode)
  if (!room) {return}
  nsp.to(roomCode).emit('game_state', svc.buildGameState(room))
}

function syncedPayload(roomCode: string, playerId: string) {
  const room = svc.getRoom(roomCode)!
  const player = room.players.get(playerId)
  return {
    gameState: svc.buildGameState(room),
    assignment: player ? svc.buildAssignment(room, player) : null,
    result: room.phase === 'roundResult' ? svc.getLastResult(roomCode) : null,
  }
}

/** Send each socket only its OWN role + prompt (never broadcast). */
function dispatchAssignments(
  nsp: Namespace,
  assignments: Map<string, { role: string; prompt: string } | null>,
): void {
  for (const [playerId, assignment] of assignments) {
    if (assignment) {nsp.to(playerId).emit('round_assignment', assignment)}
  }
}

/**
 * Tally the accusation vote and broadcast the outcome:
 *  - new authoritative state
 *  - `round_result` with the full (now safe) picture
 * No-ops if there's nothing to tally.
 */
function tallyAndBroadcast(nsp: Namespace, roomCode: string): boolean {
  const result = svc.tallyRound(roomCode)
  if (!result) {return false}
  broadcastState(nsp, roomCode)
  nsp.to(roomCode).emit('round_result', result)
  return true
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerTraitorHandlers(nsp: Namespace): void {
  nsp.on('connection', (socket: Socket) => {
    logger.info('Traitor socket connected', { socketId: socket.id, recovered: socket.recovered })

    // Tell the client which question categories exist (so it doesn't hard-code them).
    socket.emit('categories', { categories: CATEGORIES })

    if (socket.recovered) {
      const room = svc.setPlayerConnected(socket.id, true)
      if (room) {
        socket.emit('state_synced', syncedPayload(room.code, socket.id))
        broadcastState(nsp, room.code)
      }
    }

    // ── create_room ────────────────────────────────────────────────────────
    socket.on('create_room', (payload: unknown) => {
      if (rateLimited(socket, 'create_room')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const nameResult = validateName(payload.hostName)
      if (!nameResult.ok) {return emitError(socket, nameResult.error)}
      const avatarResult = validateAvatar(payload.avatar)
      if (!avatarResult.ok) {return emitError(socket, avatarResult.error)}
      const catResult = validateCategory(payload.category ?? CATEGORIES[0])
      if (!catResult.ok) {return emitError(socket, catResult.error)}
      const roundsResult = validateTotalRounds(payload.totalRounds ?? 5)
      if (!roundsResult.ok) {return emitError(socket, roundsResult.error)}

      const roomCode = svc.createRoom(
        socket.id,
        nameResult.value,
        avatarResult.value,
        catResult.value,
        roundsResult.value,
      )
      if (!roomCode) {return emitError(socket, 'Server is at capacity. Try again later.')}

      socket.join(roomCode)
      const room = svc.getRoom(roomCode)!
      socket.emit('room_created', { roomCode, gameState: svc.buildGameState(room) })
      logger.info('Traitor room created', { roomCode, host: nameResult.value })
    })

    // ── join_room ──────────────────────────────────────────────────────────
    socket.on('join_room', (payload: unknown) => {
      if (rateLimited(socket, 'join_room')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}
      const nameResult = validateName(payload.playerName)
      if (!nameResult.ok) {return emitError(socket, nameResult.error)}
      const avatarResult = validateAvatar(payload.avatar)
      if (!avatarResult.ok) {return emitError(socket, avatarResult.error)}

      const joinError = svc.joinRoom(
        codeResult.value,
        socket.id,
        nameResult.value,
        avatarResult.value,
      )
      if (joinError) {return emitError(socket, joinError)}

      socket.join(codeResult.value)
      const room = svc.getRoom(codeResult.value)!
      socket.emit('room_joined', { gameState: svc.buildGameState(room), assignment: null })
      broadcastState(nsp, codeResult.value)
      logger.info('Traitor player joined', { roomCode: codeResult.value, name: nameResult.value })
    })

    // ── rejoin_room ────────────────────────────────────────────────────────
    socket.on('rejoin_room', (payload: unknown) => {
      if (rateLimited(socket, 'rejoin_room')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}
      const nameResult = validateName(payload.playerName)
      if (!nameResult.ok) {return emitError(socket, nameResult.error)}

      const result = svc.rejoinRoom(socket.id, codeResult.value, nameResult.value)
      if (!result) {
        return emitError(socket, 'Could not rejoin. Room may have ended or name not found.')
      }

      socket.join(codeResult.value)
      socket.emit('room_joined', {
        gameState: svc.buildGameState(result.room),
        assignment: result.assignment,
      })
      broadcastState(nsp, codeResult.value)
      logger.info('Traitor player rejoined', { roomCode: codeResult.value, name: nameResult.value })
    })

    // ── request_state ──────────────────────────────────────────────────────
    socket.on('request_state', (payload: unknown) => {
      if (rateLimited(socket, 'request_state')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}

      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = svc.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'That room has ended.')}

      const existing = room.players.get(socket.id)
      if (existing) {
        socket.join(codeResult.value)
        const wasOffline = !existing.connected
        existing.connected = true
        socket.emit('state_synced', syncedPayload(codeResult.value, socket.id))
        if (wasOffline) {broadcastState(nsp, codeResult.value)}
        return
      }

      const nameResult = validateName(payload.playerName)
      if (!nameResult.ok) {return emitError(socket, 'Could not resync — please rejoin.')}
      const rejoined = svc.rejoinRoom(socket.id, codeResult.value, nameResult.value)
      if (!rejoined) {return emitError(socket, 'Could not resync — please rejoin.')}

      socket.join(codeResult.value)
      socket.emit('state_synced', syncedPayload(codeResult.value, socket.id))
      broadcastState(nsp, codeResult.value)
    })

    // ── set_ready ──────────────────────────────────────────────────────────
    socket.on('set_ready', (payload: unknown) => {
      if (rateLimited(socket, 'set_ready')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}
      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = svc.setReady(codeResult.value, socket.id, payload.ready === true)
      if (room) {broadcastState(nsp, room.code)}
    })

    // ── set_category ───────────────────────────────────────────────────────
    socket.on('set_category', (payload: unknown) => {
      if (rateLimited(socket, 'set_category')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}
      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}
      const catResult = validateCategory(payload.category)
      if (!catResult.ok) {return emitError(socket, catResult.error)}

      const room = svc.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can change the category.')}

      svc.setCategory(codeResult.value, catResult.value)
      broadcastState(nsp, codeResult.value)
    })

    // ── set_total_rounds ───────────────────────────────────────────────────
    socket.on('set_total_rounds', (payload: unknown) => {
      if (rateLimited(socket, 'set_total_rounds')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}
      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}
      const roundsResult = validateTotalRounds(payload.totalRounds)
      if (!roundsResult.ok) {return emitError(socket, roundsResult.error)}

      const room = svc.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can change settings.')}

      svc.setTotalRounds(codeResult.value, roundsResult.value)
      broadcastState(nsp, codeResult.value)
    })

    // ── start_round / next_round ───────────────────────────────────────────
    const startRound = (rawCode: unknown) => {
      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = svc.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can start the round.')}
      if (room.players.size < TRAITOR_MIN_PLAYERS) {
        return emitError(socket, `Need at least ${TRAITOR_MIN_PLAYERS} players to start.`)
      }
      if (room.phase === 'lobby') {
        const notReady = Array.from(room.players.values()).some((p) => p.connected && !p.ready)
        if (notReady) {return emitError(socket, 'Everyone needs to tap Ready first.')}
      }
      if (room.round >= room.totalRounds && room.phase === 'roundResult') {
        return emitError(socket, 'That was the last round.')
      }

      const assignments = svc.startRound(codeResult.value)
      if (!assignments) {return emitError(socket, 'Could not start the round.')}

      // SECURITY: private assignments BEFORE the public state broadcast.
      dispatchAssignments(nsp, assignments)
      broadcastState(nsp, codeResult.value)
      logger.info('Traitor round started', { roomCode: codeResult.value, round: room.round })
    }
    socket.on('start_round', (rawCode: unknown) => {
      if (rateLimited(socket, 'start_round')) {return}
      startRound(rawCode)
    })
    socket.on('next_round', (rawCode: unknown) => {
      if (rateLimited(socket, 'next_round')) {return}
      startRound(rawCode)
    })

    // ── submit_answer ──────────────────────────────────────────────────────
    socket.on('submit_answer', (payload: unknown) => {
      if (rateLimited(socket, 'submit_answer')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}
      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}
      if (typeof payload.pickedPlayerId !== 'string' || !payload.pickedPlayerId) {
        return emitError(socket, 'pickedPlayerId must be a non-empty string.')
      }

      const result = svc.submitAnswer(codeResult.value, socket.id, payload.pickedPlayerId)
      if (!result.ok) {return emitError(socket, result.error)}

      const room = svc.getRoom(codeResult.value)
      if (room && svc.allAnswersIn(room)) {
        svc.revealAnswers(codeResult.value)
        broadcastState(nsp, codeResult.value)
        logger.info('Traitor answers revealed (auto)', { roomCode: codeResult.value })
        return
      }
      if (room) {
        const p = svc.answerProgress(room)
        nsp.to(codeResult.value).emit('answer_update', {
          playerId: socket.id,
          answeredCount: p.answeredCount,
          activeCount: p.activeCount,
        })
      }
    })

    // ── force_reveal_answers (host) ────────────────────────────────────────
    socket.on('force_reveal_answers', (rawCode: unknown) => {
      if (rateLimited(socket, 'force_reveal_answers')) {return}
      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = svc.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can do that.')}

      if (!svc.revealAnswers(codeResult.value)) {
        return emitError(socket, 'Answers are not open right now.')
      }
      broadcastState(nsp, codeResult.value)
      logger.info('Traitor answers revealed (host forced)', { roomCode: codeResult.value })
    })

    // ── open_vote (host) ───────────────────────────────────────────────────
    socket.on('open_vote', (rawCode: unknown) => {
      if (rateLimited(socket, 'open_vote')) {return}
      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = svc.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can open the vote.')}

      if (!svc.openVote(codeResult.value)) {
        return emitError(socket, 'Cannot open the vote right now.')
      }
      broadcastState(nsp, codeResult.value)
      logger.info('Traitor vote opened', { roomCode: codeResult.value })
    })

    // ── submit_vote ────────────────────────────────────────────────────────
    socket.on('submit_vote', (payload: unknown) => {
      if (rateLimited(socket, 'submit_vote')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}
      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}
      if (typeof payload.votedPlayerId !== 'string' || !payload.votedPlayerId) {
        return emitError(socket, 'votedPlayerId must be a non-empty string.')
      }

      const result = svc.submitVote(codeResult.value, socket.id, payload.votedPlayerId)
      if (!result.ok) {return emitError(socket, result.error)}

      const room = svc.getRoom(codeResult.value)
      if (room && svc.allVotesIn(room)) {
        tallyAndBroadcast(nsp, codeResult.value)
        logger.info('Traitor round tallied (auto)', { roomCode: codeResult.value })
        return
      }
      if (room) {
        const p = svc.voteProgress(room)
        nsp.to(codeResult.value).emit('vote_update', {
          voterId: socket.id,
          votedCount: p.votedCount,
          activeCount: p.activeCount,
        })
      }
    })

    // ── force_reveal_votes (host) ──────────────────────────────────────────
    socket.on('force_reveal_votes', (rawCode: unknown) => {
      if (rateLimited(socket, 'force_reveal_votes')) {return}
      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = svc.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can force the vote.')}
      if (room.phase !== 'voting') {return emitError(socket, 'Voting is not in progress.')}

      if (!tallyAndBroadcast(nsp, codeResult.value)) {
        return emitError(socket, 'Nothing to tally right now.')
      }
      logger.info('Traitor round tallied (host forced)', { roomCode: codeResult.value })
    })

    // ── end_game (host) ────────────────────────────────────────────────────
    socket.on('end_game', (rawCode: unknown) => {
      if (rateLimited(socket, 'end_game')) {return}
      const codeResult = validateRoomCode(rawCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}

      const room = svc.getRoom(codeResult.value)
      if (!room) {return emitError(socket, 'Room not found.')}
      if (room.hostId !== socket.id) {return emitError(socket, 'Only the host can end the session.')}

      svc.endGame(codeResult.value)
      broadcastState(nsp, codeResult.value)
      nsp.to(codeResult.value).emit('game_ended')
      logger.info('Traitor session ended', { roomCode: codeResult.value })
    })

    // ── remove_player (host) ───────────────────────────────────────────────
    socket.on('remove_player', (payload: unknown) => {
      if (rateLimited(socket, 'remove_player')) {return}
      if (!isObject(payload)) {return emitError(socket, 'Invalid payload.')}
      const codeResult = validateRoomCode(payload.roomCode)
      if (!codeResult.ok) {return emitError(socket, codeResult.error)}
      if (typeof payload.targetPlayerId !== 'string' || !payload.targetPlayerId) {
        return emitError(socket, 'targetPlayerId must be a non-empty string.')
      }

      const result = svc.removeOfflinePlayer(codeResult.value, socket.id, payload.targetPlayerId)
      if (!result.ok) {return emitError(socket, result.error)}

      nsp.to(payload.targetPlayerId).emit('removed_from_room')
      void nsp.in(payload.targetPlayerId).disconnectSockets(true)

      if (result.room) {
        broadcastState(nsp, result.room.code)
        if (svc.resolveIfDeparturesEndedGame(result.room.code)) {
          broadcastState(nsp, result.room.code)
          nsp.to(result.room.code).emit('game_ended')
        } else if (result.room.phase === 'answering' && svc.allAnswersIn(result.room)) {
          svc.revealAnswers(result.room.code)
          broadcastState(nsp, result.room.code)
        } else if (result.room.phase === 'voting' && svc.allVotesIn(result.room)) {
          tallyAndBroadcast(nsp, result.room.code)
        }
      }
      logger.info('Traitor player removed by host', { roomCode: codeResult.value })
    })

    // ── disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      logger.info('Traitor socket disconnected', { socketId: socket.id, reason })
      cleanupSocket(socket.id)

      const room = svc.setPlayerConnected(socket.id, false)
      if (!room) {return}
      broadcastState(nsp, room.code)
      // An AFK player dropping mid-phase may unblock the auto-advance.
      if (room.phase === 'answering' && svc.allAnswersIn(room)) {
        svc.revealAnswers(room.code)
        broadcastState(nsp, room.code)
      } else if (room.phase === 'voting' && !room.roundOutcome && svc.allVotesIn(room)) {
        tallyAndBroadcast(nsp, room.code)
      }
    })
  })
}
