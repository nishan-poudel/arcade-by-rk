<template>
  <div v-if="state" class="mx-auto flex w-full max-w-sm flex-col gap-4 animate-slide-up">
    <div class="flex items-center justify-between">
      <button type="button" class="font-display text-sm font-semibold text-muted-foreground" @click="emit('close')">
        {{ t.editHistory.back }}
      </button>
      <h2 class="font-display text-lg font-bold">{{ t.editHistory.title }}</h2>
      <span class="w-10" />
    </div>
    <p class="text-center text-xs text-muted-foreground">{{ t.editHistory.subtitle }}</p>

    <Card v-for="(round, i) in state.history" :key="i">
      <CardContent class="flex flex-col gap-3 pt-4">
        <div class="flex items-center justify-between">
          <p class="font-display font-semibold">{{ t.editHistory.round(i + 1) }}</p>
          <Button v-if="editingRound !== i + 1" size="sm" variant="outline" @click="startEdit(i + 1, round)">
            {{ t.editHistory.editButton }}
          </Button>
        </div>

        <div v-if="editingRound !== i + 1" class="flex flex-col gap-1 text-sm text-muted-foreground">
          <div v-for="(p, seat) in state.players" :key="seat" class="flex justify-between">
            <span>{{ p?.name }}</span>
            <span>{{ t.roundEntry.callLabel }} {{ round[seat].call }} · {{ t.roundEntry.tricksLabel }} {{ round[seat].tricksWon }}</span>
          </div>
        </div>

        <div v-else class="flex flex-col gap-3">
          <div v-for="(p, seat) in state.players" :key="seat" class="flex items-center justify-between gap-2">
            <span class="w-14 shrink-0 truncate font-display text-sm font-semibold">{{ p?.name }}</span>
            <div class="flex items-center gap-1">
              <Button variant="outline" size="icon" class="h-8 w-8 shrink-0" @click="decDraft(seat, 'call')">−</Button>
              <span class="w-6 text-center font-display font-bold">{{ drafts[seat].call }}</span>
              <Button variant="outline" size="icon" class="h-8 w-8 shrink-0" @click="incDraft(seat, 'call')">+</Button>
            </div>
            <div class="flex items-center gap-1">
              <Button variant="outline" size="icon" class="h-8 w-8 shrink-0" @click="decDraft(seat, 'tricksWon')">−</Button>
              <span class="w-6 text-center font-display font-bold">{{ drafts[seat].tricksWon }}</span>
              <Button variant="outline" size="icon" class="h-8 w-8 shrink-0" @click="incDraft(seat, 'tricksWon')">+</Button>
            </div>
          </div>
          <p class="text-center text-xs font-medium" :class="draftTotal === 13 ? 'text-flavor-melon-ink' : 'text-destructive'">
            {{ t.editHistory.tricksCount(draftTotal) }}
          </p>
          <div class="flex gap-2">
            <Button variant="ghost" class="flex-1" @click="editingRound = null">{{ t.editHistory.cancelButton }}</Button>
            <Button class="flex-1" :disabled="draftTotal !== 13" @click="saveEdit(i + 1)">{{ t.editHistory.saveButton }}</Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <p v-if="score.errorMessage.value" class="text-center text-sm font-medium text-destructive">
      {{ score.errorMessage.value }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { MAX_CALL, MIN_CALL } from '@callbreak/shared-logic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { en } from '@/locales/en'
import { useScoreRoom } from '../composables/useScoreRoom'
import type { RoundEntry } from '../types'

const emit = defineEmits<{ close: [] }>()

const t = en.scoreKeeper
const score = useScoreRoom()
const state = computed(() => score.state.value)

const editingRound = ref<number | null>(null)
const drafts = reactive(Array.from({ length: 4 }, () => ({ call: MIN_CALL, tricksWon: 0 })))
const draftTotal = computed(() => drafts.reduce((sum, d) => sum + d.tricksWon, 0))

function startEdit(round: number, entries: RoundEntry[]) {
  entries.forEach((e, seat) => {
    drafts[seat].call = e.call
    drafts[seat].tricksWon = e.tricksWon
  })
  editingRound.value = round
}

function incDraft(seat: number, field: 'call' | 'tricksWon') {
  const max = field === 'call' ? MAX_CALL : 13
  if (drafts[seat][field] < max) drafts[seat][field]++
}
function decDraft(seat: number, field: 'call' | 'tricksWon') {
  const min = field === 'call' ? MIN_CALL : 0
  if (drafts[seat][field] > min) drafts[seat][field]--
}

function saveEdit(round: number) {
  score.editRound(
    round,
    drafts.map((d, seat) => ({ seat, call: d.call, tricksWon: d.tricksWon })),
  )
  editingRound.value = null
}
</script>
