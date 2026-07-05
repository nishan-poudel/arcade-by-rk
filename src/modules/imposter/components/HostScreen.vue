<template>
  <div
    class="min-h-dvh flex flex-col bg-[#0d0d0d]"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4 animate-fade-in">
        <div>
          <span class="badge bg-yellow-500/20 text-yellow-400 mb-1 inline-block">👑 Host</span>
          <h2 class="text-xl font-bold leading-tight">{{ hostPlayer?.name ?? 'Host' }}</h2>
        </div>
        <div class="text-right">
          <p class="text-white/40 text-xs uppercase tracking-wider">Round</p>
          <p class="text-3xl font-extrabold">{{ gameState.round }}</p>
        </div>
      </div>

      <!--
        Secret word — HIDDEN if host is the imposter.
        This is the key fix: before, the host always saw the word even when
        they were assigned the imposter role.
      -->
      <div
        class="card mb-3 text-center"
        :class="isHostImposter
          ? 'border-red-500/40 bg-red-500/10'
          : 'border-yellow-500/30 bg-yellow-500/5'"
      >
        <p class="text-xs text-white/40 uppercase tracking-widest mb-1">
          {{ isHostImposter ? 'Your Role' : 'Secret Word' }}
        </p>
        <p v-if="isHostImposter" class="text-2xl font-bold text-red-400 mb-1">
          👾 IMPOSTER
        </p>
        <p v-if="isHostImposter" class="text-5xl font-extrabold text-white/20">？？？</p>
        <p v-else class="text-4xl font-extrabold tracking-tight break-words">
          {{ myAssignment.word ?? '???' }}
        </p>
        <p class="text-xs text-white/30 mt-1">{{ gameState.difficulty }} difficulty</p>
      </div>

      <!-- Imposters (only shown if host is NOT imposter — already knows if they are) -->
      <div v-if="!isHostImposter" class="card mb-3 border-red-500/30 bg-red-500/5">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-2">Imposters 👾</p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="imposterId in myAssignment.imposterIds"
            :key="imposterId"
            class="badge bg-red-500/20 text-red-400 py-1.5 px-3 rounded-full text-sm font-semibold"
          >
            {{ getPlayerName(imposterId) }}
          </span>
        </div>
      </div>

      <!-- Turn status + progress -->
      <div class="card mb-3">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-2">Status</p>
        <Transition name="turn" mode="out-in">
          <div
            v-if="screen === 'discussion'" key="disc"
            class="text-center py-1">
            <p class="text-xl font-bold text-yellow-400">💬 Discussion Time!</p>
            <p class="text-sm text-white/50 mt-1">Cast your vote below.</p>
          </div>
          <div v-else :key="gameState.currentTurnPlayerId">
            <div class="flex items-center gap-2 mb-3">
              <span class="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse-slow" />
              <span class="font-semibold">{{ gameState.currentTurnName }}'s turn</span>
            </div>
            <div class="w-full bg-white/5 rounded-full h-2">
              <div
                class="bg-green-500 h-2 rounded-full transition-all duration-500"
                :style="{ width: turnProgress + '%' }"
              />
            </div>
            <p class="text-xs text-white/30 mt-1.5">
              {{ donePlayers }} / {{ gameState.players.length }} done
            </p>
          </div>
        </Transition>
      </div>

      <!-- Player list -->
      <div class="card mb-3">
        <p class="text-xs text-white/40 uppercase tracking-widest mb-3">All Players</p>
        <ul class="space-y-2">
          <li
            v-for="(player, idx) in sortedPlayers"
            :key="player.id"
            class="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10"
          >
            <span class="text-xs text-white/30 w-5 shrink-0">{{ idx + 1 }}</span>
            <span
              :class="['w-2 h-2 rounded-full shrink-0', player.connected ? 'bg-green-400' : 'bg-white/20']"
            />
            <span class="flex-1 font-medium truncate">{{ player.name }}</span>
            <span
              v-if="!isHostImposter && myAssignment.imposterIds.includes(player.id)"
              class="badge bg-red-500/20 text-red-400"
            >👾</span>
            <span
              v-if="player.hasDone && screen === 'game'"
              class="badge bg-green-500/20 text-green-400"
            >✓</span>
            <span
              v-if="player.hasVoted && screen === 'discussion'"
              class="badge bg-yellow-500/20 text-yellow-400"
            >🗳️</span>
            <span class="font-bold text-green-400 text-sm">{{ player.score }}</span>
          </li>
        </ul>
      </div>

      <!-- In-app voting (discussion phase) — host votes too, plus can force-reveal early -->
      <Transition name="panel">
        <div v-if="screen === 'discussion'" class="card mb-3 border-yellow-500/20">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs text-white/40 uppercase tracking-widest">Vote the Imposter</p>
            <span class="badge bg-white/10 text-white/60">{{ votedCount }}/{{ totalVoters }} voted</span>
          </div>
          <div class="grid grid-cols-2 gap-2 mb-3">
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
          <p class="text-xs text-white/30 mb-3 text-center">
            <template v-if="myVote">Voted for {{ votedName }} — tap another to change</template>
            <template v-else>Tap a name to cast your vote</template>
          </p>
          <button class="btn-secondary w-full text-sm py-3" @click="$emit('force-reveal')">
            ⚡ Force Reveal Now
          </button>
        </div>
      </Transition>

      <!-- Host's own Done button (if it's their turn) -->
      <div v-if="screen === 'game' && isHostTurn" class="mb-3">
        <button
          class="btn-primary w-full text-xl py-5 rounded-2xl font-extrabold
                 shadow-[0_0_40px_rgba(34,197,94,0.4)] animate-bounce-once"
          :disabled="hostPlayer?.hasDone"
          @click="$emit('player-done')"
        >
          ✅ Done (Your Turn)
        </button>
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="action-bar space-y-2">
      <!-- Skip turn — only during game phase when it's NOT the host's own turn -->
      <button
        v-if="screen === 'game' && !isHostTurn"
        class="btn-secondary w-full text-sm py-3"
        @click="$emit('skip-turn')"
      >
        ⏭ Skip {{ gameState.currentTurnName }}'s Turn
      </button>

      <!-- Confirm overlay for destructive actions -->
      <Transition name="panel">
        <div v-if="confirmAction" class="card border-yellow-500/40 bg-yellow-500/10 text-center space-y-3">
          <p class="font-semibold text-sm">
            {{ confirmAction === 'reset' ? 'Reset all scores to zero?' : 'End the game for everyone?' }}
          </p>
          <div class="flex gap-2">
            <button class="btn-secondary flex-1 text-sm py-2.5" @click="confirmAction = null">
              Cancel
            </button>
            <button
              :class="confirmAction === 'end' ? 'btn-danger' : 'btn-primary'"
              class="flex-1 text-sm py-2.5"
              @click="confirmAndExecute"
            >
              {{ confirmAction === 'reset' ? 'Reset' : 'End Game' }}
            </button>
          </div>
        </div>
      </Transition>

      <div v-if="!confirmAction" class="grid grid-cols-2 gap-3">
        <button class="btn-secondary text-sm py-3" @click="confirmAction = 'reset'">
          🔄 Reset Scores
        </button>
        <button class="btn-danger text-sm py-3" @click="confirmAction = 'end'">
          🛑 End Game
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GameState, PlayerAssignment, AppScreen } from '../types/index.js'

const props = defineProps<{
  gameState: GameState
  myAssignment: PlayerAssignment
  myId: string
  myVote: string
  screen: AppScreen
}>()

const emit = defineEmits<{
  'end-game': []
  'reset-scores': []
  'submit-vote': [playerId: string]
  'force-reveal': []
  'player-done': []
  'skip-turn': []
}>()

// ── Confirm state ─────────────────────────────────────────────────────────────
const confirmAction = ref<'reset' | 'end' | null>(null)

function confirmAndExecute() {
  if (confirmAction.value === 'reset') {emit('reset-scores')}
  else if (confirmAction.value === 'end') {emit('end-game')}
  confirmAction.value = null
}

// ── Computed ──────────────────────────────────────────────────────────────────
const hostPlayer = computed(() =>
  props.gameState.players.find((p) => p.id === props.gameState.hostId),
)

/** True if the host themselves has been assigned the imposter role this round */
const isHostImposter = computed(
  () => props.myAssignment.role === 'imposter',
)

const isHostTurn = computed(
  () => props.gameState.currentTurnPlayerId === props.gameState.hostId,
)

const sortedPlayers = computed(() =>
  [...props.gameState.players].sort((a, b) => b.score - a.score),
)

const donePlayers = computed(() => props.gameState.players.filter((p) => p.hasDone).length)

const turnProgress = computed(() => {
  const total = props.gameState.players.length
  if (total === 0) {return 0}
  return Math.round((donePlayers.value / total) * 100)
})

/** Everyone except me — valid vote targets (host is a player too) */
const votablePlayers = computed(() => props.gameState.players.filter((p) => p.id !== props.myId))

const votedCount = computed(() => props.gameState.players.filter((p) => p.hasVoted).length)
const totalVoters = computed(() => props.gameState.players.length)

const votedName = computed(
  () => props.gameState.players.find((p) => p.id === props.myVote)?.name ?? '',
)

function getPlayerName(id: string): string {
  return props.gameState.players.find((p) => p.id === id)?.name ?? id
}
</script>

<style scoped>
.turn-enter-active,
.turn-leave-active,
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.turn-enter-from,
.panel-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.turn-leave-to,
.panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
