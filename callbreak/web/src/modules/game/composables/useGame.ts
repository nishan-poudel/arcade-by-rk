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

// localStorage (not sessionStorage) so a backgrounded mobile tab/PWA that
// gets killed and reopened — the realistic "disconnected, reload to get
// back in" case on a phone — can still find its way back to the room.
function saveReconnectInfo(info: ReconnectInfo) {
  try {
    localStorage.setItem(RECONNECT_KEY, JSON.stringify(info))
  } catch {
    // localStorage unavailable — reconnect just won't be remembered.
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
      if (state.value.yourPlayerId) myPlayerId.value = state.value.yourPlayerId
      // Once the game is actually over there's nothing left to rejoin —
      // forget it so a later visit to /play starts fresh at the landing
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
 * Called when the game view unmounts — navigating back to the hub,
 * including from a finished game's final scores. This module's state is a
 * page-life singleton, not tied to the route, so without this a later
 * visit to /play would instantly show whatever screen the last session
 * ended on (most visibly: a finished game's GameOverScreen) before
 * attemptRejoin() even runs. Tears down the connection and clears
 * in-memory state; a still-active game is recovered by attemptRejoin() on
 * the next mount from the server's authoritative state — unlike
 * leaveRoom(), this never touches the localStorage reconnect info, which
 * is what makes that possible.
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
    disconnectOnly,
    setRoundCount,
    startGame,
    submitBid,
    playCard,
    nextRound,
    removePlayer,
    requestState,
  }
}
