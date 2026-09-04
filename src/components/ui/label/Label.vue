<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { Label as RekaLabel } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class']; for?: string }>()
const classes = computed(() => cn(
  'text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2 block',
  props.class,
))
</script>

<template>
  <RekaLabel :for="props.for" :class="classes">
    <slot />
  </RekaLabel>
</template>
