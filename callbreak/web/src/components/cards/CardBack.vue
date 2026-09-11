<template>
  <div :class="cn('relative aspect-[5/7] w-full overflow-hidden rounded-lg border-2 border-border shadow-hard-sm', props.class)">
    <div class="absolute inset-0" :style="{ background: 'hsl(var(--primary))' }" />
    <div class="absolute inset-0 opacity-40" :style="stripes" />
    <div class="absolute inset-[12%] rounded-md border-2" :style="{ borderColor: 'hsl(var(--flavor-citron) / 0.8)' }" />
    <div class="flex h-full w-full items-center justify-center">
      <SuitGlyph suit="S" class="h-[26%] w-[26%]" style="color: hsl(var(--flavor-citron))" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@/lib/utils'
import SuitGlyph from './SuitGlyph.vue'

const props = defineProps<{ class?: string }>()

// Simple repeating diagonal stripe pattern in the citron accent — brandable,
// cheap to render at scale (a full hand fan + opponents' face-down hands).
const stripes = {
  backgroundImage:
    'repeating-linear-gradient(45deg, hsl(var(--flavor-citron)) 0, hsl(var(--flavor-citron)) 2px, transparent 2px, transparent 10px)',
}
</script>
