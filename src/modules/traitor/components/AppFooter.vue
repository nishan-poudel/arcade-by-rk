<template>
  <!--
    Shared attribution footer (same easter egg as the Imposter game): tapping
    the name spins it around to reveal the real name. Purely decorative,
    local-only state.
  -->
  <footer class="pt-3 pb-3 text-center text-xs text-muted-foreground/60">
    <p class="flex items-center justify-center gap-1.5">
      <span>{{ locale.traitor.footer.madeBy }}</span>
      <button
        type="button"
        class="font-display font-semibold text-muted-foreground transition-colors hover:text-primary"
        style="perspective: 300px"
        :aria-label="locale.traitor.footer.madeBy + ' ' + (isRealNameRevealed ? locale.traitor.footer.realName : locale.traitor.footer.name)"
        @click="isRealNameRevealed = !isRealNameRevealed"
      >
        <Transition name="spin" mode="out-in">
          <span :key="isRealNameRevealed ? 'real' : 'alias'" class="inline-block">{{
            isRealNameRevealed ? locale.traitor.footer.realName : locale.traitor.footer.name
          }}</span>
        </Transition>
      </button>
    </p>
  </footer>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { en as locale } from '@/locales/en'

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
