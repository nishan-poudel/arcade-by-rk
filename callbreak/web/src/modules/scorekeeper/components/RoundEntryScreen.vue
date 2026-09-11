<template>
  <div v-if="state" class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <div class="text-center">
      <h2 class="font-display text-2xl font-bold">{{ t.roundEntry.title(state.round + 1) }}</h2>
      <p class="text-sm text-muted-foreground">{{ t.roundEntry.subtitle }}</p>
    </div>

    <template v-if="score.isHost.value">
      <Card v-for="(p, seat) in state.players" :key="seat">
        <CardContent class="flex flex-col gap-3 pt-4">
          <p class="font-display font-semibold">{{ p?.name }}</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <Label>{{ t.roundEntry.callLabel }}</Label>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" :data-testid="`call-dec-${seat}`" @click="dec(entries[seat], 'call')">−</Button>
                <span class="w-8 text-center font-display text-xl font-bold">{{ entries[seat].call }}</span>
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" :data-testid="`call-inc-${seat}`" @click="inc(entries[seat], 'call')">+</Button>
              </div>
            </div>
            <div>
              <Label>{{ t.roundEntry.tricksLabel }}</Label>
              <div class="flex items-center gap-2">
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" :data-testid="`tricks-dec-${seat}`" @click="dec(entries[seat], 'tricksWon')">−</Button>
                <span class="w-8 text-center font-display text-xl font-bold">{{ entries[seat].tricksWon }}</span>
                <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" :data-testid="`tricks-inc-${seat}`" @click="inc(entries[seat], 'tricksWon')">+</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <p class="text-center text-sm font-medium" :class="remaining === 0 ? 'text-flavor-melon-ink' : 'text-muted-foreground'">
        {{ remaining >= 0 ? t.roundEntry.tricksRemaining(remaining) : t.roundEntry.tricksOver(remaining) }}
      </p>

      <Button size="lg" :disabled="remaining !== 0" @click="submit">{{ t.roundEntry.submitButton }}</Button>
    </template>
    <p v-else class="text-center text-sm text-muted-foreground">{{ t.roundEntry.onlyHostCanSubmit }}</p>

    <p v-if="score.errorMessage.value" class="text-center text-sm font-medium text-destructive">
      {{ score.errorMessage.value }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue'
import { MAX_CALL, MIN_CALL } from '@callbreak/shared-logic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { en } from '@/locales/en'
import { useScoreRoom } from '../composables/useScoreRoom'

const t = en.scoreKeeper
const score = useScoreRoom()
const state = computed(() => score.state.value)

const entries = reactive(
  Array.from({ length: 4 }, () => ({ call: MIN_CALL, tricksWon: 0 })),
)

const remaining = computed(() => 13 - entries.reduce((sum, e) => sum + e.tricksWon, 0))

function inc(entry: { call: number; tricksWon: number }, field: 'call' | 'tricksWon') {
  const max = field === 'call' ? MAX_CALL : 13
  if (entry[field] < max) entry[field]++
}
function dec(entry: { call: number; tricksWon: number }, field: 'call' | 'tricksWon') {
  const min = field === 'call' ? MIN_CALL : 0
  if (entry[field] > min) entry[field]--
}

function submit() {
  score.submitRound(entries.map((e, seat) => ({ seat, call: e.call, tricksWon: e.tricksWon })))
  entries.forEach((e) => {
    e.call = MIN_CALL
    e.tricksWon = 0
  })
}
</script>
