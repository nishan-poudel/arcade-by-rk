<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { Separator as RekaSeparator } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = withDefaults(defineProps<{
  class?: HTMLAttributes['class']
  orientation?: 'horizontal' | 'vertical'
}>(), {
  class: undefined,
  orientation: 'horizontal',
})

const classes = computed(() => cn(
  'shrink-0 bg-border',
  props.orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
  props.class,
))
</script>

<template>
  <RekaSeparator :orientation="orientation" :class="classes" />
</template>
