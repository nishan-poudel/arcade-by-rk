<template>
  <div v-if="state" class="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 animate-slide-up">
    <div class="flex flex-wrap justify-center gap-2">
      <SeatBadge v-for="(p, seat) in state.players" :key="seat" :player="p" :seat="seat" :state="state" show-tricks />
    </div>

    <div class="relative flex flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-border/60 bg-secondary/20 p-6">
      <Transition name="pop">
        <div v-if="wonBanner" class="absolute top-3 rounded-full bg-primary px-4 py-1.5 font-display text-sm font-bold text-primary-foreground shadow-pop">
          {{ t.trickPlay.wonTrick(wonBanner) }}
        </div>
      </Transition>

      <div class="grid w-full max-w-[16rem] grid-cols-2 gap-3">
        <div v-for="(p, seat) in state.players" :key="seat" class="flex flex-col items-center gap-1">
          <span class="text-xs font-display font-semibold text-muted-foreground">{{ p?.name ?? '' }}</span>
          <div class="w-16">
            <PlayingCard v-if="cardFor(seat)" :card="cardFor(seat)!" />
            <div v-else class="aspect-[5/7] w-full rounded-lg border-2 border-dashed border-border/40" />
          </div>
        </div>
      </div>
    </div>

    <p class="text-center text-sm font-medium" :class="isMyTurn ? 'text-primary' : 'text-muted-foreground'">
      {{ isMyTurn ? t.trickPlay.yourTurn : t.trickPlay.waitingFor(turnPlayerName) }}
    </p>

    <div class="scroll-area -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2">
      <button
        v-for="card in sortedHand"
        :key="`${card.suit}${card.rank}`"
        class="w-16 shrink-0"
        :disabled="!isMyTurn || !isLegal(card)"
        @click="play(card)"
      >
        <PlayingCard :card="card" interactive :disabled="isMyTurn && !isLegal(card)" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { legalPlays, type Card } from '@callbreak/shared-logic'
import PlayingCard from '@/components/cards/PlayingCard.vue'
import { en } from '@/locales/en'
import { useGame } from '../composables/useGame'
import SeatBadge from './SeatBadge.vue'

const t = en.callBreak
const game = useGame()
const state = computed(() => game.state.value)
const isMyTurn = computed(() => game.isMyTurn.value)

const sortedHand = computed(() => {
  const order = { S: 0, H: 1, D: 2, C: 3 }
  return [...(state.value?.hand ?? [])].sort((a, b) => order[a.suit] - order[b.suit] || b.rank - a.rank)
})

const trickCardsSoFar = computed(() => state.value?.currentTrick.map((t) => t.card) ?? [])
const legalHand = computed(() => (state.value ? legalPlays(state.value.hand, trickCardsSoFar.value) : []))
function isLegal(card: Card): boolean {
  return legalHand.value.some((c) => c.suit === card.suit && c.rank === card.rank)
}

function cardFor(seat: number): Card | null {
  return state.value?.currentTrick.find((t) => t.seat === seat)?.card ?? null
}

const turnPlayerName = computed(() => (state.value ? (state.value.players[state.value.turnSeat]?.name ?? '') : ''))

function play(card: Card) {
  game.playCard(card)
}

const wonBanner = ref<string | null>(null)
watch(
  () => state.value?.lastTrick?.trickSeq,
  (seq, prevSeq) => {
    if (seq === undefined || seq === prevSeq) return
    const winnerSeat = state.value?.lastTrick?.winnerSeat
    const name = winnerSeat !== undefined ? state.value?.players[winnerSeat]?.name : undefined
    if (!name) return
    wonBanner.value = name
    setTimeout(() => (wonBanner.value = null), 1400)
  },
)
</script>

<style scoped>
.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s var(--ease-bounce, cubic-bezier(0.34, 1.4, 0.5, 1));
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.9);
}
</style>
