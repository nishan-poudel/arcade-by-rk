<template>
  <!--
    Pinned accusation-vote panel (mirrors the Imposter game's VotePanel).
    Two-step: pick a name → Submit → locked (no changes after). One vote per
    round decides it.
  -->
  <div class="px-4 pt-1 shrink-0">
    <div class="w-full max-w-md mx-auto rounded-2xl border-2 border-warning/40 bg-card shadow-pop p-3">
      <div class="flex items-center justify-between mb-2.5">
        <p class="text-sm font-display font-bold text-warning">{{ locale.traitor.vote.prompt }}</p>
        <Badge variant="secondary">{{ votedCount }}/{{ activeCount }}</Badge>
      </div>

      <div
        v-if="locked"
        class="rounded-xl border-2 border-flavor-melon/50 bg-flavor-melon-soft px-3 py-3 text-center"
      >
        <p class="text-sm font-display font-bold text-flavor-melon-ink flex items-center justify-center gap-1.5">
          <Check class="size-4" />{{ locale.traitor.vote.lockedFor(lockedName) }}
        </p>
        <p class="text-[11px] text-flavor-melon-ink/70 mt-0.5">{{ locale.traitor.vote.waitingOthers }}</p>
      </div>

      <template v-else>
        <div class="grid grid-cols-2 gap-2 max-h-[38vh] overflow-y-auto scroll-area -mr-1 pr-1">
          <button
            v-for="p in votablePlayers"
            :key="p.id"
            type="button"
            class="rounded-2xl py-3 px-2 border-2 text-sm font-display font-semibold transition-all
                   duration-150 ease-bounce active:scale-95 flex items-center justify-center gap-1.5"
            :class="selection === p.id
              ? 'bg-destructive/20 border-destructive/60 text-destructive'
              : 'bg-secondary/40 border-border text-foreground/80'"
            @click="$emit('select', p.id)"
          >
            <span>{{ p.avatar }}</span>
            <span class="truncate">{{ p.name }}</span>
          </button>
        </div>
        <Button
          class="w-full mt-2.5" size="lg"
          :disabled="!selection" @click="$emit('submit')">
          <Check class="size-5" />{{ locale.traitor.vote.submit }}
        </Button>
        <p class="text-[11px] text-muted-foreground/70 text-center mt-1.5">
          {{ selection ? locale.traitor.vote.confirmHint : locale.traitor.vote.pickHint }}
        </p>
      </template>

      <button
        v-if="isHost"
        type="button"
        class="w-full mt-2 text-xs text-muted-foreground/80 hover:text-foreground/90 flex items-center justify-center gap-1.5 py-1"
        @click="$emit('force-reveal')"
      >
        <Zap class="size-3.5" />{{ locale.traitor.vote.forceVote }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, Zap } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { TraitorPublicPlayer } from '../types/index.js'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  players: TraitorPublicPlayer[]
  myId: string
  selection: string
  myVote: string
  isHost: boolean
}>()

defineEmits<{ select: [id: string]; submit: []; 'force-reveal': [] }>()

const activeCount = computed(() => props.players.length)
const votedCount = computed(() => props.players.filter((p) => p.hasVoted).length)
const votablePlayers = computed(() => props.players.filter((p) => p.id !== props.myId))
const me = computed(() => props.players.find((p) => p.id === props.myId))
const locked = computed(() => !!me.value?.hasVoted || !!props.myVote)
const lockedName = computed(() => props.players.find((p) => p.id === props.myVote)?.name ?? '')
</script>
