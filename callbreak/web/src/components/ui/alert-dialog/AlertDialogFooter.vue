<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
const classes = computed(() => cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', props.class))
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
