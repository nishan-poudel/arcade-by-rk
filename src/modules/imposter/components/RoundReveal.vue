<template>
  <!--
    Post-round reveal screen.
    Shown to ALL players after the host records a voting result.
    Safe to display: the round is over, no more word-guessing needed.
  -->
  <div
    class="min-h-dvh flex flex-col bg-[#0d0d0d]"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <!-- Scrollable body -->
    <div class="flex-1 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <!-- Result banner -->
      <div class="text-center mb-6 animate-bounce-once">
        <div class="text-6xl mb-3">
          {{ reveal.imposterCaught ? '✅' : '😈' }}
        </div>
        <h1 class="text-2xl font-extrabold mb-1">
          {{ reveal.imposterCaught ? locale.imposter.roundReveal.imposterCaughtTitle : locale.imposter.roundReveal.imposterSurvivedTitle }}
        </h1>
        <p class="text-white/50 text-sm mb-1">
          <template v-if="reveal.ejectedPlayerName">{{ locale.imposter.roundReveal.ejected(reveal.ejectedPlayerName) }}</template>
          <template v-else>{{ locale.imposter.roundReveal.noMajority }}</template>
        </p>
        <p class="text-white/40 text-sm">
          {{ reveal.imposterCaught ? locale.imposter.roundReveal.crewmatesScored : locale.imposter.roundReveal.impostersScored }}
        </p>
      </div>

      <!-- Secret word reveal -->
      <div
        class="card text-center mb-4 animate-fade-in border-white/20"
        :class="reveal.imposterCaught ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'"
      >
        <p class="text-xs text-white/40 uppercase tracking-widest mb-2">{{ locale.imposter.roundReveal.secretWordLabel }}</p>
        <p class="text-5xl font-extrabold tracking-tight">{{ reveal.word }}</p>
      </div>

      <!-- Imposters reveal -->
      <div class="card mb-4 animate-fade-in border-red-500/20 bg-red-500/5">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-3">
          {{ reveal.imposterNames.length === 1 ? locale.imposter.roundReveal.imposterWasSingular : locale.imposter.roundReveal.imposterWasPlural }}
        </p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="name in reveal.imposterNames"
            :key="name"
            class="flex items-center gap-2 bg-red-500/20 border border-red-500/40
                   rounded-full px-4 py-2 text-red-300 font-semibold text-base"
          >
            <span class="text-lg">👾</span>
            {{ name }}
          </span>
        </div>
      </div>

      <!-- Vote breakdown -->
      <div v-if="gameState" class="card mb-4 animate-fade-in">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-3">{{ locale.imposter.roundReveal.voteResultsHeading }}</p>
        <ul class="space-y-2 mb-1">
          <li
            v-for="player in gameState.players"
            :key="player.id"
            class="flex items-center gap-3"
          >
            <span
              class="flex-1 text-sm truncate"
              :class="player.id === reveal.ejectedPlayerId ? 'text-red-300 font-semibold' : 'text-white/70'"
            >
              {{ player.name }}
              <span v-if="player.id === reveal.ejectedPlayerId">🚪</span>
            </span>
            <div class="flex-1 max-w-[100px] bg-white/5 rounded-full h-2 overflow-hidden">
              <div
                class="bg-red-500 h-2 rounded-full transition-all"
                :style="{ width: votePercent(player.id) + '%' }"
              />
            </div>
            <span class="text-xs text-white/40 w-4 text-right">{{ reveal.voteCounts[player.id] ?? 0 }}</span>
          </li>
        </ul>
      </div>

      <!-- Round scores snapshot -->
      <div v-if="gameState" class="card animate-fade-in">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-3">{{ locale.imposter.roundReveal.scoresAfterRound(reveal.round) }}</p>
        <ul class="space-y-2">
          <li
            v-for="(player, idx) in sortedPlayers"
            :key="player.id"
            :class="[
              'flex items-center gap-3 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10',
              player.id === myId ? 'ring-1 ring-green-500/50' : '',
            ]"
          >
            <span class="text-xs text-white/30 w-5 shrink-0">{{ idx + 1 }}</span>
            <span class="flex-1 font-medium truncate">{{ player.name }}</span>
            <span
              v-if="isImposterName(player.name)"
              class="badge bg-red-500/20 text-red-400 shrink-0"
            >👾</span>
            <span class="font-extrabold text-green-400 text-lg shrink-0">{{ player.score }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="action-bar">
      <!-- Host: next round or end game -->
      <div v-if="isHost" class="space-y-2">
        <button class="btn-primary w-full text-base py-4" @click="$emit('next-round')">
          {{ locale.imposter.roundReveal.nextRound }}
        </button>
        <button class="btn-danger w-full text-sm py-3" @click="$emit('end-game')">
          {{ locale.imposter.roundReveal.endGame }}
        </button>
      </div>
      <!-- Players: waiting message -->
      <div v-else class="text-center py-3">
        <div class="flex items-center gap-2 justify-center text-white/50 text-sm">
          <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse-slow" />
          {{ locale.imposter.roundReveal.waitingForHost }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { en as locale } from '@/locales/en'
import type { GameReveal, GameState, PublicPlayer } from '../types/index.js'

const props = defineProps<{
  reveal: GameReveal
  gameState: GameState | null
  myId: string
  isHost: boolean
}>()

defineEmits<{
  'next-round': []
  'end-game': []
}>()

const sortedPlayers = computed<PublicPlayer[]>(() => {
  if (!props.gameState) {return []}
  return [...props.gameState.players].sort((a, b) => b.score - a.score)
})

/** Used to badge imposters in the score list */
function isImposterName(name: string): boolean {
  return props.reveal.imposterNames.includes(name)
}

function votePercent(playerId: string): number {
  const total = Object.values(props.reveal.voteCounts).reduce((sum, n) => sum + n, 0)
  if (total === 0) {return 0}
  return Math.round(((props.reveal.voteCounts[playerId] ?? 0) / total) * 100)
}

</script>
