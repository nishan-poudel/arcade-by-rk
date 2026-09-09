/**
 * useTraitorGame – central reactive store for the Traitor game.
 * Mirrors `src/modules/imposter/composables/useGame.ts` (socket subscriptions,
 * all game state, action methods, reconnect / resync / keep-alive) for the
 * separate `/traitor` namespace.
 */
import { ref, computed, watch, type Ref } from 'vue'
import { useTraitorSocket } from './useTraitorSocket.js'
import { useKeepAlive } from './useKeepAlive.js'
import { en as locale } from '@/locales/en'
import type {
  TraitorGameState,
  RoundAssignment,
  TraitorRoundResult,
  TotalRounds,
  TraitorScreen,
  TraitorReconnectInfo,
} from '../types/index.js'

const RECONNECT_KEY = 'traitor_reconnect'
const RESYNC_INTERVAL_MS = 12_000
const MAX_REJOIN_ATTEMPTS = 6
const SLOW_CONNECTION_THRESHOLD_MS = 4000

// ─── Module-level singleton state ────────────────────────────────────────────

const gameState: Ref<TraitorGameState | null> = ref(null)
const myAssignment: Ref<RoundAssignment | null> = ref(null)
const myId: Ref<string> = ref('')
const screen: Ref<TraitorScreen> = ref('landing')
const errorMessage: Ref<string> = ref('')
const noticeMessage: Ref<string> = ref('')
const roomCode: Ref<string> = ref('')
const categories: Ref<string[]> = ref([])

/** My locally-picked answer (a player id), BEFORE pressing lock in. */
const myAnswerSelection: Ref<string> = ref('')
/** My locked answer (a player id); '' until submitted. */
const myAnswer: Ref<string> = ref('')
/** My locally-picked accusation, BEFORE submit. */
const myVoteSelection: Ref<string> = ref('')
/** My locked accusation vote; '' until submitted. */
const myVote: Ref<string> = ref('')

const currentResult: Ref<TraitorRoundResult | null> = ref(null)
const showScoreModal: Ref<boolean> = ref(false)
let dismissedResultForRound = -1

const pendingAction: Ref<'create' | 'join' | null> = ref(null)
const isSlowConnection: Ref<boolean> = ref(false)
let slowConnectionTimer: ReturnType<typeof setTimeout> | null = null

const pendingRoomCodeFromUrl: Ref<string | null> = ref(null)

let resyncTimer: ReturnType<typeof setInterval> | null = null
let onVisibility: (() => void) | null = null
let rejoinRetryTimer: ReturnType<typeof setTimeout> | null = null
let rejoinAttempts = 0
let lastPhase: string | null = null

export function useTraitorGame() {
  const { socket, connect, reconnectNow, disconnect: socketDisconnect } = useTraitorSocket()

  // ── Computed ──────────────────────────────────────────────────────────────

  const isHost = computed(() => {
    if (!gameState.value || !myId.value) {return false}
    return gameState.value.hostId === myId.value
  })

  const me = computed(() => {
    if (!gameState.value || !myId.value) {return null}
    return gameState.value.players.find((p) => p.id === myId.value) ?? null
  })

  const sortedPlayers = computed(() => {
    if (!gameState.value) {return []}
    return [...gameState.value.players].sort((a, b) => b.score - a.score)
  })

  // ── Reconnect helpers ─────────────────────────────────────────────────────

  function attemptRejoin() {
    const saved = getReconnectInfo()
    if (!saved || gameState.value || !socket.connected) {return}
    socket.emit('request_state', { roomCode: saved.roomCode, playerName: saved.playerName })
  }

  function scheduleRejoinRetry() {
    if (rejoinRetryTimer || rejoinAttempts >= MAX_REJOIN_ATTEMPTS) {return}
    rejoinRetryTimer = setTimeout(() => {
      rejoinRetryTimer = null
      rejoinAttempts += 1
      attemptRejoin()
      scheduleRejoinRetry()
    }, 1500)
  }

  function cancelRejoinRetry() {
    rejoinAttempts = 0
    if (rejoinRetryTimer) {
      clearTimeout(rejoinRetryTimer)
      rejoinRetryTimer = null
    }
  }

  let stopRoomWatch: (() => void) | null = null

  // ── Socket listeners (call once from TraitorGame.vue onMounted) ────────────

  function setupListeners() {
    stopRoomWatch?.()
    stopRoomWatch = watch(
      roomCode,
      (code) => (code ? useKeepAlive().start() : useKeepAlive().stop()),
      { immediate: true },
    )

    socket.on('connect', () => {
      myId.value = socket.id ?? ''
      const saved = getReconnectInfo()
      const urlCode = pendingRoomCodeFromUrl.value
      const urlMatchesSaved =
        !!saved && !!urlCode && saved.roomCode.toUpperCase() === urlCode.toUpperCase()
      const inSession = screen.value !== 'landing'
      if (saved && (urlMatchesSaved || inSession)) {
        if (!pendingAction.value && !gameState.value) {startPendingAction('join')}
        cancelRejoinRetry()
        attemptRejoin()
        scheduleRejoinRetry()
      }
    })

    socket.on('categories', (payload: { categories: string[] }) => {
      categories.value = payload.categories
    })

    socket.on('room_created', (payload: { roomCode: string; gameState: TraitorGameState }) => {
      roomCode.value = payload.roomCode
      gameState.value = payload.gameState
      myAssignment.value = null
      lastPhase = payload.gameState.phase
      screen.value = 'waiting'
      errorMessage.value = ''
      clearPendingAction()
      saveReconnectInfo({
        roomCode: payload.roomCode,
        playerName: getMyName(payload.gameState),
        avatar: getMyAvatar(payload.gameState),
        isHost: true,
      })
    })

    socket.on(
      'room_joined',
      (payload: { gameState: TraitorGameState; assignment: RoundAssignment | null }) => {
        cancelRejoinRetry()
        roomCode.value = payload.gameState.roomCode
        gameState.value = payload.gameState
        myAssignment.value = payload.assignment
        lastPhase = payload.gameState.phase
        screen.value = resolveScreen(payload.gameState)
        errorMessage.value = ''
        clearPendingAction()
        saveReconnectInfo({
          roomCode: payload.gameState.roomCode,
          playerName: getMyName(payload.gameState),
          avatar: getMyAvatar(payload.gameState),
          isHost: payload.gameState.hostId === myId.value,
        })
      },
    )

    socket.on(
      'state_synced',
      (payload: {
        gameState: TraitorGameState
        assignment: RoundAssignment | null
        result?: TraitorRoundResult | null
      }) => {
        cancelRejoinRetry()
        roomCode.value = payload.gameState.roomCode
        gameState.value = payload.gameState
        myAssignment.value = payload.assignment
        lastPhase = payload.gameState.phase
        screen.value = resolveScreen(payload.gameState)
        errorMessage.value = ''
        clearPendingAction()
        if (payload.result) {
          currentResult.value = payload.result
          if (dismissedResultForRound !== payload.result.round) {showScoreModal.value = true}
        }
        saveReconnectInfo({
          roomCode: payload.gameState.roomCode,
          playerName: getMyName(payload.gameState),
          avatar: getMyAvatar(payload.gameState),
          isHost: payload.gameState.hostId === myId.value,
        })
      },
    )

    socket.on('game_state', (state: TraitorGameState) => {
      applyPhaseTransition(state.phase)
      gameState.value = state
      const resolved = resolveScreen(state)
      if (resolved !== screen.value) {screen.value = resolved}
    })

    socket.on('round_assignment', (assignment: RoundAssignment) => {
      myAssignment.value = assignment
    })

    socket.on(
      'answer_update',
      (payload: { playerId: string; answeredCount: number; activeCount: number }) => {
        const gs = gameState.value
        if (!gs) {return}
        gameState.value = {
          ...gs,
          players: gs.players.map((p) =>
            p.id === payload.playerId ? { ...p, hasAnswered: true } : p,
          ),
        }
      },
    )

    socket.on(
      'vote_update',
      (payload: { voterId: string; votedCount: number; activeCount: number }) => {
        const gs = gameState.value
        if (!gs) {return}
        gameState.value = {
          ...gs,
          players: gs.players.map((p) =>
            p.id === payload.voterId ? { ...p, hasVoted: true } : p,
          ),
        }
      },
    )

    socket.on('round_result', (result: TraitorRoundResult) => {
      currentResult.value = result
      screen.value = 'result'
      if (dismissedResultForRound !== result.round) {showScoreModal.value = true}
    })

    socket.on('game_ended', () => {
      screen.value = 'over'
      clearReconnectInfo()
      useKeepAlive().stop()
    })

    socket.on('removed_from_room', () => {
      errorMessage.value = locale.traitor.errors.removedByHost
      leaveGame()
    })

    socket.on('error', (payload: { message: string }) => {
      if (rejoinRetryTimer && !gameState.value) {return}
      if (screen.value === 'voting' && !me.value?.hasVoted) {myVote.value = ''}
      if (screen.value === 'answering' && !me.value?.hasAnswered) {myAnswer.value = ''}
      errorMessage.value = payload.message
      clearPendingAction()
    })

    socket.on('connect_error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('Traitor socket connect_error:', err.message)
    })

    socket.on('reconnect_failed', () => {
      errorMessage.value = locale.traitor.errors.reconnectFailed
      clearPendingAction()
    })

    // ── Safety-net resync + tab-focus ───────────────────────────────────────
    stopResyncLoop()
    resyncTimer = setInterval(() => {
      if (socket.connected && roomCode.value && screen.value !== 'landing') {
        socket.emit('request_state', {
          roomCode: roomCode.value,
          playerName: getReconnectInfo()?.playerName ?? '',
        })
      }
    }, RESYNC_INTERVAL_MS)

    onVisibility = () => {
      if (document.visibilityState === 'visible' && screen.value !== 'landing') {
        connect()
        if (socket.connected && roomCode.value) {
          socket.emit('request_state', {
            roomCode: roomCode.value,
            playerName: getReconnectInfo()?.playerName ?? '',
          })
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
  }

  function stopResyncLoop() {
    if (resyncTimer) {
      clearInterval(resyncTimer)
      resyncTimer = null
    }
  }

  function teardownListeners() {
    for (const ev of [
      'connect', 'categories', 'room_created', 'room_joined', 'state_synced', 'game_state',
      'round_assignment', 'answer_update', 'vote_update', 'round_result', 'game_ended',
      'removed_from_room', 'error', 'connect_error', 'reconnect_failed',
    ]) {
      socket.off(ev)
    }
    stopResyncLoop()
    cancelRejoinRetry()
    stopRoomWatch?.()
    stopRoomWatch = null
    if (onVisibility) {
      document.removeEventListener('visibilitychange', onVisibility)
      onVisibility = null
    }
  }

  /** Reset per-round local UI state when the server moves us into a new phase. */
  function applyPhaseTransition(phase: string) {
    if (phase === lastPhase) {return}
    if (phase === 'answering') {
      myAnswer.value = ''
      myAnswerSelection.value = ''
      myVote.value = ''
      myVoteSelection.value = ''
      currentResult.value = null
      showScoreModal.value = false
    } else if (phase === 'voting') {
      myVote.value = ''
      myVoteSelection.value = ''
    }
    lastPhase = phase
  }

  // ── Pending action (loading state) ────────────────────────────────────────

  function startPendingAction(action: 'create' | 'join') {
    pendingAction.value = action
    isSlowConnection.value = false
    if (slowConnectionTimer) {clearTimeout(slowConnectionTimer)}
    slowConnectionTimer = setTimeout(() => {
      if (pendingAction.value) {isSlowConnection.value = true}
    }, SLOW_CONNECTION_THRESHOLD_MS)
  }

  function clearPendingAction() {
    pendingAction.value = null
    isSlowConnection.value = false
    if (slowConnectionTimer) {
      clearTimeout(slowConnectionTimer)
      slowConnectionTimer = null
    }
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function createRoom(hostName: string, avatar: string, category: string, totalRounds: TotalRounds) {
    errorMessage.value = ''
    startPendingAction('create')
    connect()
    socket.emit('create_room', { hostName, avatar, category, totalRounds })
  }

  function joinRoom(code: string, playerName: string, avatar: string) {
    errorMessage.value = ''
    startPendingAction('join')
    connect()
    socket.emit('join_room', { roomCode: code.toUpperCase(), playerName, avatar })
  }

  function setReady(ready: boolean) {
    socket.emit('set_ready', { roomCode: roomCode.value, ready })
  }

  function setCategory(category: string) {
    socket.emit('set_category', { roomCode: roomCode.value, category })
  }

  function setTotalRounds(totalRounds: TotalRounds) {
    socket.emit('set_total_rounds', { roomCode: roomCode.value, totalRounds })
  }

  function startRound() {
    socket.emit('start_round', roomCode.value)
  }

  function selectAnswer(pickedPlayerId: string) {
    if (myAnswer.value) {return}
    myAnswerSelection.value = pickedPlayerId
  }

  function submitAnswer() {
    const pick = myAnswerSelection.value
    if (!pick || myAnswer.value) {return}
    myAnswer.value = pick
    socket.emit('submit_answer', { roomCode: roomCode.value, pickedPlayerId: pick })
  }

  function forceRevealAnswers() {
    socket.emit('force_reveal_answers', roomCode.value)
  }

  function openVote() {
    socket.emit('open_vote', roomCode.value)
  }

  function selectVote(votedPlayerId: string) {
    if (myVote.value) {return}
    myVoteSelection.value = votedPlayerId
  }

  function submitVote() {
    const pick = myVoteSelection.value
    if (!pick || myVote.value) {return}
    myVote.value = pick
    socket.emit('submit_vote', { roomCode: roomCode.value, votedPlayerId: pick })
  }

  function forceRevealVotes() {
    socket.emit('force_reveal_votes', roomCode.value)
  }

  function nextRound() {
    socket.emit('next_round', roomCode.value)
  }

  function endGame() {
    socket.emit('end_game', roomCode.value)
  }

  function removePlayer(targetPlayerId: string) {
    socket.emit('remove_player', { roomCode: roomCode.value, targetPlayerId })
  }

  function refreshNow() {
    errorMessage.value = ''
    const saved = getReconnectInfo()
    const code = roomCode.value || saved?.roomCode || ''
    if (!code) {return}
    if (!socket.connected) {
      reconnectNow()
      return
    }
    socket.emit('request_state', { roomCode: code, playerName: saved?.playerName ?? '' })
  }

  function dismissScoreModal() {
    showScoreModal.value = false
    if (currentResult.value) {dismissedResultForRound = currentResult.value.round}
  }

  function leaveGame() {
    clearReconnectInfo()
    clearPendingAction()
    stopResyncLoop()
    cancelRejoinRetry()
    socketDisconnect()
    useKeepAlive().stop()
    gameState.value = null
    myAssignment.value = null
    myId.value = ''
    screen.value = 'landing'
    errorMessage.value = ''
    noticeMessage.value = ''
    roomCode.value = ''
    lastPhase = null
    dismissedResultForRound = -1
    myAnswer.value = ''
    myAnswerSelection.value = ''
    myVote.value = ''
    myVoteSelection.value = ''
    currentResult.value = null
    showScoreModal.value = false
  }

  // ── Session persistence ──────────────────────────────────────────────────

  function saveReconnectInfo(info: TraitorReconnectInfo) {
    sessionStorage.setItem(RECONNECT_KEY, JSON.stringify(info))
  }

  function getReconnectInfo(): TraitorReconnectInfo | null {
    const raw = sessionStorage.getItem(RECONNECT_KEY)
    if (!raw) {return null}
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function clearReconnectInfo() {
    sessionStorage.removeItem(RECONNECT_KEY)
  }

  function setPendingRoomCodeFromUrl(code: string | null) {
    pendingRoomCodeFromUrl.value = code ? code.toUpperCase() : null
  }

  function getSavedPlayerNameForRoom(code: string): string | null {
    const saved = getReconnectInfo()
    if (saved && saved.roomCode.toUpperCase() === code.toUpperCase()) {return saved.playerName}
    return null
  }

  function getSavedAvatar(): string | null {
    return getReconnectInfo()?.avatar ?? null
  }

  function getMyName(state: TraitorGameState): string {
    return state.players.find((p) => p.id === myId.value)?.name ?? ''
  }

  function getMyAvatar(state: TraitorGameState): string {
    return state.players.find((p) => p.id === myId.value)?.avatar ?? '🕵️'
  }

  function resolveScreen(state: TraitorGameState): TraitorScreen {
    if (screen.value === 'over') {return 'over'}
    switch (state.phase) {
      case 'lobby': return 'waiting'
      case 'answering': return 'answering'
      case 'discussion': return 'discussion'
      case 'voting': return 'voting'
      case 'roundResult': return 'result'
      case 'ended': return 'over'
      default: return 'landing'
    }
  }

  return {
    // State
    gameState,
    myAssignment,
    myId,
    screen,
    errorMessage,
    noticeMessage,
    roomCode,
    categories,
    myAnswer,
    myAnswerSelection,
    myVote,
    myVoteSelection,
    currentResult,
    showScoreModal,
    pendingAction,
    isSlowConnection,
    // Computed
    isHost,
    me,
    sortedPlayers,
    // Lifecycle
    connect,
    setupListeners,
    teardownListeners,
    // Actions
    createRoom,
    joinRoom,
    setReady,
    setCategory,
    setTotalRounds,
    startRound,
    selectAnswer,
    submitAnswer,
    forceRevealAnswers,
    openVote,
    selectVote,
    submitVote,
    forceRevealVotes,
    nextRound,
    endGame,
    removePlayer,
    refreshNow,
    dismissScoreModal,
    leaveGame,
    setPendingRoomCodeFromUrl,
    getSavedPlayerNameForRoom,
    getSavedAvatar,
  }
}
