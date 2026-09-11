<script setup lang="ts">
import { type HTMLAttributes, computed } from 'vue'
import { AlertDialogCancel } from 'reka-ui'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

const props = defineProps<{ class?: HTMLAttributes['class'] }>()
const classes = computed(() => cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'flex-1', props.class))
</script>

<template>
  <AlertDialogCancel :class="classes">
    <slot />
  </AlertDialogCancel>
</template>
