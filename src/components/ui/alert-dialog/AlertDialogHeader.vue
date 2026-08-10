<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
const classes = computed(() => cn('flex flex-col gap-1.5 text-center', props.class))
</script>

<template>
  <div :class="classes">
    <slot />
  </div>
</template>
