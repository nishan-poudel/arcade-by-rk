<template>
  <div class="min-h-dvh bg-background text-foreground">
    <!-- Connection badge -->
    <div
      v-if="screen !== 'landing'"
      class="fixed right-3 z-40 flex items-center gap-1.5 text-xs
             bg-secondary/70 border border-border rounded-full px-3 py-1.5 backdrop-blur"
      style="top: max(0.75rem, env(safe-area-inset-top))"
    >
      <span
        :class="['w-1.5 h-1.5 rounded-full', connected ? 'bg-primary' : 'bg-destructive animate-pulse-slow']"
      />
      <span class="text-muted-foreground">{{ connected ? locale.imposter.common.online : locale.imposter.common.reconnecting }}</span>
    </div>

    <!-- Error Toast -->
    <Transition name="toast">
      <div
        v-if="errorMessage"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-destructive text-destructive-foreground
               px-5 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm text-center
               animate-slide-up"
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
        />

        <!-- In-game: host or player -->
        <template v-else-if="(screen === 'game' || screen === 'discussion') && gameState && myAssignment">
          <HostScreen
            v-if="isHost"
            :game-state="gameState"
            :my-assignment="myAssignment"
            :my-id="myId"
            :my-vote="myVote"
            :screen="screen"
            @end-game="endGame"
            @reset-scores="resetScores"
            @submit-vote="submitVote"
            @force-reveal="forceRevealVotes"
            @player-done="playerDone"
            @skip-turn="skipTurn"
          />
          <PlayerScreen
            v-else
            :game-state="gameState"
            :my-id="myId"
            :my-assignment="myAssignment"
            :my-vote="myVote"
            :is-my-turn="isMyTurn"
            :screen="screen"
            @player-done="playerDone"
            @submit-vote="submitVote"
          />
        </template>

        <RoundReveal
          v-else-if="screen === 'reveal' && currentReveal && gameState"
          :reveal="currentReveal"
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

        <!-- Fallback: screen changed but data not yet ready -->
        <div v-else class="min-h-dvh flex items-center justify-center">
          <div class="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2Icon class="size-8 animate-spin text-primary" />
            <p class="text-sm">{{ locale.imposter.common.loading }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2Icon } from '@lucide/vue'
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

const {
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
  submitVote,
  forceRevealVotes,
  nextRound,
  endGame,
  resetScores,
  setDifficulty,
  setImposterCount,
  skipTurn,
  leaveGame,
  setPendingRoomCodeFromUrl,
  getSavedPlayerNameForRoom,
} = useGame()

const { connected } = useSocket()
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
.screen-enter-active,
.screen-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.screen-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.screen-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Toast transition */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}
</style>
