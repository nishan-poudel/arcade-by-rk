<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
  modelValue?: string | number
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const classes = computed(() => cn(
  'flex w-full min-h-[48px] rounded-2xl border-2 border-input bg-secondary/50 px-4 py-3 text-base ' +
  'text-foreground placeholder:text-muted-foreground transition-all ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-transparent ' +
  'disabled:cursor-not-allowed disabled:opacity-50',
  props.class,
))
</script>

<template>
  <input
    :value="modelValue"
    :class="classes"
    style="font-size: 16px"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  >
</template>
