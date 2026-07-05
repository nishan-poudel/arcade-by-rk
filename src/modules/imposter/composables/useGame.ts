/**
 * useGame – central reactive store for the Imposter game.
 *
 * Manages:
 *  - Socket event subscriptions (set up once in ImposterGame.vue)
 *  - All game state (gameState, myAssignment, myId, screen)
 *  - Action methods emitted to the server
 */
import { ref, computed, type Ref } from 'vue'
import { useSocket } from './useSocket.js'
import type {
  GameState,
  PlayerAssignment,
  GameReveal,
  Difficulty,
  AppScreen,
  ReconnectInfo,
} from '../types/index.js'

const RECONNECT_KEY = 'imposter_reconnect'

// ─── Module-level singleton state ─────────────────────────────────────────────
// (all refs created once; callers share the same reactive objects)

const gameState: Ref<GameState | null> = ref(null)
const myAssignment: Ref<PlayerAssignment | null> = ref(null)
const myId: Ref<string> = ref('')
const screen: Ref<AppScreen> = ref('landing')
const errorMessage: Ref<string> = ref('')
const roomCode: Ref<string> = ref('')
/** Locally remembers who *I* voted for this round (server also tracks hasVoted per player) */
const myVote: Ref<string> = ref('')
const currentReveal: Ref<GameReveal | null> = ref(null)

/**
 * Tracks which action ('create' | 'join') is currently waiting on a server
 * response, so the UI can show a loading state instead of appearing frozen.
 * Most relevant on free-tier hosts (e.g. Render) where the backend may be
 * asleep and take 30-50s to wake up on the first request.
 */
const pendingAction: Ref<'create' | 'join' | null> = ref(null)
/** True once a pending action has taken long enough that it's likely a cold start. */
const isSlowConnection: Ref<boolean> = ref(false)
let slowConnectionTimer: ReturnType<typeof setTimeout> | null = null

const SLOW_CONNECTION_THRESHOLD_MS = 4000

export function useGame() {
  const { socket, connect, disconnect: socketDisconnect } = useSocket()

  // ── Computed helpers ──────────────────────────────────────────────────────

  const isHost = computed(() => {
    if (!gameState.value || !myId.value) {return false}
    return gameState.value.hostId === myId.value
  })

  const me = computed(() => {
    if (!gameState.value || !myId.value) {return null}
    return gameState.value.players.find((p) => p.id === myId.value) ?? null
  })

  const isMyTurn = computed(() => {
    if (!gameState.value || !myId.value) {return false}
    return gameState.value.currentTurnPlayerId === myId.value
  })

  const sortedPlayers = computed(() => {
    if (!gameState.value) {return []}
    return [...gameState.value.players].sort((a, b) => b.score - a.score)
  })

  // ── Socket event setup (call once from ImposterGame.vue onMounted) ────────

  function setupListeners() {
    // Capture our own socket ID on (re)connect
    socket.on('connect', () => {
      myId.value = socket.id ?? ''

      // Only attempt to restore session if the user was actively in a game
      // (screen is not 'landing'). Firing rejoin on every fresh connection
      // from stale sessionStorage caused a race with create_room/join_room.
      const saved = getReconnectInfo()
      if (saved && screen.value !== 'landing' && !gameState.value) {
        socket.emit('rejoin_room', { roomCode: saved.roomCode, playerName: saved.playerName })
      }
    })

    socket.on('room_created', (payload: { roomCode: string; gameState: GameState; assignment: PlayerAssignment }) => {
      roomCode.value = payload.roomCode
      gameState.value = payload.gameState
      myAssignment.value = payload.assignment
      screen.value = 'waiting'
      errorMessage.value = ''
      clearPendingAction()
      saveReconnectInfo({
        roomCode: payload.roomCode,
        playerName: getMyName(payload.gameState),
        isHost: true,
      })
    })

    socket.on('room_joined', (payload: { gameState: GameState; assignment: PlayerAssignment }) => {
      roomCode.value = payload.gameState.roomCode
      gameState.value = payload.gameState
      myAssignment.value = payload.assignment
      // Could be reconnecting mid-game
      screen.value = resolveScreen(payload.gameState)
      errorMessage.value = ''
      clearPendingAction()
      saveReconnectInfo({
        roomCode: payload.gameState.roomCode,
        playerName: getMyName(payload.gameState),
        isHost: payload.gameState.hostId === myId.value,
      })
    })

    socket.on('game_state', (state: GameState) => {
      gameState.value = state
      // Keep screen in sync with phase when it advances
      const resolved = resolveScreen(state)
      if (resolved !== screen.value) {screen.value = resolved}
    })

    socket.on('player_assignment', (assignment: PlayerAssignment) => {
      myAssignment.value = assignment
    })

    socket.on('discussion_time', () => {
      screen.value = 'discussion'
      myVote.value = ''
    })

    socket.on('round_reveal', (reveal: GameReveal) => {
      currentReveal.value = reveal
      screen.value = 'reveal'
    })

    socket.on('game_ended', () => {
      screen.value = 'over'
      clearReconnectInfo()
    })

    socket.on('error', (payload: { message: string }) => {
      errorMessage.value = payload.message
      clearPendingAction()
    })

    // Surface connection failures to the user instead of failing silently.
    // Without this, a misconfigured VITE_SOCKET_URL / CORS_ORIGINS in prod
    // means clicking "Create Room" or "Join Room" appears to do nothing.
    // NOTE: socket.io keeps auto-retrying after this (reconnection: true), so
    // we deliberately do NOT clear pendingAction here — a cold-starting free
    // host (e.g. Render) fires connect_error a few times before succeeding,
    // and clearing the loading state here would flash "idle" between retries.
    socket.on('connect_error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.error('Socket connect_error:', err.message)
    })

    socket.on('reconnect_failed', () => {
      errorMessage.value = 'Lost connection to the game server. Please refresh the page.'
      clearPendingAction()
    })
  }

  function teardownListeners() {
    socket.off('connect')
    socket.off('room_created')
    socket.off('room_joined')
    socket.off('game_state')
    socket.off('player_assignment')
    socket.off('discussion_time')
    socket.off('round_reveal')
    socket.off('game_ended')
    socket.off('error')
    socket.off('connect_error')
    socket.off('reconnect_failed')
  }

  // ── Actions (emit to server) ──────────────────────────────────────────────

  /** Begin tracking a pending create/join action; flips isSlowConnection on after a delay. */
  function startPendingAction(action: 'create' | 'join') {
    pendingAction.value = action
    isSlowConnection.value = false
    if (slowConnectionTimer) {clearTimeout(slowConnectionTimer)}
    slowConnectionTimer = setTimeout(() => {
      if (pendingAction.value) {isSlowConnection.value = true}
    }, SLOW_CONNECTION_THRESHOLD_MS)
  }

  /** Clear pending action state (on success, error, or reconnect failure). */
  function clearPendingAction() {
    pendingAction.value = null
    isSlowConnection.value = false
    if (slowConnectionTimer) {
      clearTimeout(slowConnectionTimer)
      slowConnectionTimer = null
    }
  }

  function createRoom(hostName: string, difficulty: Difficulty, imposterCount: number) {
    errorMessage.value = ''
    startPendingAction('create')
    connect()  // reconnect if the user is returning from a previous game
    socket.emit('create_room', { hostName, difficulty, imposterCount })
  }

  function joinRoom(code: string, playerName: string) {
    errorMessage.value = ''
    startPendingAction('join')
    connect()  // reconnect if the user is returning from a previous game
    socket.emit('join_room', { roomCode: code.toUpperCase(), playerName })
  }

  function startGame() {
    socket.emit('start_game', roomCode.value)
  }

  function playerDone() {
    socket.emit('player_done', roomCode.value)
  }

  /** Cast (or change) my vote for who I think the imposter is. */
  function submitVote(votedPlayerId: string) {
    myVote.value = votedPlayerId
    socket.emit('submit_vote', { roomCode: roomCode.value, votedPlayerId })
  }

  /** Host-only: tally votes now, even if not everyone has voted. */
  function forceRevealVotes() {
    socket.emit('force_reveal_votes', roomCode.value)
  }

  function nextRound() {
    myVote.value = ''
    currentReveal.value = null
    socket.emit('next_round', roomCode.value)
  }

  function endGame() {
    socket.emit('end_game', roomCode.value)
  }

  function resetScores() {
    socket.emit('reset_scores', roomCode.value)
  }

  function setDifficulty(difficulty: Difficulty) {
    socket.emit('set_difficulty', { roomCode: roomCode.value, difficulty })
  }

  function setImposterCount(count: number) {
    socket.emit('set_imposter_count', { roomCode: roomCode.value, imposterCount: count })
  }

  function skipTurn() {
    socket.emit('skip_turn', roomCode.value)
  }

  function leaveGame() {
    clearReconnectInfo()
    clearPendingAction()
    socketDisconnect()
    gameState.value = null
    myAssignment.value = null
    myId.value = ''
    screen.value = 'landing'
    errorMessage.value = ''
    roomCode.value = ''
    myVote.value = ''
    currentReveal.value = null
  }

  // ── Session persistence helpers ───────────────────────────────────────────

  function saveReconnectInfo(info: ReconnectInfo) {
    sessionStorage.setItem(RECONNECT_KEY, JSON.stringify(info))
  }

  function getReconnectInfo(): ReconnectInfo | null {
    const raw = sessionStorage.getItem(RECONNECT_KEY)
    if (!raw) {return null}
    try { return JSON.parse(raw) } catch { return null }
  }

  function clearReconnectInfo() {
    sessionStorage.removeItem(RECONNECT_KEY)
  }

  function getMyName(state: GameState): string {
    const player = state.players.find((p) => p.id === myId.value)
    return player?.name ?? ''
  }

  /**
   * Derive the correct screen from the server game phase.
   *
   * IMPORTANT: the `reveal` and `over` screens are client-side-only states
   * driven by dedicated events (`round_reveal`, `game_ended`). A `game_state`
   * broadcast must never reset those screens, so we skip the update when the
   * player is already past the phase that triggered them.
   */
  function resolveScreen(state: GameState): AppScreen {
    // Never step backward from a more-advanced client screen
    if (screen.value === 'reveal' && state.phase === 'discussion') {return 'reveal'}
    if (screen.value === 'over') {return 'over'}

    switch (state.phase) {
      case 'lobby':      return 'waiting'
      case 'playing':    return 'game'
      case 'discussion': return 'discussion'
      case 'ended':      return 'over'
      default:           return 'landing'
    }
  }

  return {
    // State
    gameState,
    myAssignment,
    myId,
    screen,
    errorMessage,
    roomCode,
    myVote,
    currentReveal,
    pendingAction,
    isSlowConnection,
    // Computed
    isHost,
    me,
    isMyTurn,
    sortedPlayers,
    // Lifecycle
    connect,
    setupListeners,
    teardownListeners,
    // Actions
    createRoom,
    joinRoom,
    startGame,
    playerDone,
    submitVote,
    forceRevealVotes,
    nextRound,
    endGame,
    resetScores,
    setDifficulty,
    setImposterCount,
    skipTurn,
    leaveGame,
  }
}
