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

function saveReconnectInfo(info: ReconnectInfo) {
  try {
    sessionStorage.setItem(RECONNECT_KEY, JSON.stringify(info))
  } catch {
    // ignore
  }
}
function getReconnectInfo(): ReconnectInfo | null {
  try {
    const raw = sessionStorage.getItem(RECONNECT_KEY)
    return raw ? (JSON.parse(raw) as ReconnectInfo) : null
  } catch {
    return null
  }
}
function clearReconnectInfo() {
  try {
    sessionStorage.removeItem(RECONNECT_KEY)
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
      if (state.value.yourPlayerId) {
        myPlayerId.value = state.value.yourPlayerId
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

function setRoundCount(roundCount: RoundCount): void {
  conn.send('set_round_count', { roundCount })
}
function startGame(): void {
  conn.send('start_game')
}
function lockEntry(seat: number, call: number, tricksWon: number): void {
  conn.send('lock_entry', { seat, call, tricksWon })
}
function unlockEntry(seat: number): void {
  conn.send('unlock_entry', { seat })
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
    setRoundCount,
    startGame,
    lockEntry,
    unlockEntry,
    continueGame,
    editRound,
    removePlayer,
    addPlayer,
  }
}
