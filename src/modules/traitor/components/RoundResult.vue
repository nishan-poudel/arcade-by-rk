<template>
  <div class="h-dvh flex flex-col relative overflow-hidden" style="padding-top: max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))">
    <ConfettiBurst v-if="detectivesWon" />

    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Result banner -->
        <div class="text-center mb-5 animate-bounce-once">
          <component
            :is="detectivesWon ? ShieldCheck : Drama"
            class="size-14 mb-3 mx-auto"
            :class="detectivesWon ? 'text-flavor-melon-ink' : 'text-destructive'"
          />
          <h1 class="text-2xl mb-1">
            {{ detectivesWon ? locale.traitor.result.detectivesWinTitle : locale.traitor.result.traitorWinTitle }}
          </h1>
          <p class="text-muted-foreground text-sm">
            {{ detectivesWon ? locale.traitor.result.detectivesWinSub : locale.traitor.result.traitorWinSub }}
          </p>
          <p class="text-muted-foreground/70 text-xs mt-1">
            {{ locale.traitor.result.roundLabel(result.round, result.totalRounds) }}
          </p>
        </div>

        <!-- Traitor reveal -->
        <Card class="mb-4 animate-fade-in border-destructive/20 bg-destructive/5">
          <CardContent class="pt-4 text-center">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-display font-semibold">
              {{ locale.traitor.result.theTraitorWas }}
            </p>
            <span class="inline-flex items-center gap-2 bg-destructive/20 border-2 border-destructive/40 rounded-full px-4 py-2 text-destructive font-display font-semibold text-lg">
              <span class="text-xl">{{ traitorAvatar }}</span>{{ result.traitorName }}
            </span>
          </CardContent>
        </Card>

        <!-- Both questions -->
        <Card class="mb-4 animate-fade-in">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.traitor.result.questionsHeading }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div class="rounded-2xl border-2 border-flavor-melon/40 bg-flavor-melon-soft px-3 py-2.5">
              <p class="text-[11px] uppercase tracking-wider text-flavor-melon-ink/70 font-semibold mb-0.5">
                {{ locale.traitor.result.detectiveQLabel }}
              </p>
              <p class="text-sm font-medium text-flavor-melon-ink">{{ result.detectivePrompt }}</p>
            </div>
            <div class="rounded-2xl border-2 border-destructive/40 bg-destructive/10 px-3 py-2.5">
              <p class="text-[11px] uppercase tracking-wider text-destructive/70 font-semibold mb-0.5">
                {{ locale.traitor.result.traitorQLabel }}
              </p>
              <p class="text-sm font-medium text-destructive">{{ result.traitorPrompt }}</p>
            </div>
          </CardContent>
        </Card>

        <!-- Pick board with votes -->
        <Card class="mb-4 animate-fade-in">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.traitor.result.boardHeading }}</CardTitle>
          </CardHeader>
          <CardContent>
            <PickBoard
              :players="gameState?.players ?? []"
              :picks="result.picks"
              :reveal-traitor-id="result.traitorId"
              :vote-counts="result.voteCounts"
            />
          </CardContent>
        </Card>

        <!-- Scores -->
        <Card class="animate-fade-in">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.traitor.result.scoresHeading }}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li
                v-for="(row, idx) in result.scores"
                :key="row.playerId"
                class="py-2.5 px-3 rounded-2xl bg-secondary/40 border-2 border-border"
                :class="{ 'ring-1 ring-primary/50': row.playerId === myId }"
              >
                <div class="flex items-center gap-3">
                  <span class="text-xs text-muted-foreground/60 w-5 shrink-0">{{ idx + 1 }}</span>
                  <span class="flex-1 font-medium truncate">{{ row.name }}</span>
                  <Badge
                    v-if="row.wasTraitor" variant="destructive"
                    class="shrink-0">
                    <Drama class="size-3" />
                  </Badge>
                  <span class="text-sm font-semibold shrink-0" :class="row.points > 0 ? 'text-flavor-melon-ink' : 'text-muted-foreground/50'">
                    +{{ row.points }}
                  </span>
                  <span class="font-extrabold text-primary text-lg shrink-0">{{ row.total }}</span>
                </div>
                <ul v-if="row.pointsBreakdown.length" class="mt-1.5 pl-8 space-y-0.5">
                  <li
                    v-for="line in row.pointsBreakdown" :key="line"
                    class="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span class="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />{{ line }}
                  </li>
                </ul>
              </li>
            </ul>
            <p class="text-[11px] text-muted-foreground/70 mt-3 text-center">{{ locale.traitor.result.scoreNote }}</p>
          </CardContent>
        </Card>

        <AppFooter />
      </div>
    </div>

    <div class="action-bar">
      <div class="w-full max-w-md mx-auto">
        <div v-if="isHost" class="space-y-2">
          <Button
            size="lg" class="w-full"
            @click="onPrimary">
            <component :is="result.sessionOver ? Trophy : ChevronsRight" class="size-4" />
            {{ result.sessionOver ? locale.traitor.result.seeScores : locale.traitor.result.nextRound }}
          </Button>
          <Button
            v-if="!result.sessionOver" variant="destructive"
            size="sm" class="w-full text-sm"
            @click="$emit('end-game')">
            {{ locale.traitor.result.endSession }}
          </Button>
        </div>
        <div v-else class="text-center py-3">
          <div class="flex items-center gap-2 justify-center text-muted-foreground text-sm">
            <span class="w-2 h-2 bg-primary rounded-full animate-pulse-slow" />
            {{ locale.traitor.result.waitingForHost }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronsRight, Drama, ShieldCheck, Trophy } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { TraitorGameState, TraitorRoundResult } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import AppFooter from './AppFooter.vue'
import PickBoard from './PickBoard.vue'
import ConfettiBurst from './decor/ConfettiBurst.vue'

const props = defineProps<{
  result: TraitorRoundResult
  gameState: TraitorGameState | null
  myId: string
  isHost: boolean
}>()

const emit = defineEmits<{ 'next-round': []; 'end-game': [] }>()

function onPrimary() {
  if (props.result.sessionOver) {emit('end-game')}
  else {emit('next-round')}
}

const detectivesWon = computed(() => props.result.outcome === 'detectives')
const traitorAvatar = computed(
  () => props.gameState?.players.find((p) => p.id === props.result.traitorId)?.avatar ?? '🎭',
)
</script>
