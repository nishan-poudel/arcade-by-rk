import { computed, ref, watch } from 'vue'
import type { RoundCount } from '@callbreak/shared-logic'
import { createRoomConnection, createRoomOnServer } from '@/composables/useSocketConnection'
import type { ScoreScreen, ScoreStateView } from '../types'

const RECONNECT_KEY = 'callbreak_score_reconnect'
const QUICK_RESYNC_DELAYS_MS = [1000, 3000, 6000]
const RESYNC_INTERVAL_MS = 15_000

interface ReconnectInfo {
  roomCode: string
  name: string
  playerId: string
}

// localStorage (not sessionStorage) so a backgrounded mobile tab/PWA that
// gets killed and reopened — the realistic "disconnected, reload to get
// back in" case on a phone — can still find its way back to the room.
function saveReconnectInfo(info: ReconnectInfo) {
  try {
    localStorage.setItem(RECONNECT_KEY, JSON.stringify(info))
  } catch {
    // ignore
  }
}
function getReconnectInfo(): ReconnectInfo | null {
  try {
    const raw = localStorage.getItem(RECONNECT_KEY)
    return raw ? (JSON.parse(raw) as ReconnectInfo) : null
  } catch {
    return null
  }
}
function clearReconnectInfo() {
  try {
    localStorage.removeItem(RECONNECT_KEY)
  } catch {
    // ignore
  }
}

const conn = createRoomConnection('score')

const state = ref<ScoreStateView | null>(null)
const myPlayerId = ref<string | null>(null)
const myName = ref('')
const errorMessage = ref<string | null>(null)
const pendingAction = ref<'create' | 'join' | null>(null)

const connectionState = conn.connectionState

const screen = computed<ScoreScreen>(() => {
  if (!state.value) return 'landing'
  switch (state.value.phase) {
    case 'lobby':
      return 'waitingRoom'
    case 'roundEntry':
      return 'roundEntry'
    case 'roundResult':
      return 'roundResult'
    case 'gameOver':
      return 'gameOver'
  }
})

const me = computed(() => (state.value?.yourSeat !== null && state.value ? state.value.players[state.value.yourSeat] : null))
const isHost = computed(() => me.value?.isHost ?? false)

let unsubscribe: (() => void) | null = null
let stopConnectionWatch: (() => void) | null = null
let resyncTimer: ReturnType<typeof setInterval> | null = null

function setupListeners() {
  if (unsubscribe) return
  unsubscribe = conn.subscribe((msg) => {
    if (msg.type === 'state') {
      state.value = msg.payload as ScoreStateView
      errorMessage.value = null
      pendingAction.value = null
      if (state.value.yourPlayerId) myPlayerId.value = state.value.yourPlayerId
      // Once the session is actually over there's nothing left to rejoin —
      // forget it so a later visit to /score starts fresh at the landing
      // screen instead of trying to resurrect a finished session. (The
      // current tab can still use "Review & Correct Scores" normally —
      // this only affects a future reconnect attempt.)
      if (state.value.phase === 'gameOver') {
        clearReconnectInfo()
      } else if (state.value.yourPlayerId) {
        saveReconnectInfo({ roomCode: state.value.code, name: myName.value, playerId: state.value.yourPlayerId })
      }
    } else if (msg.type === 'error') {
      errorMessage.value = (msg.payload as { message: string }).message
      pendingAction.value = null
    }
  })

  stopConnectionWatch = watch(connectionState, (value, prev) => {
    if (value === 'online' && prev !== 'online' && myPlayerId.value) {
      conn.send('rejoin', { playerId: myPlayerId.value })
      quickResyncBurst()
    }
  })

  resyncTimer = setInterval(() => {
    if (connectionState.value === 'online') conn.send('request_state')
  }, RESYNC_INTERVAL_MS)
}

function quickResyncBurst() {
  for (const delay of QUICK_RESYNC_DELAYS_MS) setTimeout(() => conn.send('request_state'), delay)
}

async function createRoom(name: string): Promise<void> {
  setupListeners()
  errorMessage.value = null
  pendingAction.value = 'create'
  myName.value = name
  try {
    const roomCode = await createRoomOnServer('score')
    conn.connect(roomCode)
    conn.send('join', { name })
  } catch {
    errorMessage.value = 'Could not reach the server. Try again?'
    pendingAction.value = null
  }
}

function joinRoom(roomCode: string, name: string): void {
  setupListeners()
  errorMessage.value = null
  pendingAction.value = 'join'
  myName.value = name
  conn.connect(roomCode.toUpperCase())
  conn.send('join', { name })
}

function attemptRejoin(): boolean {
  const info = getReconnectInfo()
  if (!info) return false
  setupListeners()
  myName.value = info.name
  myPlayerId.value = info.playerId
  conn.connect(info.roomCode)
  conn.send('rejoin', { playerId: info.playerId })
  quickResyncBurst()
  return true
}

function leaveRoom(): void {
  conn.disconnect()
  clearReconnectInfo()
  state.value = null
  myPlayerId.value = null
  if (resyncTimer !== null) clearInterval(resyncTimer)
  resyncTimer = null
  stopConnectionWatch?.()
  stopConnectionWatch = null
}

/**
 * Called when the score-keeper view unmounts — navigating back to the
 * hub, including from a finished session's final standings. This
 * module's state is a page-life singleton, not tied to the route, so
 * without this a later visit to /score would instantly show whatever
 * screen the last session ended on (most visibly: a finished session's
 * GameOverScreen) before attemptRejoin() even runs. Tears down the
 * connection and clears in-memory state; a still-active session is
 * recovered by attemptRejoin() on the next mount from the server's
 * authoritative state — unlike leaveRoom(), this never touches the
 * localStorage reconnect info, which is what makes that possible.
 */
function disconnectOnly(): void {
  conn.disconnect()
  if (resyncTimer !== null) clearInterval(resyncTimer)
  resyncTimer = null
  stopConnectionWatch?.()
  stopConnectionWatch = null
  state.value = null
  myPlayerId.value = null
  myName.value = ''
  errorMessage.value = null
  pendingAction.value = null
}

function setRoundCount(roundCount: RoundCount): void {
  conn.send('set_round_count', { roundCount })
}
function startGame(): void {
  conn.send('start_game')
}
function lockCall(seat: number, call: number): void {
  conn.send('lock_call', { seat, call })
}
function unlockCall(seat: number): void {
  conn.send('unlock_call', { seat })
}
function lockTricks(seat: number, tricksWon: number): void {
  conn.send('lock_tricks', { seat, tricksWon })
}
function unlockTricks(seat: number): void {
  conn.send('unlock_tricks', { seat })
}
function continueGame(): void {
  conn.send('continue')
}
function editRound(round: number, entries: { seat: number; call: number; tricksWon: number }[]): void {
  conn.send('edit_round', { round, entries })
}
function removePlayer(seat: number): void {
  conn.send('remove_player', { seat })
}
function addPlayer(name: string): void {
  conn.send('add_player', { name })
}

function requestState(): void {
  conn.send('request_state')
}

export function useScoreRoom() {
  return {
    state,
    connectionState,
    screen,
    me,
    isHost,
    myPlayerId,
    errorMessage,
    pendingAction,
    createRoom,
    joinRoom,
    attemptRejoin,
    leaveRoom,
    disconnectOnly,
    setRoundCount,
    startGame,
    lockCall,
    unlockCall,
    lockTricks,
    unlockTricks,
    continueGame,
    editRound,
    removePlayer,
    addPlayer,
    requestState,
  }
}
