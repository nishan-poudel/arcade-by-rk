<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { AlertDialogAction } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = defineProps<{
  class?: HTMLAttributes['class']
  variant?: 'default' | 'destructive'
}>()
const classes = computed(() => cn(buttonVariants({ variant: props.variant ?? 'default', size: 'sm' }), 'flex-1', props.class))
</script>

<template>
  <AlertDialogAction :class="classes">
    <slot />
  </AlertDialogAction>
</template>
