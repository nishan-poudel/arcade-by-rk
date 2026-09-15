<template>
  <div v-if="state && lastRound" class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <h2 class="text-center font-display text-2xl font-bold">{{ t.roundResult.title(lastRound.round) }}</h2>

    <div
      v-if="state.instantWinSeat !== null"
      class="animate-pop-in rounded-2xl bg-primary px-4 py-3 text-center font-display text-sm font-bold text-primary-foreground shadow-pop"
    >
      {{ t.roundResult.instantWin(state.players[state.instantWinSeat]?.name ?? '') }}
    </div>
    <div
      v-else-if="state.dhoosEnd"
      class="animate-pop-in rounded-2xl bg-destructive px-4 py-3 text-center font-display text-sm font-bold text-destructive-foreground shadow-pop"
    >
      {{ t.roundResult.dhoosEnd }}
    </div>

    <Card>
      <CardContent class="flex flex-col gap-2 pt-4">
        <div
          v-for="(p, seat) in state.players"
          :key="seat"
          class="flex items-center justify-between rounded-xl border-2 border-border bg-secondary/30 px-3 py-2.5"
        >
          <div>
            <p class="font-display font-semibold">{{ p?.name }}</p>
            <p class="text-xs text-muted-foreground">
              {{ t.trickPlay.call }} {{ lastRound.bids[seat] }} · {{ t.trickPlay.tricksWon }} {{ lastRound.tricksWon[seat] }}
              ·
              <span :class="lastRound.points[seat] >= (lastRound.bids[seat] ?? 0) ? 'text-flavor-melon-ink' : 'text-destructive'">
                {{ outcomeLabel(seat) }}
              </span>
            </p>
          </div>
          <div class="text-right">
            <p class="font-display text-lg font-bold" :class="lastRound.points[seat] >= 0 ? 'text-flavor-melon-ink' : 'text-destructive'">
              {{ formatPointsOT(roundSplit(seat)) }}
            </p>
            <p class="text-xs text-muted-foreground">{{ formatPointsOT(totalSplit(seat)) }} total</p>
          </div>
        </div>
      </CardContent>
    </Card>

    <Button v-if="game.isHost.value" size="lg" @click="game.nextRound()">
      {{ isLastRound ? t.roundResult.viewGameOverButton : t.roundResult.nextRoundButton }}
    </Button>
    <p v-else class="text-center text-sm text-muted-foreground">{{ t.roundResult.onlyHostCanContinue }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { scoreRoundSplit, sumPointsOT, type PointsOT } from '@callbreak/shared-logic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatPointsOT } from '@/lib/utils'
import { en } from '@/locales/en'
import { useGame } from '../composables/useGame'

const t = en.callBreak
const game = useGame()
const state = computed(() => game.state.value)
const lastRound = computed(() => state.value?.roundHistory[state.value.roundHistory.length - 1] ?? null)
const isLastRound = computed(() =>
  state.value
    ? state.value.instantWinSeat !== null || state.value.dhoosEnd || state.value.round >= state.value.roundCount
    : false,
)

function outcomeLabel(seat: number): string {
  if (!lastRound.value) return ''
  const bid = lastRound.value.bids[seat] ?? 0
  const won = lastRound.value.tricksWon[seat]
  if (won < bid) return t.roundResult.missed
  return won === bid ? t.roundResult.perfectCall : t.roundResult.made
}

function roundSplit(seat: number): PointsOT {
  if (!lastRound.value) return { points: 0, ot: 0 }
  return scoreRoundSplit(lastRound.value.bids[seat] ?? 0, lastRound.value.tricksWon[seat])
}

function totalSplit(seat: number): PointsOT {
  if (!state.value) return { points: 0, ot: 0 }
  return sumPointsOT(state.value.roundHistory.map((r) => scoreRoundSplit(r.bids[seat] ?? 0, r.tricksWon[seat])))
}
</script>
