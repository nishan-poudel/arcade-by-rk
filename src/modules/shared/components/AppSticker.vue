<template>
  <span
    class="a-sticker app-sticker"
    :style="{ rotate: `${rotate}deg`, background: `var(--flavor-${flavor}-soft)` }"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
type Flavor = 'citron' | 'peach' | 'berry' | 'grape' | 'lychee' | 'melon'

withDefaults(
  defineProps<{
    flavor?: Flavor
    /** Tilt in degrees. */
    rotate?: number
  }>(),
  { flavor: 'citron', rotate: -3 },
)
</script>
