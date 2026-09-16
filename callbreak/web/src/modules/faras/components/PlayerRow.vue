<template>
  <div
    class="flex items-center justify-between rounded-xl border-2 px-3 py-2.5 transition-colors"
    :class="isTurn ? 'border-primary bg-primary/10 shadow-pop' : 'border-border bg-secondary/30'"
  >
    <div class="flex items-center gap-2">
      <span class="h-2 w-2 shrink-0 rounded-full" :class="player.connected ? 'bg-flavor-melon' : 'bg-muted-foreground/40'" />
      <span class="font-display font-semibold">
        {{ player.name }}
        <span v-if="isMe" class="text-muted-foreground">({{ t.common.you }})</span>
        <span v-if="player.isHost" class="ml-1 text-xs font-normal text-muted-foreground">· {{ t.common.host }}</span>
      </span>
    </div>

    <div class="flex items-center gap-2">
      <span v-if="statusLabel" class="rounded-full px-2 py-0.5 text-xs font-semibold" :class="statusClass">
        {{ statusLabel }}
      </span>
      <span class="font-display text-sm font-bold">{{ player.score }}</span>
      <Button v-if="removable" size="sm" variant="ghost" @click="$emit('remove')">{{ t.waitingRoom.removePlayer }}</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { en } from '@/locales/en'
import type { FarasHandPlayerState, FarasPublicPlayer } from '../types'

const t = en.faras

const props = defineProps<{
  player: FarasPublicPlayer
  handState?: FarasHandPlayerState | null
  isTurn?: boolean
  isMe?: boolean
  removable?: boolean
}>()

defineEmits<{ remove: [] }>()

const statusLabel = computed(() => {
  if (!props.handState) return ''
  if (props.handState.folded) return t.hand.folded
  if (props.handState.seen) return t.hand.seen
  return t.hand.blind
})

const statusClass = computed(() => {
  if (!props.handState) return ''
  if (props.handState.folded) return 'bg-destructive/15 text-destructive'
  if (props.handState.seen) return 'bg-flavor-melon/20 text-flavor-melon-ink'
  return 'bg-secondary text-muted-foreground'
})
</script>
