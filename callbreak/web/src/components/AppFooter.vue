<template>
  <!--
    Shared attribution footer, with a hidden easter egg: tapping the name
    spins it around to reveal the real name underneath (and spins back if
    tapped again). Purely decorative, local-only state. Mirrors the
    Imposter/Traitor games' AppFooter.vue exactly.
  -->
  <footer class="pb-3 pt-3 text-center text-xs text-muted-foreground/60">
    <p class="flex items-center justify-center gap-1.5">
      <span>{{ t.footerMadeBy }}</span>
      <button
        type="button"
        class="font-display font-semibold text-muted-foreground transition-colors hover:text-primary"
        style="perspective: 300px"
        :aria-label="t.footerMadeBy + ' ' + (isRealNameRevealed ? t.footerRealName : t.footerName)"
        @click="isRealNameRevealed = !isRealNameRevealed"
      >
        <Transition name="spin" mode="out-in">
          <span :key="isRealNameRevealed ? 'real' : 'alias'" class="inline-block">{{
            isRealNameRevealed ? t.footerRealName : t.footerName
          }}</span>
        </Transition>
      </button>
    </p>
  </footer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { en } from '@/locales/en'

const t = en.hub

/** Footer easter egg: toggled by tapping the credit name. */
const isRealNameRevealed = ref(false)
</script>

<style scoped>
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
