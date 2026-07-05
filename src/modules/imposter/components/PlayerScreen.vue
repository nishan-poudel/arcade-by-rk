<template>
  <!--
    Layout: fixed-height screen split into scrollable content + sticky Done button.
    The Done button stays in the thumb zone (bottom of screen) at all times.
  -->
  <div
    class="min-h-dvh flex flex-col bg-[#0d0d0d]"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <!-- Scrollable content area -->
    <div class="flex-1 overflow-y-auto px-4 pt-2 pb-4 scroll-area">

      <!-- Player header: name + score -->
      <div class="flex items-center justify-between mb-4 animate-fade-in">
        <div>
          <p class="text-white/40 text-xs uppercase tracking-wider">Player</p>
          <h2 class="text-xl font-bold leading-tight">{{ me?.name ?? '—' }}</h2>
        </div>
        <div class="text-right">
          <p class="text-white/40 text-xs uppercase tracking-wider">Score</p>
          <p class="text-3xl font-extrabold text-green-400">{{ me?.score ?? 0 }}</p>
        </div>
      </div>

      <!-- Role + secret word card: the most important info, takes centre stage -->
      <div
        :class="[
          'card text-center mb-4 transition-all duration-300',
          myAssignment.role === 'imposter'
            ? 'border-red-500/60 bg-red-500/10'
            : 'border-green-500/30 bg-green-500/5',
        ]"
      >
        <Transition name="role" mode="out-in">
          <div v-if="myAssignment.role === 'crewmate'" key="crew" class="py-2">
            <p class="text-xs text-white/40 uppercase tracking-widest mb-1">Your Role</p>
            <p class="text-2xl font-bold text-green-400 mb-4">🧑‍🚀 Crewmate</p>
            <div class="border-t border-white/10 pt-4">
              <p class="text-xs text-white/40 uppercase tracking-widest mb-2">Secret Word</p>
              <!-- Word is very large so it's easy to remember at a glance -->
              <p class="text-5xl font-extrabold tracking-tight leading-tight break-words">
                {{ myAssignment.word }}
              </p>
            </div>
          </div>
          <div v-else key="imp" class="py-2">
            <p class="text-xs text-white/40 uppercase tracking-widest mb-1">Your Role</p>
            <p class="text-2xl font-bold text-red-400 mb-4">👾 IMPOSTER</p>
            <div class="border-t border-white/10 pt-4">
              <p class="text-xs text-white/40 uppercase tracking-widest mb-2">Secret Word</p>
              <p class="text-5xl font-extrabold text-white/20">？？？</p>
              <p class="text-xs text-red-400/70 mt-3">Blend in. Don’t get caught.</p>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Current turn indicator -->
      <div class="card mb-4">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-2">Current Turn</p>
        <Transition name="turn" mode="out-in">
          <div v-if="screen === 'discussion'" key="disc" class="text-center py-2">
            <p class="text-2xl font-bold text-yellow-400">💬 Discussion Time!</p>
            <p class="text-sm text-white/50 mt-1">Talk it out, then vote</p>
          </div>
          <div
            v-else
            :key="gameState.currentTurnPlayerId"
            class="flex items-center gap-3"
          >
            <span
              :class="[
                'w-3 h-3 rounded-full flex-shrink-0 transition-colors',
                isMyTurn ? 'bg-green-400 animate-pulse-slow' : 'bg-white/20',
              ]"
            />
            <span
              :class="[
                'font-semibold text-lg',
                isMyTurn ? 'text-green-400' : 'text-white',
              ]"
            >
              {{ isMyTurn ? 'Your turn!' : gameState.currentTurnName }}
            </span>
          </div>
        </Transition>
      </div>

      <!-- In-app voting (discussion phase) -->
      <Transition name="panel">
        <div v-if="screen === 'discussion'" class="card mb-4 border-yellow-500/20">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-white/40 uppercase tracking-widest">Vote the Imposter</p>
            <span class="badge bg-white/10 text-white/60">{{ votedCount }}/{{ totalVoters }} voted</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="p in votablePlayers"
              :key="p.id"
              class="rounded-xl py-3 px-2 border text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 truncate"
              :class="myVote === p.id ? 'bg-red-500/30 border-red-500/60 text-red-300' : 'bg-white/5 border-white/10 text-white/70'"
              @click="$emit('submit-vote', p.id)"
            >
              <span v-if="myVote === p.id">🗳️</span>
              <span class="truncate">{{ p.name }}</span>
            </button>
          </div>
          <p class="text-xs text-white/30 mt-3 text-center">
            <template v-if="myVote">Voted for {{ votedName }} — tap another to change</template>
            <template v-else>Tap a name to cast your vote</template>
          </p>
        </div>
      </Transition>

      <!-- Compact scoreboard -->
      <div class="card">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-3">Scores</p>
        <ul class="space-y-1">
          <li
            v-for="(player, idx) in sortedPlayers"
            :key="player.id"
            :class="[
              'flex items-center gap-3 py-2 px-2 rounded-lg',
              player.id === myId ? 'bg-white/10' : '',
            ]"
          >
            <span class="text-xs text-white/30 w-5 shrink-0">{{ idx + 1 }}</span>
            <span
              :class="['w-2 h-2 rounded-full shrink-0', player.connected ? 'bg-green-400' : 'bg-white/20']"
            />
            <span class="flex-1 text-sm truncate">{{ player.name }}</span>
            <span class="font-bold text-green-400">{{ player.score }}</span>
          </li>
        </ul>
      </div>
    </div>

    <!--
      Sticky Done button — lives in the action-bar so it stays at the bottom
      of the screen regardless of scroll position. Huge target for easy tapping.
      Visible only during 'game' phase.
    -->
    <div v-if="screen === 'game'" class="action-bar">
      <Transition name="btn-bounce" appear>
        <button
          :class="[
            'w-full rounded-2xl font-extrabold text-xl transition-all duration-150',
            isMyTurn && !me?.hasDone
              ? 'btn-primary py-5 shadow-[0_0_40px_rgba(34,197,94,0.45)] animate-bounce-once'
              : 'bg-white/5 text-white/30 border border-white/10 py-5 cursor-not-allowed',
          ]"
          :disabled="!isMyTurn || me?.hasDone"
          @click="$emit('player-done')"
        >
          {{ isMyTurn && !me?.hasDone ? '✅ Done' : '⏳ Wait…' }}
        </button>
      </Transition>
    </div>

    <!-- Discussion phase bottom message -->
    <div v-else-if="screen === 'discussion'" class="action-bar text-center">
      <p class="text-yellow-400 font-semibold">�️ {{ votedCount }}/{{ totalVoters }} voted</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GameState, PlayerAssignment, AppScreen } from '../types/index.js'

const props = defineProps<{
  gameState: GameState
  myId: string
  myAssignment: PlayerAssignment
  myVote: string
  isMyTurn: boolean
  screen: AppScreen
}>()

defineEmits<{ 'player-done': []; 'submit-vote': [playerId: string] }>()

const me = computed(() => props.gameState.players.find((p) => p.id === props.myId))

const sortedPlayers = computed(() =>
  [...props.gameState.players].sort((a, b) => b.score - a.score),
)

/** Everyone except me — valid vote targets */
const votablePlayers = computed(() => props.gameState.players.filter((p) => p.id !== props.myId))

const votedCount = computed(() => props.gameState.players.filter((p) => p.hasVoted).length)
const totalVoters = computed(() => props.gameState.players.length)

const votedName = computed(
  () => props.gameState.players.find((p) => p.id === props.myVote)?.name ?? '',
)
</script>

<style scoped>
.role-enter-active,
.role-leave-active,
.turn-enter-active,
.turn-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.role-enter-from,
.turn-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.role-leave-to,
.turn-leave-to {
  opacity: 0;
  transform: scale(1.04);
}
</style>
