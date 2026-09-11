<script setup lang="ts">
import { AlertDialogRoot } from 'reka-ui'

const props = defineProps<{ open?: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
</script>

<template>
  <AlertDialogRoot :open="props.open" @update:open="(v) => emit('update:open', v)">
    <slot />
  </AlertDialogRoot>
</template>
