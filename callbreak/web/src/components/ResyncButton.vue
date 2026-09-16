<template>
  <button
    type="button"
    class="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/70 text-foreground/70 transition-transform active:scale-90"
    :aria-label="label"
    :title="label"
    @click="onClick"
  >
    <RefreshCw class="h-3.5 w-3.5" :class="{ 'animate-spin': spinning }" />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RefreshCw } from '@lucide/vue'

const props = defineProps<{ label: string; resync: () => void }>()

const spinning = ref(false)
function onClick() {
  props.resync()
  spinning.value = true
  setTimeout(() => (spinning.value = false), 600)
}
</script>
