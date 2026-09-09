<script setup lang="ts">
/**
 * Purely decorative blurred gradient orb with an organic squircle shape.
 * Copied from the Imposter module so the Traitor module stays self-contained.
 * `aria-hidden` — never carries information. Frozen under
 * `prefers-reduced-motion` by the global rule in src/assets/tailwind.css.
 */
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  flavor?: 'citron' | 'peach' | 'berry' | 'grape' | 'lychee' | 'melon'
  size?: string
  delay?: number
}>(), {
  flavor: 'berry',
  size: '18rem',
  delay: 0,
})

const style = computed(() => ({
  width: props.size,
  height: props.size,
  backgroundImage: `radial-gradient(circle at 32% 28%, hsl(var(--flavor-${props.flavor})), hsl(var(--flavor-${props.flavor}-soft)) 72%)`,
  filter: 'blur(6px)',
  animationDelay: `${props.delay}s`,
}))
</script>

<template>
  <span
    aria-hidden="true"
    class="pointer-events-none block rounded-blob opacity-60 animate-float"
    :style="style"
  />
</template>
