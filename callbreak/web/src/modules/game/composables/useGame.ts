import { computed, ref, watch } from 'vue'
import type { Card, RoundCount } from '@callbreak/shared-logic'
import { createRoomConnection, createRoomOnServer } from '@/composables/useSocketConnection'
import type { GameScreen, GameStateView } from '../types'

const RECONNECT_KEY = 'callbreak_game_reconnect'
const QUICK_RESYNC_DELAYS_MS = [1000, 3000, 6000]

interface ReconnectInfo {
  roomCode: string
  name: string
  playerId: string
}

function saveReconnectInfo(info: ReconnectInfo) {
  try {
    sessionStorage.setItem(RECONNECT_KEY, JSON.stringify(info))
  } catch {
    // sessionStorage unavailable — reconnect just won't be remembered.
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

const conn = createRoomConnection('game')

const state = ref<GameStateView | null>(null)
const myPlayerId = ref<string | null>(null)
const myName = ref<string>('')
const errorMessage = ref<string | null>(null)
const pendingAction = ref<'create' | 'join' | null>(null)

const connectionState = conn.connectionState

const screen = computed<GameScreen>(() => {
  if (!state.value) return 'landing'
  switch (state.value.phase) {
    case 'lobby':
      return 'waitingRoom'
    case 'bidding':
      return 'bidding'
    case 'playing':
      return 'trickPlay'
    case 'roundEnd':
      return 'roundResult'
    case 'gameOver':
      return 'gameOver'
  }
})

const me = computed(() => (state.value?.yourSeat !== null && state.value ? state.value.players[state.value.yourSeat] : null))
const isHost = computed(() => me.value?.isHost ?? false)
const isMyTurn = computed(() => state.value?.yourSeat !== null && state.value?.turnSeat === state.value?.yourSeat)
const sortedByScore = computed(() => {
  if (!state.value) return []
  return state.value.players
    .map((p, seat) => ({ player: p, seat, total: state.value!.totals[seat] }))
    .filter((row): row is { player: NonNullable<typeof row.player>; seat: number; total: number } => row.player !== null)
    .sort((a, b) => b.total - a.total)
})

const RESYNC_INTERVAL_MS = 15_000

let unsubscribe: (() => void) | null = null
let stopConnectionWatch: (() => void) | null = null
let resyncTimer: ReturnType<typeof setInterval> | null = null

function setupListeners() {
  if (unsubscribe) return
  unsubscribe = conn.subscribe((msg) => {
    if (msg.type === 'state') {
      state.value = msg.payload as GameStateView
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

  // A raw socket reconnect (network blip) needs to re-attach to our seat —
  // the transport just reopens the connection, it doesn't know about
  // game-level identity.
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
    const roomCode = await createRoomOnServer('game')
    conn.connect(roomCode)
    conn.send('join', { name })
  } catch {
    errorMessage.value = 'Could not reach the server — try again.'
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

function submitBid(call: number): void {
  conn.send('submit_bid', { call })
}

function playCard(card: Card): void {
  conn.send('play_card', { card })
}

function nextRound(): void {
  conn.send('next_round')
}

function removePlayer(seat: number): void {
  conn.send('remove_player', { seat })
}

function requestState(): void {
  conn.send('request_state')
}

export function useGame() {
  return {
    state,
    connectionState,
    screen,
    me,
    isHost,
    isMyTurn,
    sortedByScore,
    errorMessage,
    pendingAction,
    myPlayerId,
    createRoom,
    joinRoom,
    attemptRejoin,
    leaveRoom,
    setRoundCount,
    startGame,
    submitBid,
    playCard,
    nextRound,
    removePlayer,
    requestState,
  }
}
