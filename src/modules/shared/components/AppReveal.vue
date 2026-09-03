<template>
  <component
    :is="as"
    ref="el"
    class="app-reveal"
    :class="{ 'is-in': shown }"
    :style="{ '--reveal-delay': `${delay}s`, '--reveal-y': `${y}px` }"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

withDefaults(
  defineProps<{
    as?: string
    /** Stagger in seconds. */
    delay?: number
    /** Travel distance in px. */
    y?: number
  }>(),
  { as: 'div', delay: 0, y: 18 },
)

const el = ref<HTMLElement | null>(null)
const shown = ref(false)
let observer: IntersectionObserver | null = null

onMounted(() => {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (prefersReduced || typeof IntersectionObserver === 'undefined') {
    shown.value = true
    return
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          shown.value = true
          observer?.disconnect()
        }
      }
    },
    { rootMargin: '-40px 0px', threshold: 0.05 },
  )
  if (el.value) { observer.observe(el.value) }
  // Fallback: if the element starts on-screen with no scroll, still reveal.
  setTimeout(() => { shown.value = true }, 900)
})

onUnmounted(() => observer?.disconnect())
</script>

<style scoped>
.app-reveal {
  opacity: 0;
  transform: translateY(var(--reveal-y, 18px));
  transition:
    opacity 0.6s var(--ease-out-expo),
    transform 0.6s var(--ease-out-expo);
  transition-delay: var(--reveal-delay, 0s);
}
.app-reveal.is-in {
  opacity: 1;
  transform: translateY(0);
}
</style>
