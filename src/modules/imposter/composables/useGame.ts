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
const lastResult: Ref<{ imposterCaught: boolean } | null> = ref(null)
const currentReveal: Ref<GameReveal | null> = ref(null)

export function useGame() {
  const { socket, connect, disconnect: socketDisconnect } = useSocket()

  // ── Computed helpers ──────────────────────────────────────────────────────

  const isHost = computed(() => {
    if (!gameState.value || !myId.value) return false
    return gameState.value.hostId === myId.value
  })

  const me = computed(() => {
    if (!gameState.value || !myId.value) return null
    return gameState.value.players.find((p) => p.id === myId.value) ?? null
  })

  const isMyTurn = computed(() => {
    if (!gameState.value || !myId.value) return false
    return gameState.value.currentTurnPlayerId === myId.value
  })

  const sortedPlayers = computed(() => {
    if (!gameState.value) return []
    return [...gameState.value.players].sort((a, b) => b.score - a.score)
  })

  // ── Socket event setup (call once from ImposterGame.vue onMounted) ────────

  function setupListeners() {
    // Capture our own socket ID on (re)connect
    socket.on('connect', () => {
      myId.value = socket.id ?? ''

      // Attempt to restore session after disconnect
      const saved = getReconnectInfo()
      if (saved && !gameState.value) {
        socket.emit('rejoin_room', { roomCode: saved.roomCode, playerName: saved.playerName })
      }
    })

    socket.on('room_created', (payload: { roomCode: string; gameState: GameState; assignment: PlayerAssignment }) => {
      roomCode.value = payload.roomCode
      gameState.value = payload.gameState
      myAssignment.value = payload.assignment
      screen.value = 'waiting'
      errorMessage.value = ''
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
      if (resolved !== screen.value) screen.value = resolved
    })

    socket.on('player_assignment', (assignment: PlayerAssignment) => {
      myAssignment.value = assignment
    })

    socket.on('discussion_time', () => {
      screen.value = 'discussion'
    })

    socket.on('result_recorded', (payload: { imposterCaught: boolean }) => {
      lastResult.value = payload
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
    })
  }

  function teardownListeners() {
    socket.off('connect')
    socket.off('room_created')
    socket.off('room_joined')
    socket.off('game_state')
    socket.off('player_assignment')
    socket.off('discussion_time')
    socket.off('result_recorded')
    socket.off('round_reveal')
    socket.off('game_ended')
    socket.off('error')
  }

  // ── Actions (emit to server) ──────────────────────────────────────────────

  function createRoom(hostName: string, difficulty: Difficulty, imposterCount: number) {
    errorMessage.value = ''
    socket.emit('create_room', { hostName, difficulty, imposterCount })
  }

  function joinRoom(code: string, playerName: string) {
    errorMessage.value = ''
    socket.emit('join_room', { roomCode: code.toUpperCase(), playerName })
  }

  function startGame() {
    socket.emit('start_game', roomCode.value)
  }

  function playerDone() {
    socket.emit('player_done', roomCode.value)
  }

  function recordResult(imposterCaught: boolean) {
    socket.emit('record_result', { roomCode: roomCode.value, imposterCaught })
  }

  function nextRound() {
    lastResult.value = null
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
    socketDisconnect()
    gameState.value = null
    myAssignment.value = null
    myId.value = ''
    screen.value = 'landing'
    errorMessage.value = ''
    roomCode.value = ''
    lastResult.value = null
    currentReveal.value = null
  }

  // ── Session persistence helpers ───────────────────────────────────────────

  function saveReconnectInfo(info: ReconnectInfo) {
    sessionStorage.setItem(RECONNECT_KEY, JSON.stringify(info))
  }

  function getReconnectInfo(): ReconnectInfo | null {
    const raw = sessionStorage.getItem(RECONNECT_KEY)
    if (!raw) return null
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
    if (screen.value === 'reveal' && state.phase === 'discussion') return 'reveal'
    if (screen.value === 'over') return 'over'

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
    lastResult,
    currentReveal,
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
    recordResult,
    nextRound,
    endGame,
    resetScores,
    setDifficulty,
    setImposterCount,
    skipTurn,
    leaveGame,
  }
}
