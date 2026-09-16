<template>
  <div class="relative aspect-[0.691] w-full">
    <PlayingCard :card="card" class="absolute inset-0" :class="stage === 'revealed' ? 'animate-pop-in' : ''" />
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
import { ref, watch } from 'vue'
import type { Card } from '@callbreak/shared-logic'
import CardBack from '@/components/cards/CardBack.vue'
import PlayingCard from '@/components/cards/PlayingCard.vue'

const RUB_MS = 700
const PEEL_MS = 900

const props = defineProps<{
  card: Card
  /** Flips from false to true once, when the whole hand should start
   * revealing — the parent drives this off the server's `seen` flag. */
  trigger: boolean
  /** How long to wait before this specific card starts its own rub+peel,
   * so a 3-card hand reveals one card after another, not all at once. */
  delayMs: number
}>()

// If we mount already "seen" (e.g. a page reload after already peeking),
// jump straight to revealed — only a live false->true transition plays the
// suspense animation.
type Stage = 'hidden' | 'rubbing' | 'peeling' | 'revealed'
const stage = ref<Stage>(props.trigger ? 'revealed' : 'hidden')

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
        }, PEEL_MS)
      }, RUB_MS)
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
