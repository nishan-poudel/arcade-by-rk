<script setup lang="ts">
import { Moon, Sun } from '@lucide/vue'
import { useTheme } from '@/composables/useTheme'

const { isDark, toggle } = useTheme()
</script>

<template>
  <button
    type="button"
    class="flex items-center justify-center size-8 rounded-full border border-border
           bg-secondary/70 backdrop-blur transition-all duration-200 ease-bounce
           hover:scale-110 active:scale-95"
    :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
    @click="toggle"
  >
    <Transition name="theme-icon" mode="out-in">
      <Sun
        v-if="isDark" key="sun"
        class="size-4 text-warning" />
      <Moon
        v-else key="moon"
        class="size-4 text-primary" />
    </Transition>
  </button>
</template>

<style scoped>
.theme-icon-enter-active,
.theme-icon-leave-active {
  transition: opacity 0.15s ease, transform 0.2s ease;
}
.theme-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.6);
}
.theme-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.6);
}
</style>
