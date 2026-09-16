<template>
  <div v-if="state" class="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 animate-slide-up">
    <div
      class="rounded-2xl px-4 py-3 text-center font-display text-base font-bold shadow-pop transition-colors"
      :class="isMyTurn ? 'animate-pulse-slow bg-primary text-primary-foreground' : 'bg-secondary/70 text-muted-foreground'"
    >
      {{ isMyTurn ? t.hand.yourTurn : t.hand.waitingFor(turnPlayerName) }}
    </div>

    <div class="flex flex-col gap-2">
      <PlayerRow
        v-for="p in state.players"
        :key="p.id"
        :player="p"
        :hand-state="state.handState[p.id]"
        :is-turn="p.id === state.turnPlayerId"
        :is-me="p.id === state.yourPlayerId"
      />
    </div>

    <div>
      <p class="mb-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {{ t.hand.yourHandLabel }}
      </p>
      <!-- Stacked like a real hand: all three tucked behind the front card
           until Ghotchu is tapped, then each slides out and peels open in
           turn, left to right. -->
      <div class="relative mx-auto" :style="{ width: `${handWidthRem}rem`, height: `${cardHeightRem}rem` }">
        <GhotchuCard
          v-for="(card, i) in myHand"
          :key="`${card.suit}${card.rank}`"
          :card="card"
          :trigger="hasSeen"
          :delay-ms="i * stepMs"
          :peek-offset-rem="i * peekStepRem"
          :final-offset-rem="i * finalStepRem"
          :z-index="myHand.length - i"
          :width-rem="cardWidthRem"
          :height-rem="cardHeightRem"
        />
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <Button v-if="!hasSeen && !folded" variant="outline" size="lg" @click="faras.ghotchu()">
        {{ t.hand.ghotchuButton }}
      </Button>

      <div v-if="isMyTurn && !folded" class="grid grid-cols-2 gap-2">
        <Button variant="destructive" size="lg" @click="faras.fold()">{{ t.hand.foldButton }}</Button>
        <Button size="lg" @click="faras.stay()">{{ t.hand.stayButton }}</Button>
      </div>

      <Button v-if="canShow" variant="secondary" size="lg" @click="faras.requestShow()">{{ t.hand.showButton }}</Button>

      <Button variant="ghost" size="sm" @click="onLeave">{{ t.hand.leaveButton }}</Button>
    </div>

    <p v-if="faras.errorMessage.value" class="text-center text-sm font-medium text-destructive">
      {{ faras.errorMessage.value }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import { en } from '@/locales/en'
import { useFaras } from '../composables/useFaras'
import {
  GHOTCHU_CARD_HEIGHT_REM,
  GHOTCHU_CARD_WIDTH_REM,
  GHOTCHU_FINAL_STEP_REM,
  GHOTCHU_HAND_WIDTH_REM,
  GHOTCHU_PEEK_STEP_REM,
  GHOTCHU_STEP_MS,
} from './ghotchuTiming'
import GhotchuCard from './GhotchuCard.vue'
import PlayerRow from './PlayerRow.vue'

const t = en.faras
const faras = useFaras()
const state = computed(() => faras.state.value)
const isMyTurn = computed(() => faras.isMyTurn.value)

const cardWidthRem = GHOTCHU_CARD_WIDTH_REM
const cardHeightRem = GHOTCHU_CARD_HEIGHT_REM
const peekStepRem = GHOTCHU_PEEK_STEP_REM
const finalStepRem = GHOTCHU_FINAL_STEP_REM
const handWidthRem = GHOTCHU_HAND_WIDTH_REM
const stepMs = GHOTCHU_STEP_MS

const myHand = computed(() => state.value?.yourHand ?? [])
const folded = computed(() => faras.myHandState.value?.folded ?? false)
const hasSeen = computed(() => faras.myHandState.value?.seen ?? false)

const turnPlayerName = computed(() => state.value?.players.find((p) => p.id === state.value?.turnPlayerId)?.name ?? '')

const canShow = computed(() => {
  if (!state.value?.yourPlayerId || folded.value) return false
  const active = faras.activePlayers.value
  return active.length === 2 && active.some((p) => p.id === state.value?.yourPlayerId)
})

function onLeave() {
  if (confirm(t.hand.leaveConfirm)) faras.leaveRoom()
}
</script>
