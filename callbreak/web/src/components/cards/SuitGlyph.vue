<template>
  <svg viewBox="0 0 24 24" :class="cn('inline-block', props.class)" :fill="color" aria-hidden="true">
    <template v-if="suit === 'S'">
      <path d="M12 3 L16.6 13 L7.4 13 Z" />
      <circle cx="8.4" cy="13" r="3.6" />
      <circle cx="15.6" cy="13" r="3.6" />
      <path d="M11.2 15 L12.8 15 L13.9 21 L10.1 21 Z" />
    </template>
    <template v-else-if="suit === 'H'">
      <circle cx="8.5" cy="9" r="3.8" />
      <circle cx="15.5" cy="9" r="3.8" />
      <path d="M4.8 10.5 L19.2 10.5 L12 21 Z" />
    </template>
    <template v-else-if="suit === 'D'">
      <path d="M12 2.5 L20.5 12 L12 21.5 L3.5 12 Z" />
    </template>
    <template v-else>
      <circle cx="12" cy="7.6" r="3.6" />
      <circle cx="7.7" cy="13" r="3.6" />
      <circle cx="16.3" cy="13" r="3.6" />
      <path d="M11.2 15 L12.8 15 L13.9 21 L10.1 21 Z" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Suit } from '@callbreak/shared-logic'
import { cn } from '@/lib/utils'
import { isRedSuit } from './suitPaths'

const props = defineProps<{ suit: Suit; class?: string }>()

const color = computed(() => (isRedSuit(props.suit) ? 'hsl(var(--flavor-berry))' : 'hsl(var(--foreground))'))
</script>
