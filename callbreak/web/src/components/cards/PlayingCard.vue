<template>
  <div
    :class="
      cn(
        'relative aspect-[5/7] w-full select-none rounded-lg border-2 border-border bg-card shadow-hard-sm [container-type:inline-size]',
        interactive && 'cursor-pointer transition-transform duration-200 ease-bounce hover:-translate-y-1',
        disabled && 'cursor-not-allowed opacity-40 grayscale',
        props.class,
      )
    "
    :style="{ color: textColor }"
  >
    <!-- Corner label sizes use container-query units (cqw) so a single
         markup works for a small fanned-hand card and a larger trick card
         alike, with no ambient-font-size dependency. -->
    <div class="absolute left-[6%] top-[4%] flex flex-col items-center leading-none">
      <span class="font-display text-[15cqw] font-bold">{{ label }}</span>
      <SuitGlyph :suit="card.suit" class="h-[9cqw] w-[9cqw]" />
    </div>

    <!-- Number cards (2-10) show one pip per rank in the real-deck layout;
         face cards and the Ace keep a single big center glyph. -->
    <div v-if="pips" class="absolute inset-0">
      <SuitGlyph
        v-for="(pip, i) in pips"
        :key="i"
        :suit="card.suit"
        class="absolute h-[13cqw] w-[13cqw]"
        :style="{ left: `${pip.x}%`, top: `${pip.y}%`, transform: `translate(-50%, -50%) rotate(${pip.rotate ? 180 : 0}deg)` }"
      />
    </div>
    <div v-else class="flex h-full w-full items-center justify-center">
      <SuitGlyph :suit="card.suit" class="h-[38%] w-[38%] opacity-90" />
    </div>

    <div class="absolute bottom-[4%] right-[6%] flex rotate-180 flex-col items-center leading-none">
      <span class="font-display text-[15cqw] font-bold">{{ label }}</span>
      <SuitGlyph :suit="card.suit" class="h-[9cqw] w-[9cqw]" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '@callbreak/shared-logic'
import { cn } from '@/lib/utils'
import SuitGlyph from './SuitGlyph.vue'
import { PIP_LAYOUTS } from './pipLayout'
import { isRedSuit, rankLabel } from './suitPaths'

const props = defineProps<{
  card: Card
  class?: string
  interactive?: boolean
  disabled?: boolean
}>()

const label = computed(() => rankLabel(props.card.rank))
const textColor = computed(() => (isRedSuit(props.card.suit) ? 'hsl(var(--flavor-berry))' : 'hsl(var(--foreground))'))
const pips = computed(() => PIP_LAYOUTS[props.card.rank] ?? null)
</script>
