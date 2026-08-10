<script setup lang="ts">
import { computed } from 'vue'
import { Feather, Flame, Skull } from '@lucide/vue'
import type { Difficulty } from '../types/index.js'

const props = defineProps<{ difficulty: Difficulty }>()

/** Feather (light) → Flame (heating up) → Skull (danger) mirrors rising difficulty. */
const icon = computed(() => ({ easy: Feather, medium: Flame, hard: Skull })[props.difficulty])
</script>

<template>
  <component :is="icon" class="size-4" />
</template>
