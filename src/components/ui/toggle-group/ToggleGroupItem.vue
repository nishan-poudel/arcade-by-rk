<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { ToggleGroupItem } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  value: string
  class?: HTMLAttributes['class']
}>()

const classes = computed(() => cn(
  'flex-1 min-h-[48px] flex items-center justify-center gap-1.5 rounded-xl border border-input ' +
  'font-semibold text-sm text-muted-foreground bg-secondary/40 transition-all active:scale-95 ' +
  'data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground ' +
  'data-[state=on]:shadow-sm',
  props.class,
))
</script>

<template>
  <ToggleGroupItem :value="value" :class="classes">
    <slot />
  </ToggleGroupItem>
</template>
