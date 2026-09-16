<template>
  <div
    class="absolute top-0 transition-[left] duration-700 ease-out"
    :style="{ left: `${position}rem`, width: `${widthRem}rem`, height: `${heightRem}rem`, zIndex: currentZIndex }"
  >
    <PlayingCard :card="card" class="absolute inset-0 h-full w-full" :class="stage === 'revealed' ? 'animate-pop-in' : ''" />
    <div
      v-if="stage !== 'revealed'"
      class="absolute inset-0 overflow-hidden rounded-lg"
      :class="{ 'ghotchu-rub': stage === 'rubbing', 'ghotchu-peel': stage === 'peeling' }"
    >
      <CardBack class="h-full w-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Card } from '@callbreak/shared-logic'
import CardBack from '@/components/cards/CardBack.vue'
import PlayingCard from '@/components/cards/PlayingCard.vue'
import { GHOTCHU_PEEL_MS, GHOTCHU_RUB_MS } from './ghotchuTiming'

const props = defineProps<{
  card: Card
  /** Flips from false to true once, when the whole hand should start
   * revealing — the parent drives this off the server's `seen` flag. */
  trigger: boolean
  /** How long to wait before this specific card starts its own rub+peel,
   * so a 3-card hand reveals one card after another, not all at once. */
  delayMs: number
  /** Tucked-behind position (rem from the left) before this card's own
   * turn — small, so only a sliver peeks out from the stack. */
  peekOffsetRem: number
  /** Fanned-out position (rem from the left) once this card starts
   * revealing — it slides out to here while it peels. */
  finalOffsetRem: number
  /** Stacking order before this card's own turn — earlier cards (lower
   * index) sit on top of later ones, so the untouched stack reads as
   * "first card in front, the rest tucked behind it." */
  baseZIndex: number
  widthRem: number
  heightRem: number
}>()

// If we mount already "seen" (e.g. a page reload after already peeking),
// jump straight to revealed and fanned-out — only a live false->true
// transition plays the suspense animation.
type Stage = 'hidden' | 'rubbing' | 'peeling' | 'revealed'
const stage = ref<Stage>(props.trigger ? 'revealed' : 'hidden')
const position = computed(() => (stage.value === 'hidden' ? props.peekOffsetRem : props.finalOffsetRem))

// Once a card starts its own reveal it lifts above the whole stack, so it
// visibly slides out and "rubs past" the card(s) already in front of it —
// otherwise a later card sliding out from underneath would stay hidden
// behind the earlier one for the whole animation instead of emerging.
const currentZIndex = computed(() => (stage.value === 'hidden' ? props.baseZIndex : 100 + props.baseZIndex))

watch(
  () => props.trigger,
  (value, prev) => {
    if (!value || prev) return
    setTimeout(() => {
      stage.value = 'rubbing'
      setTimeout(() => {
        stage.value = 'peeling'
        setTimeout(() => {
          stage.value = 'revealed'
        }, GHOTCHU_PEEL_MS)
      }, GHOTCHU_RUB_MS)
    }, props.delayMs)
  },
)
</script>

<style scoped>
/* A little back-and-forth rock, mimicking a thumb rubbing the corner before
   peeling it back. */
.ghotchu-rub {
  animation: ghotchu-rub 0.7s ease-in-out;
  transform-origin: 70% 70%;
}
@keyframes ghotchu-rub {
  0%,
  100% {
    transform: rotate(0deg);
  }
  20% {
    transform: rotate(-4deg);
  }
  40% {
    transform: rotate(3deg);
  }
  60% {
    transform: rotate(-3deg);
  }
  80% {
    transform: rotate(2deg);
  }
}

/* The back peels away from the bottom-right corner toward the top-left,
   uncovering the real face underneath a little at a time. */
.ghotchu-peel {
  animation: ghotchu-peel 0.9s ease-in forwards;
}
@keyframes ghotchu-peel {
  0% {
    clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%);
  }
  55% {
    clip-path: polygon(0% 0%, 100% 0%, 55% 45%, 0% 100%);
  }
  100% {
    clip-path: polygon(0% 0%, 100% 0%, 0% 0%, 0% 0%);
  }
}
</style>
