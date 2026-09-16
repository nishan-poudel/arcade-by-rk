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
      <div class="mx-auto grid max-w-[16rem] grid-cols-3 gap-2">
        <GhotchuCard
          v-for="(card, i) in myHand"
          :key="`${card.suit}${card.rank}`"
          :card="card"
          :trigger="hasSeen"
          :delay-ms="i * 900"
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
import GhotchuCard from './GhotchuCard.vue'
import PlayerRow from './PlayerRow.vue'

const t = en.faras
const faras = useFaras()
const state = computed(() => faras.state.value)
const isMyTurn = computed(() => faras.isMyTurn.value)

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
