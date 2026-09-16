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
            :key="row.id"
            class="flex items-center justify-between rounded-xl border-2 px-3 py-2.5"
            :class="i === 0 ? 'border-primary bg-primary/10 animate-bounce-once' : 'border-border bg-secondary/30'"
          >
            <span class="flex items-center gap-2 font-display font-semibold">
              <span class="text-muted-foreground">{{ i + 1 }}.</span>
              {{ row.name }}
              <Crown v-if="i === 0" class="h-4 w-4 text-primary" />
            </span>
            <span class="font-display text-lg font-bold">{{ state?.mode === 'betting' ? `$${row.chips}` : row.score }}</span>
          </div>
        </TransitionGroup>
      </CardContent>
    </Card>

    <RouterLink to="/"><Button size="lg" class="w-full">{{ t.gameOver.backToHub }}</Button></RouterLink>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { Crown } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfettiBurst from '@/components/decor/ConfettiBurst.vue'
import { en } from '@/locales/en'
import { useFaras } from '../composables/useFaras'

const t = en.faras
const faras = useFaras()
const state = computed(() => faras.state.value)

const ranked = computed(() => {
  if (!state.value) return []
  const key = state.value.mode === 'betting' ? 'chips' : 'score'
  return [...state.value.players].sort((a, b) => b[key] - a[key])
})
const winnerName = computed(() => ranked.value[0]?.name ?? '')
</script>

<style scoped>
.rank-move {
  transition: transform 0.5s cubic-bezier(0.34, 1.4, 0.5, 1);
}
</style>
