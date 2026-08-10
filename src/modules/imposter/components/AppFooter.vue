<template>
  <!--
    Shared attribution footer shown at the bottom of every screen, with a
    hidden easter egg: tapping the name spins it around to reveal the real
    name underneath (and spins back if tapped again). Purely decorative,
    local-only state.
  -->
  <footer class="pt-3 pb-3 text-center text-xs text-muted-foreground/60">
    <p class="flex items-center justify-center gap-1.5">
      <span>{{ locale.imposter.landing.footerMadeBy }}</span>
      <button
        type="button"
        class="font-semibold text-muted-foreground transition-colors hover:text-foreground/80"
        style="perspective: 300px"
        :aria-label="locale.imposter.landing.footerMadeBy + ' ' + (isRealNameRevealed ? locale.imposter.landing.footerRealName : locale.imposter.landing.footerName)"
        @click="isRealNameRevealed = !isRealNameRevealed"
      >
        <Transition name="spin" mode="out-in">
          <span :key="isRealNameRevealed ? 'real' : 'alias'" class="inline-block">{{
            isRealNameRevealed ? locale.imposter.landing.footerRealName : locale.imposter.landing.footerName
          }}</span>
        </Transition>
      </button>
    </p>
  </footer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { en as locale } from '@/locales/en'

/** Footer easter egg: toggled by tapping the credit name. */
const isRealNameRevealed = ref(false)
</script>

<style scoped>
/* Footer easter egg: spin the credit name around when it swaps. */
.spin-enter-active,
.spin-leave-active {
  transition: transform 0.35s ease, opacity 0.25s ease;
}
.spin-enter-from {
  transform: rotateY(180deg);
  opacity: 0;
}
.spin-leave-to {
  transform: rotateY(-180deg);
  opacity: 0;
}
</style>
