<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { ProgressRoot, ProgressIndicator } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: number
  class?: HTMLAttributes['class']
  indicatorClass?: HTMLAttributes['class']
}>()

const classes = computed(() => cn(
  'relative h-2 w-full overflow-hidden rounded-full bg-secondary',
  props.class,
))
const indicatorClasses = computed(() => cn(
  'h-full w-full flex-1 bg-primary transition-transform duration-500 ease-out',
  props.indicatorClass,
))
</script>

<template>
  <ProgressRoot :model-value="modelValue" :class="classes">
    <ProgressIndicator
      :class="indicatorClasses"
      :style="{ transform: `translateX(-${100 - (modelValue ?? 0)}%)` }"
    />
  </ProgressRoot>
</template>
