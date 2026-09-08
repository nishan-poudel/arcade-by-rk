<template>
  <div class="min-h-dvh bg-background text-foreground relative isolate">
    <!-- Ambient decorative wash, fixed behind every screen. -->
    <div class="app-aura" />

    <!-- Top-right controls: theme toggle always visible; connection status +
         a separate refresh button once in a room. -->
    <div
      class="fixed right-3 z-40 flex items-center gap-2"
      style="top: max(0.75rem, env(safe-area-inset-top))"
    >
      <Transition name="pop">
        <div v-if="screen !== 'landing'" class="flex items-center gap-1.5">
          <!-- Status — read-only. Compact (dot only) when healthy; expands with
               a label the moment the connection drops. -->
          <span
            class="flex items-center gap-1.5 text-xs bg-secondary/80 border-2 border-border
                   rounded-full py-1.5 backdrop-blur transition-all"
            :class="connectionState === 'online' ? 'px-1.5' : 'px-2.5'"
          >
            <span :class="['w-2 h-2 rounded-full shrink-0', statusDotClass]" />
            <span v-if="connectionState !== 'online'" class="text-muted-foreground">{{ connectionLabel }}</span>
          </span>
          <!-- Distinct refresh button — grows + turns red while the connection is bad -->
          <button
            type="button"
            class="rounded-full border-2 backdrop-blur active:scale-90 transition-all grid place-items-center shrink-0"
            :class="connectionState === 'online'
              ? 'bg-secondary/80 border-border text-muted-foreground size-8'
              : 'bg-destructive border-destructive text-destructive-foreground size-9 animate-pulse-slow'"
            :aria-label="locale.imposter.common.refresh"
            :title="locale.imposter.common.refreshHint"
            @click="refreshNow"
          >
            <RefreshCwIcon :class="connectionState === 'online' ? 'size-3.5' : 'size-4'" />
          </button>
          <!-- Save the score screen — appears only once a game is over. -->
          <button
            v-if="screen === 'reveal' || screen === 'over'"
            type="button"
            class="rounded-full border-2 bg-secondary/80 border-border text-muted-foreground size-8
                   backdrop-blur active:scale-90 transition-all grid place-items-center shrink-0"
            :class="{ 'opacity-50 pointer-events-none': savingResult }"
            aria-label="Save"
            @click="onSaveResult"
          >
            <Loader2Icon v-if="savingResult" class="size-3.5 animate-spin" />
            <DownloadIcon v-else class="size-3.5" />
          </button>
        </div>
      </Transition>
      <ThemeToggle />
    </div>

    <!-- Connection-lost banner: full-width, unmissable, with a one-tap refresh
         so nobody ever has to hard-reload the page. -->
    <Transition name="toast">
      <div
        v-if="screen !== 'landing' && connectionState !== 'online'"
        class="fixed inset-x-0 z-50 flex justify-center px-3"
        style="top: max(3.5rem, calc(env(safe-area-inset-top) + 3rem))"
      >
        <div
          class="flex items-center gap-3 bg-destructive text-destructive-foreground
                    px-4 py-2.5 rounded-2xl shadow-pop text-sm font-medium border-2 border-foreground/10 max-w-sm">
          <WifiOffIcon class="size-4 shrink-0 animate-pulse-slow" />
          <span class="flex-1">
            {{ connectionState === 'offline' ? locale.imposter.common.offlineBanner : locale.imposter.common.reconnectingBanner }}
          </span>
          <button
            class="shrink-0 inline-flex items-center gap-1 underline font-semibold"
            @click="refreshNow"
          >
            <RefreshCwIcon class="size-3.5" />{{ locale.imposter.common.refresh }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Gentle notice toast (host changed word, etc.) -->
    <Transition name="toast">
      <div
        v-if="noticeMessage"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground
               px-5 py-3 rounded-2xl shadow-pop text-sm font-medium max-w-sm text-center border-2 border-foreground/10"
      >
        {{ noticeMessage }}
      </div>
    </Transition>

    <!-- Error Toast -->
    <Transition name="toast">
      <div
        v-if="errorMessage"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground
               px-5 py-3 rounded-2xl shadow-pop text-sm font-medium max-w-sm text-center border-2 border-foreground/10"
      >
        {{ errorMessage }}
        <button class="ml-3 underline opacity-75 hover:opacity-100" @click="errorMessage = ''">
          {{ locale.imposter.common.dismiss }}
        </button>
      </div>
    </Transition>

    <!-- Screen router. Cross-fades between major phase changes (lobby → game →
         reveal → game over) but never re-triggers when only in-phase data
         changes (e.g. game ↔ discussion keeps HostScreen/PlayerScreen mounted).
         The single keyed wrapper div (rather than raw v-if/else-if siblings
         as direct Transition children) is what makes out-in mode reliable. -->
    <Transition name="screen" mode="out-in">
      <div :key="transitionKey">
        <LandingScreen
          v-if="screen === 'landing'"
          :pending-action="pendingAction"
          :is-slow-connection="isSlowConnection"
          :initial-room-code="initialRoomCode"
          :initial-player-name="initialPlayerName"
          @create="onCreateRoom"
          @join="onJoinRoom"
        />

        <WaitingRoom
          v-else-if="screen === 'waiting' && gameState"
          :game-state="gameState"
          :is-host="isHost"
          @start="startGame"
          @leave="leaveGame"
          @set-difficulty="setDifficulty"
          @set-imposter-count="setImposterCount"
          @remove-player="removePlayer"
        />

        <!-- In-game: host or player -->
        <template v-else-if="(screen === 'game' || screen === 'discussion') && gameState && myAssignment">
          <HostScreen
            v-if="isHost"
            :game-state="gameState"
            :my-assignment="myAssignment"
            :my-id="myId"
            :my-vote="myVote"
            :my-vote-selection="myVoteSelection"
            :screen="screen"
            @end-game="endGame"
            @reset-scores="resetScores"
            @select="selectVote"
            @submit="submitVote"
            @force-reveal="forceRevealVotes"
            @player-done="playerDone"
            @skip-turn="skipTurn"
            @change-word="changeWord"
            @remove-player="removePlayer"
          />
          <PlayerScreen
            v-else
            :game-state="gameState"
            :my-id="myId"
            :my-assignment="myAssignment"
            :my-vote="myVote"
            :my-vote-selection="myVoteSelection"
            :is-my-turn="isMyTurn"
            :screen="screen"
            @player-done="playerDone"
            @select="selectVote"
            @submit="submitVote"
          />
        </template>

        <RoundReveal
          v-else-if="screen === 'reveal' && currentResult && gameState"
          :result="currentResult"
          :game-state="gameState"
          :my-id="myId"
          :is-host="isHost"
          @new-game="nextRound"
          @end-game="endGame"
        />

        <GameOverScreen
          v-else-if="screen === 'over' && gameState"
          :game-state="gameState"
          :sorted-players="sortedPlayers"
          @leave="leaveGame"
        />

        <!-- Fallback: screen changed but data not yet ready -->
        <div v-else class="min-h-dvh flex items-center justify-center">
          <div class="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2Icon class="size-8 animate-spin text-primary" />
            <p class="text-sm">{{ locale.imposter.common.loading }}</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- "X was voted out" overlay, shown for a few seconds between votes -->
    <Transition name="toast">
      <EjectionResult v-if="ejectionNotice" :notice="ejectionNotice" />
    </Transition>

    <!-- End-of-game score modal (dismiss anywhere) -->
    <ScoreModal
      v-if="showScoreModal && currentResult"
      :result="currentResult"
      :my-id="myId"
      :is-host="isHost"
      @dismiss="dismissScoreModal"
    />

    <!-- Off-screen card that the "save" button rasterises to a PNG -->
    <ShareCard
      v-if="(screen === 'reveal' || screen === 'over') && gameState"
      ref="shareCard"
      :result="currentResult"
      :players="gameState.players"
      :game-number="gameState.round"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DownloadIcon, Loader2Icon, RefreshCwIcon, WifiOffIcon } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import { ROUTE_PATHS } from '@/router'
import { useGame } from '../composables/useGame.js'
import { useSocket } from '../composables/useSocket.js'
import type { Difficulty } from '../types/index.js'

import LandingScreen from '../components/LandingScreen.vue'
import WaitingRoom from '../components/WaitingRoom.vue'
import HostScreen from '../components/HostScreen.vue'
import PlayerScreen from '../components/PlayerScreen.vue'
import GameOverScreen from '../components/GameOverScreen.vue'
import RoundReveal from '../components/RoundReveal.vue'
import EjectionResult from '../components/EjectionResult.vue'
import ScoreModal from '../components/ScoreModal.vue'
import ShareCard from '../components/ShareCard.vue'
import ThemeToggle from '@/components/ui/theme-toggle/ThemeToggle.vue'

const {
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
  isHost,
  isMyTurn,
  sortedPlayers,
  connect,
  setupListeners,
  teardownListeners,
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
} = useGame()

const { connectionState } = useSocket()

const connectionLabel = computed(() => {
  if (connectionState.value === 'online') {return locale.imposter.common.online}
  if (connectionState.value === 'offline') {return locale.imposter.common.offline}
  return locale.imposter.common.reconnecting
})

const statusDotClass = computed(() => {
  if (connectionState.value === 'online') {return 'bg-flavor-melon'}
  if (connectionState.value === 'reconnecting') {return 'bg-warning animate-pulse-slow'}
  return 'bg-destructive animate-pulse-slow'
})

// ── Save / share the score screen ────────────────────────────────────────────
const shareCard = ref<InstanceType<typeof ShareCard> | null>(null)
const savingResult = ref(false)

async function onSaveResult() {
  const el = shareCard.value?.getEl()
  if (!el || savingResult.value) {return}
  savingResult.value = true
  try {
    const { toBlob } = await import('html-to-image')
    const blob = await toBlob(el, { pixelRatio: 2, backgroundColor: '#faf6ef', cacheBust: true })
    if (!blob) {throw new Error('no blob')}
    const file = new File([blob], 'imposter-scores.png', { type: 'image/png' })

    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: locale.imposter.common.shareTitle })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
    noticeMessage.value = locale.imposter.common.saved
    setTimeout(() => {
      if (noticeMessage.value === locale.imposter.common.saved) {noticeMessage.value = ''}
    }, 2500)
  } catch (err) {
    // The user cancelling the native share sheet throws AbortError — ignore it.
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      noticeMessage.value = locale.imposter.common.saveFailed
      setTimeout(() => {
        if (noticeMessage.value === locale.imposter.common.saveFailed) {noticeMessage.value = ''}
      }, 3000)
    }
  } finally {
    savingResult.value = false
  }
}

const route = useRoute()
const router = useRouter()

// Groups 'game' and 'discussion' under one key so the screen Transition only
// re-triggers on real phase changes, not the mid-round game→discussion flip.
const transitionKey = computed(() => (screen.value === 'discussion' ? 'game' : screen.value))

// Seed values for the LandingScreen Join form when the app is opened via a
// shared room link (or a page refresh) and no matching session was found
// (or the auto-rejoin attempt is still in flight).
const initialRoomCode = ref<string | undefined>(undefined)
const initialPlayerName = ref<string | undefined>(undefined)

// Auto-dismiss errors after 4 s
watch(errorMessage, (msg) => {
  if (msg) {setTimeout(() => { errorMessage.value = '' }, 4000)}
})

// Keep the URL in sync with the room we're actually in. Using `replace`
// (not `push`) so the browser back button never lands the user on a URL
// that says "not in a room" while the socket session is still active —
// "Leave Room" is the one intentional way to exit.
watch(roomCode, (code) => {
  const target = code ? `/${code}` : ROUTE_PATHS.IMPOSTER
  if (route.path.toLowerCase() !== target.toLowerCase()) {
    router.replace(target)
  }
})

onMounted(() => {
  const routeRoomCode = typeof route.params.roomCode === 'string' ? route.params.roomCode.toUpperCase() : undefined

  if (routeRoomCode) {
    // Tell useGame which room the URL points to, so its `connect` handler
    // can attempt an auto-rejoin if a matching saved session exists.
    setPendingRoomCodeFromUrl(routeRoomCode)
    initialRoomCode.value = routeRoomCode
    initialPlayerName.value = getSavedPlayerNameForRoom(routeRoomCode) ?? undefined
  }

  setupListeners()
  connect()
})

onUnmounted(() => {
  teardownListeners()
})

function onCreateRoom(payload: { hostName: string; difficulty: Difficulty; imposterCount: number }) {
  createRoom(payload.hostName, payload.difficulty, payload.imposterCount)
}

function onJoinRoom(payload: { roomCode: string; playerName: string }) {
  joinRoom(payload.roomCode, payload.playerName)
}
</script>

<style scoped>
/* Screen transition */
.screen-enter-active {
  transition: opacity 0.3s ease-out, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.screen-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.screen-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.98);
}
.screen-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Toast transition */
.toast-enter-active {
  transition: opacity 0.2s ease, transform 0.3s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}

/* Small controls (connection badge) pop in/out */
.pop-enter-active,
.pop-leave-active {
  transition: opacity 0.15s ease, transform 0.2s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.8);
}
</style>
