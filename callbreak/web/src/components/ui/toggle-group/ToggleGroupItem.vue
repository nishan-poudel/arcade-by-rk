<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { ToggleGroupItem } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  value: string
  class?: HTMLAttributes['class']
}>()

const classes = computed(() => cn(
  'flex-1 min-h-[48px] flex items-center justify-center gap-1.5 rounded-2xl border border-input ' +
  'font-display font-semibold text-sm text-muted-foreground bg-secondary/40 ' +
  'transition-colors duration-200 ease-bounce ' +
  'data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground',
  props.class,
))
</script>

<template>
  <ToggleGroupItem :value="value" :class="classes">
    <slot />
  </ToggleGroupItem>
</template>
