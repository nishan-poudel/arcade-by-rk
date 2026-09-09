<template>
  <div class="min-h-dvh bg-background text-foreground relative isolate">
    <div class="app-aura" />

    <!-- Top-right controls -->
    <div class="fixed right-3 z-40 flex items-center gap-2" style="top: max(0.75rem, env(safe-area-inset-top))">
      <Transition name="pop">
        <div v-if="screen !== 'landing'" class="flex items-center gap-1.5">
          <span
            class="flex items-center gap-1.5 text-xs bg-secondary/80 border-2 border-border rounded-full py-1.5 backdrop-blur transition-all"
            :class="connectionState === 'online' ? 'px-1.5' : 'px-2.5'"
          >
            <span :class="['w-2 h-2 rounded-full shrink-0', statusDotClass]" />
            <span v-if="connectionState !== 'online'" class="text-muted-foreground">{{ connectionLabel }}</span>
          </span>
          <button
            type="button"
            class="rounded-full border-2 backdrop-blur active:scale-90 transition-all grid place-items-center shrink-0"
            :class="connectionState === 'online'
              ? 'bg-secondary/80 border-border text-muted-foreground size-8'
              : 'bg-destructive border-destructive text-destructive-foreground size-9 animate-pulse-slow'"
            :aria-label="locale.traitor.common.refresh"
            :title="locale.traitor.common.refreshHint"
            @click="refreshNow"
          >
            <RefreshCwIcon :class="connectionState === 'online' ? 'size-3.5' : 'size-4'" />
          </button>
          <button
            v-if="screen === 'result' || screen === 'over'"
            type="button"
            class="rounded-full border-2 bg-secondary/80 border-border text-muted-foreground size-8 backdrop-blur active:scale-90 transition-all grid place-items-center shrink-0"
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

    <!-- Connection-lost banner -->
    <Transition name="toast">
      <div
        v-if="screen !== 'landing' && connectionState !== 'online'"
        class="fixed inset-x-0 z-50 flex justify-center px-3"
        style="top: max(3.5rem, calc(env(safe-area-inset-top) + 3rem))"
      >
        <div class="flex items-center gap-3 bg-destructive text-destructive-foreground px-4 py-2.5 rounded-2xl shadow-pop text-sm font-medium border-2 border-foreground/10 max-w-sm">
          <WifiOffIcon class="size-4 shrink-0 animate-pulse-slow" />
          <span class="flex-1">
            {{ connectionState === 'offline' ? locale.traitor.common.offlineBanner : locale.traitor.common.reconnectingBanner }}
          </span>
          <button class="shrink-0 inline-flex items-center gap-1 underline font-semibold" @click="refreshNow">
            <RefreshCwIcon class="size-3.5" />{{ locale.traitor.common.refresh }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Notice / error toasts -->
    <Transition name="toast">
      <div
        v-if="noticeMessage"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-5 py-3 rounded-2xl shadow-pop text-sm font-medium max-w-sm text-center border-2 border-foreground/10"
      >
        {{ noticeMessage }}
      </div>
    </Transition>
    <Transition name="toast">
      <div
        v-if="errorMessage"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground px-5 py-3 rounded-2xl shadow-pop text-sm font-medium max-w-sm text-center border-2 border-foreground/10"
      >
        {{ errorMessage }}
        <button class="ml-3 underline opacity-75 hover:opacity-100" @click="errorMessage = ''">
          {{ locale.traitor.common.dismiss }}
        </button>
      </div>
    </Transition>

    <!-- Screen router -->
    <Transition name="screen" mode="out-in">
      <div :key="screen">
        <LandingScreen
          v-if="screen === 'landing'"
          :pending-action="pendingAction"
          :is-slow-connection="isSlowConnection"
          :categories="categories"
          :initial-room-code="initialRoomCode"
          :initial-player-name="initialPlayerName"
          :initial-avatar="initialAvatar"
          @create="onCreate"
          @join="onJoin"
        />

        <WaitingRoom
          v-else-if="screen === 'waiting' && gameState"
          :game-state="gameState"
          :is-host="isHost"
          :my-id="myId"
          :categories="categories"
          @start="startRound"
          @leave="leaveGame"
          @set-ready="setReady"
          @set-category="setCategory"
          @set-rounds="setTotalRounds"
          @remove-player="removePlayer"
        />

        <AnswerScreen
          v-else-if="screen === 'answering' && gameState"
          :game-state="gameState"
          :my-id="myId"
          :my-assignment="myAssignment"
          :my-answer="myAnswer"
          :my-answer-selection="myAnswerSelection"
          :is-host="isHost"
          @select="selectAnswer"
          @submit="submitAnswer"
          @force-reveal="forceRevealAnswers"
        />

        <DiscussionScreen
          v-else-if="screen === 'discussion' && gameState"
          :game-state="gameState"
          :is-host="isHost"
          @open-vote="openVote"
          @end-game="endGame"
        />

        <VoteScreen
          v-else-if="screen === 'voting' && gameState"
          :game-state="gameState"
          :my-id="myId"
          :my-vote="myVote"
          :my-vote-selection="myVoteSelection"
          :is-host="isHost"
          @select="selectVote"
          @submit="submitVote"
          @force-reveal="forceRevealVotes"
          @end-game="endGame"
        />

        <RoundResult
          v-else-if="screen === 'result' && currentResult"
          :result="currentResult"
          :game-state="gameState"
          :my-id="myId"
          :is-host="isHost"
          @next-round="nextRound"
          @end-game="endGame"
        />

        <GameOverScreen
          v-else-if="screen === 'over' && gameState"
          :game-state="gameState"
          :sorted-players="sortedPlayers"
          @leave="leaveGame"
        />

        <div v-else class="min-h-dvh flex items-center justify-center">
          <div class="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2Icon class="size-8 animate-spin text-primary" />
            <p class="text-sm">{{ locale.traitor.common.loading }}</p>
          </div>
        </div>
      </div>
    </Transition>

    <ScoreModal
      v-if="showScoreModal && currentResult"
      :result="currentResult"
      :my-id="myId"
      :is-host="isHost"
      @dismiss="dismissScoreModal"
    />

    <ShareCard
      v-if="(screen === 'result' || screen === 'over') && gameState"
      ref="shareCard"
      :result="currentResult"
      :players="gameState.players"
      :round-number="gameState.round"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { DownloadIcon, Loader2Icon, RefreshCwIcon, WifiOffIcon } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import { ROUTE_PATHS } from '@/router'
import { useTraitorGame } from '../composables/useTraitorGame.js'
import { useTraitorSocket } from '../composables/useTraitorSocket.js'
import type { TotalRounds } from '../types/index.js'

import LandingScreen from '../components/LandingScreen.vue'
import WaitingRoom from '../components/WaitingRoom.vue'
import AnswerScreen from '../components/AnswerScreen.vue'
import DiscussionScreen from '../components/DiscussionScreen.vue'
import VoteScreen from '../components/VoteScreen.vue'
import RoundResult from '../components/RoundResult.vue'
import GameOverScreen from '../components/GameOverScreen.vue'
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
  categories,
  myAnswer,
  myAnswerSelection,
  myVote,
  myVoteSelection,
  currentResult,
  showScoreModal,
  pendingAction,
  isSlowConnection,
  isHost,
  sortedPlayers,
  connect,
  setupListeners,
  teardownListeners,
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
} = useTraitorGame()

const { connectionState } = useTraitorSocket()

const connectionLabel = computed(() => {
  if (connectionState.value === 'online') {return locale.traitor.common.online}
  if (connectionState.value === 'offline') {return locale.traitor.common.offline}
  return locale.traitor.common.reconnecting
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
    const file = new File([blob], 'traitor-scores.png', { type: 'image/png' })

    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: locale.traitor.common.shareTitle })
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
    noticeMessage.value = locale.traitor.common.saved
    setTimeout(() => {
      if (noticeMessage.value === locale.traitor.common.saved) {noticeMessage.value = ''}
    }, 2500)
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      noticeMessage.value = locale.traitor.common.saveFailed
      setTimeout(() => {
        if (noticeMessage.value === locale.traitor.common.saveFailed) {noticeMessage.value = ''}
      }, 3000)
    }
  } finally {
    savingResult.value = false
  }
}

const route = useRoute()
const router = useRouter()

const initialRoomCode = ref<string | undefined>(undefined)
const initialPlayerName = ref<string | undefined>(undefined)
const initialAvatar = ref<string | undefined>(undefined)

watch(errorMessage, (msg) => {
  if (msg) {setTimeout(() => { errorMessage.value = '' }, 4000)}
})

// Keep the URL in sync with the room we're in.
watch(roomCode, (code) => {
  const target = code ? `/traitor/${code}` : ROUTE_PATHS.TRAITOR
  if (route.path.toLowerCase() !== target.toLowerCase()) {
    router.replace(target)
  }
})

onMounted(() => {
  const routeRoomCode =
    typeof route.params.roomCode === 'string' ? route.params.roomCode.toUpperCase() : undefined

  if (routeRoomCode) {
    setPendingRoomCodeFromUrl(routeRoomCode)
    initialRoomCode.value = routeRoomCode
    initialPlayerName.value = getSavedPlayerNameForRoom(routeRoomCode) ?? undefined
    initialAvatar.value = getSavedAvatar() ?? undefined
  }

  setupListeners()
  connect()
})

onUnmounted(() => {
  teardownListeners()
})

function onCreate(payload: { hostName: string; avatar: string; category: string; totalRounds: TotalRounds }) {
  createRoom(payload.hostName, payload.avatar, payload.category, payload.totalRounds)
}

function onJoin(payload: { roomCode: string; playerName: string; avatar: string }) {
  joinRoom(payload.roomCode, payload.playerName, payload.avatar)
}
</script>

<style scoped>
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
