<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { AlertDialogDescription } from 'reka-ui'
import { cn } from '@/lib/utils'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
const classes = computed(() => cn('text-sm text-muted-foreground', props.class))
</script>

<template>
  <AlertDialogDescription :class="classes">
    <slot />
  </AlertDialogDescription>
</template>
