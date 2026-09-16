import { computed, ref, watch } from 'vue'
import { createRoomConnection, createRoomOnServer } from '@/composables/useSocketConnection'
import type { FarasScreen, FarasStateView } from '../types'

const RECONNECT_KEY = 'callbreak_faras_reconnect'
const QUICK_RESYNC_DELAYS_MS = [1000, 3000, 6000]
const RESYNC_INTERVAL_MS = 15_000

interface ReconnectInfo {
  roomCode: string
  name: string
  playerId: string
}

// localStorage (not sessionStorage) so a backgrounded mobile tab/PWA that
// gets killed and reopened can still find its way back to the table.
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

const conn = createRoomConnection('faras')

const state = ref<FarasStateView | null>(null)
const myPlayerId = ref<string | null>(null)
const myName = ref('')
const errorMessage = ref<string | null>(null)
const pendingAction = ref<'create' | 'join' | null>(null)

const connectionState = conn.connectionState

const screen = computed<FarasScreen>(() => {
  if (!state.value) return 'landing'
  switch (state.value.phase) {
    case 'lobby':
      return 'waitingRoom'
    case 'hand':
      return 'hand'
    case 'handResult':
      return 'handResult'
    case 'gameOver':
      return 'gameOver'
  }
})

const me = computed(() => state.value?.players.find((p) => p.id === state.value?.yourPlayerId) ?? null)
const isHost = computed(() => me.value?.isHost ?? false)
const isMyTurn = computed(() => !!state.value?.yourPlayerId && state.value.turnPlayerId === state.value.yourPlayerId)
const myHandState = computed(() => (state.value?.yourPlayerId ? (state.value.handState[state.value.yourPlayerId] ?? null) : null))
const activePlayers = computed(() => state.value?.players.filter((p) => !state.value?.handState[p.id]?.folded) ?? [])

let unsubscribe: (() => void) | null = null
let stopConnectionWatch: (() => void) | null = null
let resyncTimer: ReturnType<typeof setInterval> | null = null

function setupListeners() {
  if (unsubscribe) return
  unsubscribe = conn.subscribe((msg) => {
    if (msg.type === 'state') {
      state.value = msg.payload as FarasStateView
      errorMessage.value = null
      pendingAction.value = null
      if (state.value.yourPlayerId) myPlayerId.value = state.value.yourPlayerId
      // Once the session is actually over there's nothing left to rejoin —
      // forget it so a later visit to /faras starts fresh at the landing
      // screen instead of trying to resurrect a finished game.
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
  for (const delay of QUICK_RESYNC_DELAYS_MS) {
    setTimeout(() => conn.send('request_state'), delay)
  }
}

async function createRoom(name: string): Promise<void> {
  setupListeners()
  errorMessage.value = null
  pendingAction.value = 'create'
  myName.value = name
  try {
    const roomCode = await createRoomOnServer('faras')
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
  conn.send('leave_table')
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
 * Called when the game view unmounts — navigating back to the hub,
 * including from a finished game's standings screen. This module's state
 * is a page-life singleton, not tied to the route, so without this a
 * later visit to /faras would instantly show whatever screen the last
 * session ended on (most visibly: a finished game's GameOverScreen)
 * before attemptRejoin() even runs. Tears down the connection and clears
 * in-memory state; a still-active game is recovered by attemptRejoin() on
 * the next mount from the server's authoritative state — this never
 * touches the localStorage reconnect info, which is what makes that
 * possible (not a deliberate "leave the table", which is leaveRoom()).
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

function setMode(mode: 'betting' | 'show'): void {
  conn.send('set_mode', { mode })
}
function startHand(): void {
  conn.send('start_hand')
}
function ghotchu(): void {
  conn.send('ghotchu')
}
function fold(): void {
  conn.send('fold')
}
function stay(): void {
  conn.send('stay')
}
function requestShow(): void {
  conn.send('request_show')
}
function revealAll(): void {
  conn.send('reveal_all')
}
function nextHand(): void {
  conn.send('next_hand')
}
function endSession(): void {
  conn.send('end_session')
}
function removePlayer(playerId: string): void {
  conn.send('remove_player', { playerId })
}
function requestState(): void {
  conn.send('request_state')
}

export function useFaras() {
  return {
    state,
    connectionState,
    screen,
    me,
    isHost,
    isMyTurn,
    myHandState,
    activePlayers,
    myPlayerId,
    errorMessage,
    pendingAction,
    createRoom,
    joinRoom,
    attemptRejoin,
    leaveRoom,
    disconnectOnly,
    setMode,
    startHand,
    ghotchu,
    fold,
    stay,
    requestShow,
    revealAll,
    nextHand,
    endSession,
    removePlayer,
    requestState,
  }
}
