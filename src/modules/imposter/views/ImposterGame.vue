<template>
  <div class="min-h-dvh bg-[#0d0d0d] text-white">
    <!-- Connection badge -->
    <div
      v-if="screen !== 'landing'"
      class="fixed right-3 z-40 flex items-center gap-1.5 text-xs
             bg-white/10 border border-white/10 rounded-full px-3 py-1.5"
      style="top: max(0.75rem, env(safe-area-inset-top))"
    >
      <span
        :class="['w-1.5 h-1.5 rounded-full', connected ? 'bg-green-400' : 'bg-red-400 animate-pulse-slow']"
      />
      <span class="text-white/60">{{ connected ? 'Online' : 'Reconnecting…' }}</span>
    </div>

    <!-- Error Toast -->
    <Transition name="toast">
      <div
        v-if="errorMessage"
        class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white
               px-5 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm text-center
               animate-slide-up"
      >
        {{ errorMessage }}
        <button class="ml-3 underline opacity-75 hover:opacity-100" @click="errorMessage = ''">
          Dismiss
        </button>
      </div>
    </Transition>

    <!-- Screen router -->
    <Transition name="screen" mode="out-in">
      <LandingScreen
        v-if="screen === 'landing'"
        @create="onCreateRoom"
        @join="onJoinRoom"
      />

      <WaitingRoom
        v-else-if="screen === 'waiting'"
        :game-state="gameState!"
        :is-host="isHost"
        @start="startGame"
        @leave="leaveGame"
        @set-difficulty="setDifficulty"
        @set-imposter-count="setImposterCount"
      />

      <!-- In-game: host or player -->
      <template v-else-if="screen === 'game' || screen === 'discussion'">
        <HostScreen
          v-if="isHost"
          :game-state="gameState!"
          :my-assignment="myAssignment!"
          :screen="screen"
          @end-game="endGame"
          @reset-scores="resetScores"
          @record-result="recordResult"
          @player-done="playerDone"
          @skip-turn="skipTurn"
        />
        <PlayerScreen
          v-else
          :game-state="gameState!"
          :my-id="myId"
          :my-assignment="myAssignment!"
          :is-my-turn="isMyTurn"
          :screen="screen"
          @player-done="playerDone"
        />
      </template>

      <RoundReveal
        v-else-if="screen === 'reveal'"
        :reveal="currentReveal!"
        :game-state="gameState"
        :my-id="myId"
        :is-host="isHost"
        @next-round="nextRound"
        @end-game="endGame"
      />

      <GameOverScreen
        v-else-if="screen === 'over'"
        :game-state="gameState!"
        :sorted-players="sortedPlayers"
        @leave="leaveGame"
      />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
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
  currentReveal,
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
  recordResult,
  nextRound,
  endGame,
  resetScores,
  setDifficulty,
  setImposterCount,
  skipTurn,
  leaveGame,
} = useGame()

const { connected } = useSocket()

// Auto-dismiss errors after 4 s
watch(errorMessage, (msg) => {
  if (msg) setTimeout(() => { errorMessage.value = '' }, 4000)
})

onMounted(() => {
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
