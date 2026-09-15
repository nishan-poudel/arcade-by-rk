<template>
  <div
    :class="
      cn(
        'aspect-[0.691] w-full select-none overflow-hidden rounded-lg shadow-hard-sm',
        interactive && 'cursor-pointer transition-transform duration-200 ease-bounce hover:-translate-y-1',
        disabled && 'cursor-not-allowed opacity-40 grayscale',
        props.class,
      )
    "
  >
    <svg :viewBox="CARD_VIEWBOX" class="h-full w-full">
      <use :href="href" />
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
