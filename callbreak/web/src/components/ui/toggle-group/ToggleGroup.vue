<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { ToggleGroupRoot } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{
  modelValue?: string
  class?: HTMLAttributes['class']
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const classes = computed(() => cn('flex gap-2', props.class))
</script>

<template>
  <ToggleGroupRoot
    type="single"
    :model-value="modelValue"
    :class="classes"
    @update:model-value="(v) => { if (v) emit('update:modelValue', v as string) }"
  >
    <slot />
  </ToggleGroupRoot>
</template>
