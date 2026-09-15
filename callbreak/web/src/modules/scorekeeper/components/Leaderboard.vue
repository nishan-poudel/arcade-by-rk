<template>
  <div v-if="state && lastRound" class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <h2 class="text-center font-display text-2xl font-bold">{{ t.leaderboard.round(state.round) }}</h2>

    <div
      v-if="state.instantWinSeat !== null"
      class="animate-pop-in rounded-2xl bg-primary px-4 py-3 text-center font-display text-sm font-bold text-primary-foreground shadow-pop"
    >
      {{ t.leaderboard.instantWin(state.players[state.instantWinSeat]?.name ?? '') }}
    </div>
    <div
      v-else-if="state.dhoosEnd"
      class="animate-pop-in rounded-2xl bg-destructive px-4 py-3 text-center font-display text-sm font-bold text-destructive-foreground shadow-pop"
    >
      {{ t.leaderboard.dhoosEnd }}
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
              {{ lastRound[seat].call }} called ·
              <span :class="lastRound[seat].tricksWon >= lastRound[seat].call ? 'text-flavor-melon-ink' : 'text-destructive'">
                {{ outcomeLabel(seat) }}
              </span>
            </p>
          </div>
          <p class="font-display text-lg font-bold" :class="lastRound[seat].points >= 0 ? 'text-flavor-melon-ink' : 'text-destructive'">
            {{ formatPointsOT(scoreRoundSplit(lastRound[seat].call, lastRound[seat].tricksWon)) }}
          </p>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t.leaderboard.title }}</CardTitle>
      </CardHeader>
      <CardContent class="pt-0">
        <TransitionGroup name="rank" tag="div" class="flex flex-col gap-2">
          <div
            v-for="(row, i) in ranked"
            :key="row.seat"
            class="flex items-center justify-between rounded-xl border-2 px-3 py-2"
            :class="i === 0 ? 'border-primary bg-primary/10' : 'border-border bg-secondary/20'"
          >
            <span class="font-display font-semibold">{{ i + 1 }}. {{ row.name }}</span>
            <span class="font-display text-lg font-bold">{{ formatPointsOT(row.split) }}</span>
          </div>
        </TransitionGroup>
      </CardContent>
    </Card>

    <Button v-if="score.isHost.value" size="lg" @click="score.continueGame()">
      {{ isLastRound ? t.leaderboard.seeFinalButton : t.leaderboard.continueButton }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { scoreRoundSplit, sumPointsOT } from '@callbreak/shared-logic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPointsOT } from '@/lib/utils'
import { en } from '@/locales/en'
import { useScoreRoom } from '../composables/useScoreRoom'

const t = en.scoreKeeper
const score = useScoreRoom()
const state = computed(() => score.state.value)
const lastRound = computed(() => state.value?.history[state.value.history.length - 1] ?? null)
const isLastRound = computed(() =>
  state.value
    ? state.value.instantWinSeat !== null || state.value.dhoosEnd || state.value.round >= state.value.roundCount
    : false,
)

const ranked = computed(() => {
  if (!state.value) return []
  const s = state.value
  return s.players
    .map((p, seat) =>
      p
        ? {
            seat,
            name: p.name,
            total: s.totals[seat],
            split: sumPointsOT(s.history.map((round) => scoreRoundSplit(round[seat].call, round[seat].tricksWon))),
          }
        : null,
    )
    .filter((r): r is { seat: number; name: string; total: number; split: { points: number; ot: number } } => r !== null)
    .sort((a, b) => b.total - a.total)
})

function outcomeLabel(seat: number): string {
  if (!lastRound.value) return ''
  const { call, tricksWon } = lastRound.value[seat]
  if (tricksWon < call) return t.leaderboard.missed
  return tricksWon === call ? t.leaderboard.perfectCall : t.leaderboard.made
}
</script>

<style scoped>
.rank-move {
  transition: transform 0.5s cubic-bezier(0.34, 1.4, 0.5, 1);
}
</style>
