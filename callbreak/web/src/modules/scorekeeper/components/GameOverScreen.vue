<template>
  <EditRoundsScreen v-if="state && showEditHistory" @close="showEditHistory = false" />
  <div v-else-if="state" class="relative mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <ConfettiBurst />

    <div class="text-center">
      <p class="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{{ t.gameOver.title }}</p>
      <h2 class="mt-1 font-display text-3xl font-bold text-primary">🏆 {{ t.gameOver.winner(winnerName) }}</h2>
      <p v-if="state.instantWinSeat !== null" class="mt-1 text-sm font-semibold text-flavor-melon-ink">
        {{ t.gameOver.instantWinNote }}
      </p>
      <p v-else-if="state.dhoosEnd" class="mt-1 text-sm font-semibold text-destructive">
        {{ t.gameOver.dhoosEndNote }}
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle class="text-base">{{ t.gameOver.finalStandings }}</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 pt-0">
        <TransitionGroup name="rank" tag="div" class="flex flex-col gap-2">
          <div
            v-for="(row, i) in ranked"
            :key="row.seat"
            class="flex items-center justify-between rounded-xl border-2 px-3 py-2.5"
            :class="row.seat === state.winnerSeat ? 'border-primary bg-primary/10 animate-bounce-once' : 'border-border bg-secondary/30'"
          >
            <span class="flex items-center gap-2 font-display font-semibold">
              <span class="text-muted-foreground">{{ i + 1 }}.</span>
              {{ row.name }}
              <Crown v-if="row.seat === state.winnerSeat" class="h-4 w-4 text-primary" />
            </span>
            <span class="font-display text-lg font-bold">{{ formatPointsOT(row.split) }}</span>
          </div>
        </TransitionGroup>
      </CardContent>
    </Card>

    <div class="flex flex-col gap-2">
      <Button size="lg" variant="outline" @click="onSave">{{ saveLabel }}</Button>
      <Button v-if="score.isHost.value" size="lg" variant="outline" @click="showEditHistory = true">
        {{ t.gameOver.reviewScoresButton }}
      </Button>
      <RouterLink to="/score"><Button size="lg" variant="secondary" class="w-full">{{ t.gameOver.newSessionButton }}</Button></RouterLink>
      <RouterLink to="/"><Button size="lg" class="w-full">{{ t.gameOver.backToHub }}</Button></RouterLink>
    </div>

    <ShareCard v-if="state" ref="shareCardRef" :state="state" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Crown } from '@lucide/vue'
import { scoreRoundSplit, sumPointsOT } from '@callbreak/shared-logic'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfettiBurst from '@/components/decor/ConfettiBurst.vue'
import { formatPointsOT } from '@/lib/utils'
import { en } from '@/locales/en'
import { useScoreRoom } from '../composables/useScoreRoom'
import EditRoundsScreen from './EditRoundsScreen.vue'
import ShareCard from './ShareCard.vue'

const t = en.scoreKeeper
const score = useScoreRoom()
const state = computed(() => score.state.value)
const showEditHistory = ref(false)

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
const winnerName = computed(() => {
  if (!state.value?.players) return ''
  const seat = state.value.winnerSeat
  return seat !== null ? (state.value.players[seat]?.name ?? '') : ''
})

const shareCardRef = ref<InstanceType<typeof ShareCard> | null>(null)
const saveLabel = ref(t.gameOver.saveButton)

async function onSave() {
  const el = shareCardRef.value?.getEl()
  if (!el) return
  try {
    const { toBlob } = await import('html-to-image')
    const blob = await toBlob(el, { pixelRatio: 2, backgroundColor: '#faf6ef', cacheBust: true })
    if (!blob) throw new Error('no blob')
    const file = new File([blob], 'callbreak-scores.png', { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: t.common.shareTitle })
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'callbreak-scores.png'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    }
    saveLabel.value = t.common.saved
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    saveLabel.value = t.common.saveFailed
  } finally {
    setTimeout(() => (saveLabel.value = t.gameOver.saveButton), 2500)
  }
}
</script>

<style scoped>
.rank-move {
  transition: transform 0.5s cubic-bezier(0.34, 1.4, 0.5, 1);
}
</style>
