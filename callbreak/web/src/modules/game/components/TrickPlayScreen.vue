<template>
  <div v-if="state" class="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 animate-slide-up">
    <div class="flex justify-end">
      <button
        type="button"
        class="rounded-full border-2 border-border bg-card px-3 py-1 text-xs font-display font-bold text-foreground shadow-hard-sm transition-transform active:scale-95"
        @click="showTracker = true"
      >
        🗂️ {{ t.trickPlay.trackerButton }}
      </button>
    </div>

    <!-- Big, unmissable turn indicator — first thing on the screen. -->
    <div
      class="rounded-2xl px-4 py-3 text-center font-display text-base font-bold shadow-pop transition-colors"
      :class="isMyTurn ? 'animate-pulse-slow bg-primary text-primary-foreground' : 'bg-secondary/70 text-muted-foreground'"
    >
      {{ isMyTurn ? t.trickPlay.yourTurn : t.trickPlay.waitingFor(turnPlayerName) }}
    </div>

    <div class="flex flex-wrap items-center justify-center gap-2">
      <SeatBadge v-for="(p, seat) in state.players" :key="seat" :player="p" :seat="seat" :state="state" show-tricks />
    </div>

    <Transition name="pop">
      <div
        v-if="showTracker"
        class="fixed inset-0 z-20 flex items-end justify-center bg-black/40 p-4 sm:items-center"
        @click.self="showTracker = false"
      >
        <div class="w-full max-w-sm rounded-3xl border-2 border-border bg-card p-4 shadow-pop">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="font-display text-base font-bold">{{ t.trickPlay.trackerTitle }}</h3>
            <button type="button" class="text-sm font-semibold text-muted-foreground" @click="showTracker = false">
              {{ t.trickPlay.trackerClose }}
            </button>
          </div>
          <p v-if="!state.playedThisRound.length" class="text-sm text-muted-foreground">{{ t.trickPlay.trackerEmpty }}</p>
          <div v-else class="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto scroll-area">
            <div v-for="suit in suitOrder" :key="suit" v-show="cardsBySuit[suit].length" class="flex items-start gap-2">
              <SuitGlyph :suit="suit" class="mt-0.5 h-5 w-5 shrink-0" />
              <div class="flex flex-wrap gap-1.5">
                <span
                  v-for="play in cardsBySuit[suit]"
                  :key="`${play.card.suit}${play.card.rank}-${play.seat}`"
                  class="rounded-md border border-border bg-secondary/30 px-1.5 py-0.5 text-xs font-display font-bold"
                >
                  {{ rankLabel(play.card.rank) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <div class="relative flex flex-1 items-center justify-center rounded-3xl border-2 border-dashed border-border/60 bg-secondary/20 p-4">
      <Transition name="pop">
        <div v-if="wonBanner" class="absolute top-3 z-10 rounded-full bg-primary px-4 py-1.5 font-display text-sm font-bold text-primary-foreground shadow-pop">
          {{ t.trickPlay.wonTrick(wonBanner) }}
        </div>
      </Transition>

      <!-- The trick table: one big card per seat, each clearly labeled with
           who played it. The current player's slot pulses (card or empty
           placeholder) so it's obvious who the group is waiting on. -->
      <div class="grid w-full max-w-[24rem] grid-cols-2 gap-4">
        <div v-for="(p, seat) in state.players" :key="seat" class="flex flex-col items-center gap-1.5">
          <span
            class="rounded-full px-3 py-1 text-xs font-display font-bold transition-colors"
            :class="
              seat === state.turnSeat
                ? 'animate-pulse bg-primary text-primary-foreground'
                : seat === state.yourSeat
                  ? 'bg-flavor-melon/25 text-flavor-melon-ink'
                  : 'bg-card text-foreground'
            "
          >
            {{ p?.name ?? '' }}{{ seat === state.yourSeat ? ` (${t.common.you})` : '' }}
          </span>
          <div class="w-24 sm:w-28">
            <PlayingCard v-if="cardFor(seat)" :card="cardFor(seat)!" class="animate-pop-in" />
            <div
              v-else
              class="aspect-[5/7] w-full rounded-lg border-2 border-dashed"
              :class="seat === state.turnSeat ? 'animate-pulse border-primary' : 'border-border/40'"
            />
          </div>
        </div>
      </div>
    </div>

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
import { legalPlays, type Card, type Suit } from '@callbreak/shared-logic'
import PlayingCard from '@/components/cards/PlayingCard.vue'
import { rankLabel } from '@/components/cards/suitPaths'
import SuitGlyph from '@/components/cards/SuitGlyph.vue'
import { en } from '@/locales/en'
import { useGame } from '../composables/useGame'
import SeatBadge from './SeatBadge.vue'

const t = en.callBreak
const game = useGame()
const state = computed(() => game.state.value)
const isMyTurn = computed(() => game.isMyTurn.value)

const showTracker = ref(false)
const suitOrder: Suit[] = ['S', 'H', 'D', 'C']
const cardsBySuit = computed(() => {
  const groups: Record<Suit, { seat: number; card: Card }[]> = { S: [], H: [], D: [], C: [] }
  for (const play of state.value?.playedThisRound ?? []) {
    groups[play.card.suit].push(play)
  }
  for (const suit of suitOrder) {
    groups[suit].sort((a, b) => a.card.rank - b.card.rank)
  }
  return groups
})

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
