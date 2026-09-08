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
import { useKeepAlive } from './useKeepAlive.js'
import { en as locale } from '@/locales/en'
import type {
  GameState,
  PlayerAssignment,
  GameResult,
  EjectionResult,
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
/** Transient, non-alarming status line (e.g. "Host changed the word"). */
const noticeMessage: Ref<string> = ref('')
const roomCode: Ref<string> = ref('')

/** Safety-net resync loop + tab-focus handler (set up in setupListeners). */
let resyncTimer: ReturnType<typeof setInterval> | null = null
let onVisibility: (() => void) | null = null
const RESYNC_INTERVAL_MS = 12_000

/** Auto-rejoin retry backoff (server may not have seen our old socket drop yet). */
let rejoinRetryTimer: ReturnType<typeof setTimeout> | null = null
let rejoinAttempts = 0
const MAX_REJOIN_ATTEMPTS = 6
/** My locally-picked candidate this round, BEFORE pressing Submit (never emitted) */
const myVoteSelection: Ref<string> = ref('')
/** Who I submitted my (now locked) vote for this round; '' until Submit */
const myVote: Ref<string> = ref('')
/** Full result of the finished game — drives the reveal screen + score modal */
const currentResult: Ref<GameResult | null> = ref(null)
/** Whether the end-of-game score modal is showing */
const showScoreModal: Ref<boolean> = ref(false)
/** Game number whose score modal the player already dismissed (don't re-pop on resync) */
let dismissedResultForGame = -1
/** Transient "X was voted out" overlay shown between voting rounds */
const ejectionNotice: Ref<
  (EjectionResult & { isMe: boolean }) | null
> = ref(null)
let ejectionNoticeTimer: ReturnType<typeof setTimeout> | null = null

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

/**
 * Room code read from the current URL (e.g. /ABC123) at mount time.
 * Set by ImposterGame.vue so the socket `connect` handler below can decide
 * whether a saved reconnect session matches the room the user actually
 * navigated to — this is what makes "refresh the page while in a room" and
 * "open a shared room link" both attempt to reconnect automatically.
 */
const pendingRoomCodeFromUrl: Ref<string | null> = ref(null)

const SLOW_CONNECTION_THRESHOLD_MS = 4000

export function useGame() {
  const { socket, connect, reconnectNow, disconnect: socketDisconnect } = useSocket()

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

  /**
   * Emit `request_state` for the saved session and, if it keeps failing
   * (e.g. the server hasn't yet processed the old socket's disconnect after a
   * fast refresh), keep retrying on a short backoff until it lands.
   */
  function attemptRejoin() {
    const saved = getReconnectInfo()
    if (!saved || gameState.value) {return}
    if (!socket.connected) {return}
    socket.emit('request_state', { roomCode: saved.roomCode, playerName: saved.playerName })
  }

  function scheduleRejoinRetry() {
    if (rejoinRetryTimer) {return}
    if (rejoinAttempts >= MAX_REJOIN_ATTEMPTS) {return}
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

  // ── Socket event setup (call once from ImposterGame.vue onMounted) ────────

  function setupListeners() {
    // Capture our own socket ID and (re)attach to our room on EVERY connect.
    //
    // This fires on the very first connect, on every socket.io auto-reconnect
    // after a drop, and after connectionStateRecovery. In all of those cases
    // — first load via a shared link, a page refresh, a phone waking from
    // sleep, a Wi-Fi blip mid-round — we want to end up back in the game with
    // the latest state. `request_state` handles both "server still knows me"
    // (fast path) and "server forgot me / restarted" (falls back to a full
    // rejoin by name), so it's safe to call unconditionally.
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
      cancelRejoinRetry()
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

    // Fresh authoritative snapshot in reply to `request_state` (manual Refresh,
    // periodic resync, tab-focus, or a reconnect). Includes our private
    // assignment so a refreshed client never loses its role/word.
    socket.on(
      'state_synced',
      (payload: {
        gameState: GameState
        assignment: PlayerAssignment
        result?: GameResult | null
      }) => {
        cancelRejoinRetry()
        roomCode.value = payload.gameState.roomCode
        gameState.value = payload.gameState
        myAssignment.value = payload.assignment
        screen.value = resolveScreen(payload.gameState)
        errorMessage.value = ''
        clearPendingAction()
        // Restore the finished-game result (+ its modal) after a refresh,
        // unless this player already dismissed it.
        if (payload.result) {
          currentResult.value = payload.result
          if (dismissedResultForGame !== payload.result.round) {showScoreModal.value = true}
        }
        saveReconnectInfo({
          roomCode: payload.gameState.roomCode,
          playerName: getMyName(payload.gameState),
          isHost: payload.gameState.hostId === myId.value,
        })
      },
    )

    socket.on('game_state', (state: GameState) => {
      gameState.value = state
      // Keep screen in sync with phase when it advances
      const resolved = resolveScreen(state)
      if (resolved !== screen.value) {screen.value = resolved}
    })

    // Host swapped the word — a whole fresh game starts.
    socket.on('word_changed', () => {
      resetGameLocalState()
      noticeMessage.value = locale.imposter.common.wordChanged
      setTimeout(() => {
        if (noticeMessage.value === locale.imposter.common.wordChanged) {noticeMessage.value = ''}
      }, 3500)
    })

    // Host removed us (we were offline). Drop the session cleanly.
    socket.on('removed_from_room', () => {
      errorMessage.value = locale.imposter.errors.removedByHost
      leaveGame()
    })

    socket.on('player_assignment', (assignment: PlayerAssignment) => {
      myAssignment.value = assignment
    })

    socket.on('discussion_time', () => {
      screen.value = 'discussion'
      myVote.value = ''; myVoteSelection.value = ''
    })

    // A player was voted out. Transient overlay; the game continues unless
    // `gameOver` (in which case `game_result` follows and moves us to reveal).
    socket.on('ejection_result', (payload: EjectionResult) => {
      myVote.value = ''; myVoteSelection.value = ''
      showEjectionNotice({ ...payload, isMe: payload.ejectedId === myId.value })
    })

    // A tie / no clear vote — nobody out, vote again.
    socket.on('vote_tie', () => {
      myVote.value = ''; myVoteSelection.value = ''
      noticeMessage.value = locale.imposter.playerScreen.voteTie
      setTimeout(() => {
        if (noticeMessage.value === locale.imposter.playerScreen.voteTie) {noticeMessage.value = ''}
      }, 3000)
    })

    // Game decided — show the reveal + pop the score modal.
    socket.on('game_result', (result: GameResult) => {
      currentResult.value = result
      screen.value = 'reveal'
      if (dismissedResultForGame !== result.round) {showScoreModal.value = true}
    })

    socket.on('game_ended', () => {
      screen.value = 'over'
      clearReconnectInfo()
    })

    socket.on('error', (payload: { message: string }) => {
      // While we're still retrying an auto-rejoin (e.g. the server hasn't
      // processed our old socket's disconnect yet after a fast refresh), stay
      // quiet and let the backoff do its job instead of flashing an error.
      if (rejoinRetryTimer && !gameState.value) {return}
      // A rejected vote submit (rare race): roll back the optimistic lock so the
      // player can try again. The server's `hasVoted` broadcast is the truth.
      if (screen.value === 'discussion' && !me.value?.hasVoted) {
        myVote.value = ''
      }
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
      errorMessage.value = locale.imposter.errors.reconnectFailed
      clearPendingAction()
    })

    // ── Safety-net resync ────────────────────────────────────────────────────
    // Socket.IO delivers events reliably *while connected*, but a phone that
    // backgrounds the tab, a flaky hotspot, or a server hiccup can still let a
    // client drift a few seconds behind. A cheap periodic `request_state`
    // (server replies only to this one socket) guarantees every client
    // re-converges on the authoritative state within seconds — no page reload.
    stopResyncLoop()
    resyncTimer = setInterval(() => {
      if (socket.connected && roomCode.value && screen.value !== 'landing') {
        socket.emit('request_state', {
          roomCode: roomCode.value,
          playerName: getReconnectInfo()?.playerName ?? '',
        })
      }
    }, RESYNC_INTERVAL_MS)

    // Resync the instant the user returns to the tab (mobile browsers freeze
    // background sockets — this is the #1 cause of "I didn't see the update").
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

  /** Clear the per-game local UI state (called on new game / word swap / leave). */
  function resetGameLocalState() {
    myVote.value = ''
    myVoteSelection.value = ''
    currentResult.value = null
    showScoreModal.value = false
    if (ejectionNoticeTimer) {clearTimeout(ejectionNoticeTimer)}
    ejectionNotice.value = null
  }

  /** Show the "X was voted out" overlay for a few seconds. */
  function showEjectionNotice(payload: EjectionResult & { isMe: boolean }) {
    if (ejectionNoticeTimer) {clearTimeout(ejectionNoticeTimer)}
    ejectionNotice.value = payload
    // Shorter when the game-over reveal is about to take over the screen;
    // longer for the player who just got voted out.
    let ms = 4000
    if (payload.gameOver) {ms = 2600}
    else if (payload.isMe) {ms = 5000}
    ejectionNoticeTimer = setTimeout(() => { ejectionNotice.value = null }, ms)
  }

  function dismissScoreModal() {
    showScoreModal.value = false
    if (currentResult.value) {dismissedResultForGame = currentResult.value.round}
  }

  function teardownListeners() {
    socket.off('connect')
    socket.off('room_created')
    socket.off('room_joined')
    socket.off('state_synced')
    socket.off('game_state')
    socket.off('player_assignment')
    socket.off('discussion_time')
    socket.off('ejection_result')
    socket.off('vote_tie')
    socket.off('game_result')
    socket.off('word_changed')
    socket.off('removed_from_room')
    socket.off('game_ended')
    socket.off('error')
    socket.off('connect_error')
    socket.off('reconnect_failed')
    stopResyncLoop()
    cancelRejoinRetry()
    if (onVisibility) {
      document.removeEventListener('visibilitychange', onVisibility)
      onVisibility = null
    }
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

  /** Pick a candidate locally (nothing is sent until Submit). */
  function selectVote(votedPlayerId: string) {
    if (myVote.value) {return} // already locked
    myVoteSelection.value = votedPlayerId
  }

  /** Lock in my selected vote. One submission per round — can't change after. */
  function submitVote() {
    const pick = myVoteSelection.value
    if (!pick || myVote.value) {return}
    myVote.value = pick // optimistic; server confirms via hasVoted
    socket.emit('submit_vote', { roomCode: roomCode.value, votedPlayerId: pick })
  }

  /** Host-only: tally votes now, even if not everyone has voted. */
  function forceRevealVotes() {
    socket.emit('force_reveal_votes', roomCode.value)
  }

  /** Host-only: start a brand-new game (new word, new imposter). */
  function nextRound() {
    resetGameLocalState()
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

  /** Host-only: swap the current word for a fresh one (scraps the game in progress). */
  function changeWord() {
    resetGameLocalState()
    socket.emit('change_word', roomCode.value)
  }

  /** Host-only: remove an offline player from the room. */
  function removePlayer(targetPlayerId: string) {
    socket.emit('remove_player', { roomCode: roomCode.value, targetPlayerId })
  }

  /**
   * Manual "Refresh" — pull the latest state (and reconnect first if needed)
   * without a full page reload. Bound to the reconnect banner button.
   */
  function refreshNow() {
    errorMessage.value = ''
    const saved = getReconnectInfo()
    const code = roomCode.value || saved?.roomCode || ''
    if (!code) {return}
    if (!socket.connected) {
      reconnectNow()
      // The `connect` handler will fire request_state once the socket is up.
      return
    }
    socket.emit('request_state', { roomCode: code, playerName: saved?.playerName ?? '' })
  }

  function leaveGame() {
    clearReconnectInfo()
    clearPendingAction()
    stopResyncLoop()
    cancelRejoinRetry()
    socketDisconnect()
    useKeepAlive().disable()
    gameState.value = null
    myAssignment.value = null
    myId.value = ''
    screen.value = 'landing'
    errorMessage.value = ''
    noticeMessage.value = ''
    roomCode.value = ''
    dismissedResultForGame = -1
    resetGameLocalState()
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

  /**
   * Called by ImposterGame.vue on mount with the room code parsed from the
   * URL (if any), so the `connect` handler above knows which saved session
   * (if any) it should attempt to restore.
   */
  function setPendingRoomCodeFromUrl(code: string | null) {
    pendingRoomCodeFromUrl.value = code ? code.toUpperCase() : null
  }

  /**
   * If a saved reconnect session exists for the given room code, return the
   * player name that was saved — used to pre-fill the Join form when a
   * shared room link is opened but the auto-rejoin hasn't (yet) succeeded.
   */
  function getSavedPlayerNameForRoom(code: string): string | null {
    const saved = getReconnectInfo()
    if (saved && saved.roomCode.toUpperCase() === code.toUpperCase()) {return saved.playerName}
    return null
  }

  function getMyName(state: GameState): string {
    const player = state.players.find((p) => p.id === myId.value)
    return player?.name ?? ''
  }

  /**
   * Derive the correct screen from the server game state.
   *
   * The `over` screen is client-only (driven by `game_ended`). The `reveal`
   * screen is driven by `game_result` but is ALSO derivable from the state:
   * once `gameOutcome` is set the game is decided, so a `game_state` broadcast
   * (or a reconnect) during the reveal must resolve to `reveal`, not step back
   * to `discussion`.
   */
  function resolveScreen(state: GameState): AppScreen {
    if (screen.value === 'over') {return 'over'}
    if (state.gameOutcome) {return 'reveal'}

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
    noticeMessage,
    roomCode,
    myVote,
    myVoteSelection,
    currentResult,
    showScoreModal,
    ejectionNotice,
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
    selectVote,
    submitVote,
    forceRevealVotes,
    nextRound,
    endGame,
    resetScores,
    setDifficulty,
    setImposterCount,
    skipTurn,
    changeWord,
    removePlayer,
    refreshNow,
    dismissScoreModal,
    leaveGame,
    setPendingRoomCodeFromUrl,
    getSavedPlayerNameForRoom,
  }
}
