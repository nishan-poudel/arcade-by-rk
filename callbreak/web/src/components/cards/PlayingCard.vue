<template>
  <div
    :class="
      cn(
        // No overflow-hidden/rounded-lg here — the sprite already draws its
        // own complete card shape, border, and corner rounding, right up to
        // the true edge (that's where the corner index sits). Clipping on
        // top of that with our own CSS radius double-rounds the corners and
        // can cut into that artwork depending on the renderer.
        'aspect-[0.691] w-full select-none shadow-hard-sm',
        interactive && 'cursor-pointer transition-transform duration-200 ease-bounce hover:-translate-y-1',
        disabled && 'cursor-not-allowed opacity-40 grayscale',
        props.class,
      )
    "
  >
    <svg :viewBox="CARD_VIEWBOX" preserveAspectRatio="xMidYMid meet" class="h-full w-full">
      <!-- Cross-document <use> (referencing an external .svg file, not a
           same-page symbol) is unreliable on some mobile browsers with only
           the plain `href` attribute — the legacy `xlink:href` is what
           actually makes external references resolve consistently there. -->
      <use :href="href" :xlink:href="href" />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@callbreak/shared-logic'
import { cn } from '@/lib/utils'
import { CARD_VIEWBOX, cardSpriteHref } from './cardSprite'

const props = defineProps<{
  card: Card
  class?: string
  interactive?: boolean
  disabled?: boolean
}>()

const href = computed(() => cardSpriteHref(props.card))
</script>
