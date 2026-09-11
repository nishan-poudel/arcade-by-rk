<template>
  <div v-if="state" class="relative mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <ConfettiBurst />

    <div class="text-center">
      <p class="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">{{ t.gameOver.title }}</p>
      <h2 class="mt-1 font-display text-3xl font-bold text-primary">🏆 {{ t.gameOver.winner(winnerName) }}</h2>
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
            :class="i === 0 ? 'border-primary bg-primary/10 animate-bounce-once' : 'border-border bg-secondary/30'"
          >
            <span class="flex items-center gap-2 font-display font-semibold">
              <span class="text-muted-foreground">{{ i + 1 }}.</span>
              {{ row.name }}
              <Crown v-if="i === 0" class="h-4 w-4 text-primary" />
            </span>
            <span class="font-display text-lg font-bold">{{ row.total }}</span>
          </div>
        </TransitionGroup>
      </CardContent>
    </Card>

    <div class="flex flex-col gap-2">
      <Button size="lg" variant="outline" @click="onSave">{{ saveLabel }}</Button>
      <RouterLink to="/"><Button size="lg" class="w-full">{{ t.gameOver.backToHub }}</Button></RouterLink>
    </div>

    <ShareCard v-if="state" ref="shareCardRef" :state="state" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Crown } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfettiBurst from '@/components/decor/ConfettiBurst.vue'
import { en } from '@/locales/en'
import { useGame } from '../composables/useGame'
import ShareCard from './ShareCard.vue'

const t = en.callBreak
const game = useGame()
const state = computed(() => game.state.value)

const ranked = computed(() => {
  if (!state.value) return []
  return state.value.players
    .map((p, seat) => (p ? { seat, name: p.name, total: state.value!.totals[seat] } : null))
    .filter((r): r is { seat: number; name: string; total: number } => r !== null)
    .sort((a, b) => b.total - a.total)
})
const winnerName = computed(() => ranked.value[0]?.name ?? '')

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
