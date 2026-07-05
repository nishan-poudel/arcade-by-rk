<template>
  <div class="min-h-dvh flex flex-col bg-[#0d0d0d]" style="padding-top: max(1rem, env(safe-area-inset-top))">
    <!-- Scrollable body -->
    <div class="flex-1 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <!-- Room code: BIG, easy to read from across the table.
           Tap anywhere on the badge to copy it to clipboard. -->
      <div class="text-center mb-6 animate-fade-in">
        <p class="text-white/40 text-xs uppercase tracking-widest mb-3">{{ locale.imposter.waitingRoom.title }}</p>
        <button
          class="inline-flex flex-col items-center justify-center bg-white/10 border border-white/20
                 rounded-2xl px-6 py-4 mb-2 active:bg-white/20 transition-colors w-full max-w-xs"
          @click="copyCode"
        >
          <span class="font-mono font-extrabold text-4xl tracking-[0.25em] text-white">
            {{ gameState.roomCode }}
          </span>
          <span class="text-xs mt-2 transition-colors" :class="copied ? 'text-green-400' : 'text-white/40'">
            {{ copied ? locale.imposter.waitingRoom.copied : locale.imposter.waitingRoom.tapToCopy }}
          </span>
        </button>
        <p class="text-white/40 text-sm">{{ locale.imposter.waitingRoom.shareCode }}</p>
        <button
          class="mt-3 inline-flex items-center gap-1.5 text-xs text-white/50 active:text-white/80 transition-colors"
          @click="copyInviteLink"
        >
          {{ linkCopied ? locale.imposter.waitingRoom.linkCopied : locale.imposter.waitingRoom.copyInviteLink }}
        </button>
      </div>

      <!-- Player list -->
      <div class="card mb-4">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold text-base">{{ locale.imposter.waitingRoom.playersHeading }}</h2>
          <span class="badge bg-white/10 text-white/60 text-sm">
            {{ locale.imposter.waitingRoom.playersCount(gameState.players.length) }}
          </span>
        </div>

        <TransitionGroup
          name="player-list" tag="ul"
          class="space-y-2">
          <li
            v-for="player in gameState.players"
            :key="player.id"
            class="flex items-center gap-3 py-3 px-3 rounded-xl bg-white/5 border border-white/10"
          >
            <span
              :class="[
                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                player.connected ? 'bg-green-400' : 'bg-white/20',
              ]"
            />
            <span class="flex-1 font-medium text-base">{{ player.name }}</span>
            <span v-if="player.isHost" class="badge bg-yellow-500/20 text-yellow-400">{{ locale.imposter.waitingRoom.hostBadge }}</span>
          </li>
        </TransitionGroup>

        <p v-if="gameState.players.length < 3" class="text-white/30 text-xs mt-3 text-center">
          {{ locale.imposter.waitingRoom.needMorePlayers }}
        </p>
      </div>

      <!-- Host settings -->
      <div v-if="isHost" class="card mb-4 space-y-4">
        <h2 class="font-semibold text-base">{{ locale.imposter.waitingRoom.settingsHeading }}</h2>

        <div>
          <label class="block text-xs text-white/50 mb-2 uppercase tracking-wider">{{ locale.imposter.waitingRoom.difficultyLabel }}</label>
          <select
            :value="gameState.difficulty"
            class="input"
            @change="$emit('set-difficulty', ($event.target as HTMLSelectElement).value as Difficulty)"
          >
            <option value="easy">{{ locale.imposter.difficulty.easy }}</option>
            <option value="medium">{{ locale.imposter.difficulty.medium }}</option>
            <option value="hard">{{ locale.imposter.difficulty.hard }}</option>
          </select>
        </div>

        <div>
          <label class="block text-xs text-white/50 mb-2 uppercase tracking-wider">
            {{ locale.imposter.waitingRoom.impostersLabel }}
          </label>
          <div class="flex gap-2">
            <button
              v-for="n in Math.min(4, Math.max(1, gameState.players.length - 1))"
              :key="n"
              :class="[
                'flex-1 min-h-[52px] rounded-xl font-bold text-lg border transition-all active:scale-95',
                gameState.imposterCount === n
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/60',
              ]"
              @click="$emit('set-imposter-count', n)"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <!-- Keep-alive toggle: prevents a free-tier backend (e.g. Render)
             from spinning down while the group lingers in the lobby. -->
        <button
          class="w-full flex items-center justify-between text-left rounded-xl px-3 py-3 border transition-colors"
          :class="keepAliveEnabled ? 'border-green-500/30 bg-green-500/5' : 'border-white/10 bg-white/5'"
          @click="toggleKeepAlive"
        >
          <span>
            <span class="block text-sm font-semibold" :class="keepAliveEnabled ? 'text-green-400' : 'text-white/70'">
              {{ keepAliveEnabled ? locale.imposter.common.keepAliveOn : locale.imposter.common.keepAliveOff }}
            </span>
            <span class="block text-xs text-white/30 mt-0.5">{{ locale.imposter.common.keepAliveHint }}</span>
          </span>
          <span
            :class="[
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ml-3',
              keepAliveEnabled ? 'bg-green-500' : 'bg-white/15',
            ]"
          >
            <span
              :class="[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                keepAliveEnabled ? 'translate-x-4' : 'translate-x-1',
              ]"
            />
          </span>
        </button>
      </div>

      <!-- Non-host waiting message -->
      <div v-else class="text-center text-white/40 text-sm py-3">
        <div class="flex items-center gap-2 justify-center">
          <span class="w-2 h-2 bg-green-400 rounded-full animate-pulse-slow" />
          {{ locale.imposter.waitingRoom.waitingForHost }}
        </div>
      </div>
    </div>

    <!-- Sticky action bar at bottom -->
    <div class="action-bar space-y-2">
      <button
        v-if="isHost"
        class="btn-primary w-full text-base py-4"
        :disabled="gameState.players.length < 3"
        @click="$emit('start')"
      >
        {{ locale.imposter.waitingRoom.startGame }}
      </button>
      <button class="btn-secondary w-full text-sm" @click="$emit('leave')">
        {{ locale.imposter.waitingRoom.leaveRoom }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { en as locale } from '@/locales/en'
import { useKeepAlive } from '../composables/useKeepAlive.js'
import type { GameState, Difficulty } from '../types/index.js'

const props = defineProps<{
  gameState: GameState
  isHost: boolean
}>()

defineEmits<{
  start: []
  leave: []
  'set-difficulty': [difficulty: Difficulty]
  'set-imposter-count': [count: number]
}>()
// ── Keep-alive toggle (prevents free-tier backend spin-down mid-lobby) ────────
const { enabled: keepAliveEnabled, toggle: toggleKeepAlive } = useKeepAlive()
// ── Copy room code ────────────────────────────────────────────────────────────
const copied = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.gameState.roomCode)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Clipboard API not available (non-HTTPS) — code is still visible on screen
  }
}

// ── Copy shareable invite link (full URL, so opening it lands directly on
//    the Join form with the room code pre-filled) ───────────────────────────
const linkCopied = ref(false)

async function copyInviteLink() {
  try {
    const url = `${location.origin}/imposter/${props.gameState.roomCode}`
    await navigator.clipboard.writeText(url)
    linkCopied.value = true
    setTimeout(() => { linkCopied.value = false }, 2000)
  } catch {
    // Clipboard API not available (non-HTTPS) — room code is still visible on screen
  }
}
</script>

<style scoped>
.player-list-enter-active,
.player-list-leave-active {
  transition: all 0.25s ease;
}
.player-list-enter-from,
.player-list-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
