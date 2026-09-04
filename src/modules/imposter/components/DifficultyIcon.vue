<script setup lang="ts">
import { computed } from 'vue'
import { Feather, Flame, Skull } from '@lucide/vue'
import type { Difficulty } from '../types/index.js'

const props = defineProps<{ difficulty: Difficulty }>()

/** Feather (light) → Flame (heating up) → Skull (danger) mirrors rising difficulty. */
const icon = computed(() => ({ easy: Feather, medium: Flame, hard: Skull })[props.difficulty])

/** Each difficulty gets a fixed flavor hue so it reads at a glance, independent of selection state. */
const flavorClass = computed(() => ({
  easy: 'text-flavor-melon',
  medium: 'text-flavor-peach',
  hard: 'text-flavor-berry',
})[props.difficulty])
</script>

<template>
  <component
    :is="icon" class="size-4"
    :class="flavorClass" />
</template>
