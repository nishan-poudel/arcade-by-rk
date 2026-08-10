<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
const classes = computed(() => cn(
  'rounded-2xl border border-border bg-card/60 text-card-foreground shadow-sm backdrop-blur-sm',
  props.class,
))
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
