<template>
  <div v-if="state" class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <div class="text-center">
      <h2 class="font-display text-2xl font-bold">{{ t.roundEntry.title(state.round + 1) }}</h2>
      <p class="text-sm text-muted-foreground">{{ t.roundEntry.subtitle }}</p>
    </div>

    <div class="flex flex-col gap-2">
      <div
        v-for="(p, seat) in state.players"
        :key="seat"
        class="flex items-center justify-between rounded-xl border-2 px-3 py-2.5 transition-colors"
        :class="rowClass(seat)"
      >
        <span class="font-display font-semibold">{{ p?.name }}</span>

        <template v-if="state.pendingEntries[seat].locked">
          <span class="flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">
              {{ t.roundEntry.callLabel }} {{ state.pendingEntries[seat].call }} · {{ t.roundEntry.tricksLabel }}
              {{ state.pendingEntries[seat].tricksWon }}
            </span>
            <Check class="h-4 w-4 text-flavor-melon-ink" />
            <Button v-if="score.isHost.value" size="sm" variant="ghost" @click="score.unlockEntry(seat)">
              {{ t.roundEntry.unlockButton }}
            </Button>
          </span>
        </template>
        <span v-else-if="seat !== currentSeat" class="text-sm text-muted-foreground">{{ t.roundEntry.waitingTurn }}</span>
      </div>
    </div>

    <Card v-if="score.isHost.value && currentSeat !== -1">
      <CardContent class="flex flex-col gap-4 pt-4">
        <p class="text-center font-display text-sm font-semibold text-primary">
          {{ t.roundEntry.nowEntering(state.players[currentSeat]?.name ?? '') }}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <Label>{{ t.roundEntry.callLabel }}</Label>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" @click="dec('call')">−</Button>
              <span class="w-8 text-center font-display text-xl font-bold">{{ draft.call }}</span>
              <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" @click="inc('call')">+</Button>
            </div>
          </div>
          <div>
            <Label>{{ t.roundEntry.tricksLabel }}</Label>
            <div class="flex items-center gap-2">
              <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" @click="dec('tricksWon')">−</Button>
              <span class="w-8 text-center font-display text-xl font-bold">{{ draft.tricksWon }}</span>
              <Button variant="outline" size="icon" class="h-9 w-9 shrink-0" @click="inc('tricksWon')">+</Button>
            </div>
          </div>
        </div>
        <Button size="lg" @click="lockIn">{{ t.roundEntry.lockInButton }}</Button>
      </CardContent>
    </Card>

    <!-- All 4 locked but the tricks don't add up to 13 — the round hasn't
         finalized (server-side), so guide the host to unlock and fix one. -->
    <p v-else-if="allLocked && !score.isHost.value" class="text-center text-sm text-muted-foreground">
      {{ t.roundEntry.onlyHostCanSubmit }}
    </p>
    <div v-if="allLocked" class="rounded-2xl bg-destructive/10 px-4 py-3 text-center text-sm font-medium text-destructive">
      {{ t.roundEntry.tricksMismatch(tricksTotal) }}
    </div>

    <p v-if="!score.isHost.value && currentSeat !== -1" class="text-center text-sm text-muted-foreground">
      {{ t.roundEntry.onlyHostCanSubmit }}
    </p>

    <p v-if="score.errorMessage.value" class="text-center text-sm font-medium text-destructive">
      {{ score.errorMessage.value }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { Check } from '@lucide/vue'
import { MAX_CALL, MIN_CALL } from '@callbreak/shared-logic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { en } from '@/locales/en'
import { useScoreRoom } from '../composables/useScoreRoom'

const t = en.scoreKeeper
const score = useScoreRoom()
const state = computed(() => score.state.value)

const currentSeat = computed(() => state.value?.pendingEntries.findIndex((e) => !e.locked) ?? -1)
const allLocked = computed(() => currentSeat.value === -1)
const tricksTotal = computed(() => state.value?.pendingEntries.reduce((sum, e) => sum + (e.tricksWon ?? 0), 0) ?? 0)

function rowClass(seat: number): string {
  if (state.value?.pendingEntries[seat].locked) return 'border-flavor-melon/50 bg-flavor-melon/10'
  if (seat === currentSeat.value) return 'border-primary bg-primary/10 shadow-pop'
  return 'border-border bg-secondary/20'
}

const draft = reactive({ call: MIN_CALL, tricksWon: 0 })
watch(currentSeat, () => {
  draft.call = MIN_CALL
  draft.tricksWon = 0
})

function inc(field: 'call' | 'tricksWon') {
  const max = field === 'call' ? MAX_CALL : 13
  if (draft[field] < max) draft[field]++
}
function dec(field: 'call' | 'tricksWon') {
  const min = field === 'call' ? MIN_CALL : 0
  if (draft[field] > min) draft[field]--
}

function lockIn() {
  if (currentSeat.value === -1) return
  score.lockEntry(currentSeat.value, draft.call, draft.tricksWon)
}
</script>
