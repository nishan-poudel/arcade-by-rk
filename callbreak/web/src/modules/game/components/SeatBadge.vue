<template>
  <div
    v-if="player"
    class="flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-display font-semibold transition-all duration-200"
    :class="isTurn ? 'border-primary bg-primary/15 text-primary shadow-pop scale-105' : 'border-border bg-secondary/40'"
  >
    <span class="h-1.5 w-1.5 rounded-full" :class="player.connected ? 'bg-flavor-melon' : 'bg-muted-foreground/40'" />
    {{ player.name }}{{ isMe ? ` (${t.common.you})` : '' }}
    <Badge v-if="bidValue !== undefined" variant="outline" class="px-1.5 py-0 text-[0.65rem]">
      {{ t.trickPlay.call }} {{ bidValue ?? '—' }}
    </Badge>
    <Badge v-if="tricksValue !== undefined" variant="secondary" class="px-1.5 py-0 text-[0.65rem]">
      {{ t.trickPlay.tricksWon }} {{ tricksValue }}
    </Badge>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { en } from '@/locales/en'
import type { GameStateView, PublicPlayer } from '../types'

const props = defineProps<{
  player: PublicPlayer | null
  seat: number
  state: GameStateView
  showBid?: boolean
  showTricks?: boolean
}>()

const t = en.callBreak
const isTurn = computed(() => props.state.turnSeat === props.seat)
const isMe = computed(() => props.state.yourSeat === props.seat)
const bidValue = computed(() => (props.showBid ? props.state.bids[props.seat] : undefined))
const tricksValue = computed(() => (props.showTricks ? props.state.tricksWon[props.seat] : undefined))
</script>
