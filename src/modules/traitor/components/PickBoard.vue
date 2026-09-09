<template>
  <!--
    The revealed "who picked whom" board — shown from the discussion phase
    onward. Each row: a player and the player they picked as their answer.
    Optionally highlights the Traitor (result screen only).
  -->
  <ul class="space-y-2">
    <li
      v-for="p in players"
      :key="p.id"
      class="flex items-center gap-2 py-2.5 px-3 rounded-2xl border-2 bg-secondary/40"
      :class="revealTraitorId && p.id === revealTraitorId
        ? 'border-destructive/60 bg-destructive/10'
        : 'border-border'"
    >
      <span class="text-lg shrink-0">{{ p.avatar }}</span>
      <span class="font-semibold truncate max-w-[38%]" :class="{ 'text-muted-foreground/50': !p.connected }">
        {{ p.name }}
        <span v-if="revealTraitorId && p.id === revealTraitorId" class="text-[10px] uppercase tracking-wider text-destructive font-bold ml-1">
          {{ locale.traitor.answer.traitorLabel }}
        </span>
      </span>
      <ArrowRight class="size-3.5 text-muted-foreground/50 shrink-0" />
      <span class="flex-1 text-sm truncate text-right">
        <template v-if="pickedName(p.id)">
          <span class="text-base mr-1">{{ pickedAvatar(p.id) }}</span>{{ pickedName(p.id) }}
        </template>
        <span v-else class="text-muted-foreground/50 italic">{{ locale.traitor.discussion.pickedNobody }}</span>
      </span>
      <span
        v-if="voteCounts && (voteCounts[p.id] ?? 0) > 0"
        class="shrink-0 text-[11px] font-semibold text-warning inline-flex items-center gap-0.5"
      >
        <Vote class="size-3" />{{ voteCounts[p.id] }}
      </span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { ArrowRight, Vote } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { TraitorPublicPlayer } from '../types/index.js'

const props = defineProps<{
  players: TraitorPublicPlayer[]
  /** playerId → the playerId they picked */
  picks: Record<string, string>
  /** result screen only: highlight this player as the Traitor */
  revealTraitorId?: string
  /** result screen only: playerId → accusation votes received */
  voteCounts?: Record<string, number>
}>()

function playerById(id: string | undefined) {
  return id ? props.players.find((p) => p.id === id) : undefined
}
function pickedName(id: string): string {
  return playerById(props.picks[id])?.name ?? ''
}
function pickedAvatar(id: string): string {
  return playerById(props.picks[id])?.avatar ?? ''
}
</script>
