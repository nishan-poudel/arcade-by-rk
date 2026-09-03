<template>
  <div
    class="app-wave"
    :class="position === 'top' ? 'app-wave--top' : 'app-wave--bottom'"
    aria-hidden="true"
    :style="{ height: `${height}px` }"
  >
    <svg
      viewBox="0 0 1440 120"
      preserveAspectRatio="none"
      :style="{ fill: fillColor, transform: flip ? 'scaleX(-1)' : undefined }"
    >
      <path :d="path" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Flavor = 'citron' | 'peach' | 'berry' | 'grape' | 'lychee' | 'melon'
type Variant = 'roll' | 'bump' | 'drip'

const props = withDefaults(
  defineProps<{
    flavor?: Flavor
    shade?: 'base' | 'soft'
    /** Escape hatch for a non-flavor fill, e.g. 'var(--canvas)'. */
    color?: string
    position?: 'top' | 'bottom'
    variant?: Variant
    flip?: boolean
    height?: number
  }>(),
  {
    flavor: 'berry',
    shade: 'base',
    color: undefined,
    position: 'bottom',
    variant: 'roll',
    flip: false,
    height: 60,
  },
)

const PATHS: Record<Variant, string> = {
  roll: 'M0,64 C240,120 480,8 720,48 C960,88 1200,28 1440,72 L1440,120 L0,120 Z',
  bump: 'M0,104 C360,20 1080,20 1440,104 L1440,120 L0,120 Z',
  drip: 'M0,44 C120,44 120,96 240,96 C360,96 360,44 480,44 C600,44 600,96 720,96 C840,96 840,44 960,44 C1080,44 1080,96 1200,96 C1320,96 1320,44 1440,44 L1440,120 L0,120 Z',
}

const path = computed(() => PATHS[props.variant])
const fillColor = computed(
  () => props.color ?? `var(--flavor-${props.flavor}${props.shade === 'soft' ? '-soft' : ''})`,
)
</script>

<style scoped>
.app-wave {
  position: absolute;
  inset-inline: 0;
  z-index: 2;
  overflow: hidden;
  pointer-events: none;
  line-height: 0;
}
.app-wave--bottom { bottom: 0; }
.app-wave--top { top: 0; transform: translateY(-99%); }
.app-wave svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
