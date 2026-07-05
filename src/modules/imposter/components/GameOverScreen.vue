<template>
  <div
    class="min-h-dvh flex flex-col bg-[#0d0d0d]"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <!-- Scrollable body -->
    <div class="flex-1 overflow-y-auto px-4 pb-4 scroll-area">
      <!-- Header -->
      <div class="text-center pt-4 mb-6 animate-bounce-once">
        <div class="text-6xl mb-3">🏆</div>
        <h1 class="text-3xl font-extrabold mb-1">Game Over!</h1>
        <p class="text-white/40 text-sm">
          {{ gameState.round }} round{{ gameState.round !== 1 ? 's' : '' }} played
        </p>
      </div>

      <!-- Podium — scales to the actual number of players -->
      <div
        v-if="sortedPlayers.length >= 1"
        class="flex items-end justify-center gap-3 mb-8 animate-fade-in"
      >
        <!-- 2nd place -->
        <div v-if="sortedPlayers[1]" class="flex flex-col items-center flex-1 max-w-[100px]">
          <p class="text-xs font-semibold text-white/60 mb-1 truncate w-full text-center">
            {{ sortedPlayers[1].name }}
          </p>
          <div
            class="w-full h-20 bg-white/10 rounded-t-xl flex items-end justify-center pb-2"
          >
            <span class="text-xl font-extrabold text-white/60">{{ sortedPlayers[1].score }}</span>
          </div>
          <div class="w-full bg-white/10 text-center text-xs text-white/40 py-1.5 rounded-b">
            2nd 🥈
          </div>
        </div>

        <!-- 1st place — taller than others -->
        <div class="flex flex-col items-center flex-1 max-w-[110px]">
          <p class="text-sm font-bold text-yellow-400 mb-1 truncate w-full text-center">
            {{ sortedPlayers[0].name }}
          </p>
          <div
            class="w-full h-28 bg-yellow-500/20 border border-yellow-500/40
                   rounded-t-xl flex items-end justify-center pb-2"
          >
            <span class="text-3xl font-extrabold text-yellow-400">{{ sortedPlayers[0].score }}</span>
          </div>
          <div
            class="w-full bg-yellow-500/20 border border-yellow-500/30
                   text-center text-xs text-yellow-400 py-1.5 rounded-b"
          >
            1st 🥇
          </div>
        </div>

        <!-- 3rd place -->
        <div v-if="sortedPlayers[2]" class="flex flex-col items-center flex-1 max-w-[90px]">
          <p class="text-xs font-semibold text-white/50 mb-1 truncate w-full text-center">
            {{ sortedPlayers[2].name }}
          </p>
          <div
            class="w-full h-14 bg-white/5 rounded-t-xl flex items-end justify-center pb-2"
          >
            <span class="text-lg font-extrabold text-white/50">{{ sortedPlayers[2].score }}</span>
          </div>
          <div class="w-full bg-white/5 text-center text-xs text-white/30 py-1.5 rounded-b">
            3rd 🥉
          </div>
        </div>
      </div>

      <!-- Full scoreboard -->
      <div class="card mb-4">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-3">All Scores</p>
        <ul class="space-y-2">
          <li
            v-for="(player, idx) in sortedPlayers"
            :key="player.id"
            class="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10"
          >
            <span class="text-xs text-white/30 w-5 shrink-0">{{ idx + 1 }}</span>
            <span class="flex-1 font-medium truncate">{{ player.name }}</span>
            <span v-if="player.isHost" class="badge bg-yellow-500/20 text-yellow-400 shrink-0">
              Host
            </span>
            <span class="font-extrabold text-green-400 text-lg shrink-0">{{ player.score }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Sticky back button -->
    <div class="action-bar">
      <button class="btn-primary w-full text-base py-4" @click="$emit('leave')">
        🏠 Back to Home
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GameState, PublicPlayer } from '../types/index.js'

defineProps<{
  gameState: GameState
  sortedPlayers: PublicPlayer[]
}>()

defineEmits<{ leave: [] }>()
</script>
