<template>
  <span
    class="app-blob"
    aria-hidden="true"
    :style="blobStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Flavor = 'citron' | 'peach' | 'berry' | 'grape' | 'lychee' | 'melon'

const props = withDefaults(
  defineProps<{
    flavor?: Flavor
    /** Diameter — number is px, string is any CSS length. */
    size?: number | string
    /** Float loop offset in seconds so a cluster drifts out of sync. */
    delay?: number
    float?: boolean
  }>(),
  { flavor: 'berry', size: '18rem', delay: 0, float: true },
)

const blobStyle = computed(() => {
  const dim = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    width: dim,
    height: dim,
    backgroundImage: `radial-gradient(circle at 32% 28%, var(--flavor-${props.flavor}), var(--flavor-${props.flavor}-soft) 72%)`,
    animationDelay: `${props.delay}s`,
    animationName: props.float ? 'blob-float' : 'none',
  }
})
</script>

<style scoped>
.app-blob {
  display: block;
  pointer-events: none;
  border-radius: var(--radius-blob);
  filter: blur(2px);
  animation-duration: 12s;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  will-change: transform;
}
</style>
