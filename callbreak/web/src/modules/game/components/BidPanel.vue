<template>
  <div v-if="state" class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <div class="text-center">
      <Badge variant="secondary" class="mb-2">{{ t.bidding.dealerBadge }}: {{ dealerName }}</Badge>
      <h2 class="font-display text-2xl font-bold">{{ t.bidding.title }}</h2>
      <p class="text-sm text-muted-foreground">{{ t.bidding.subtitle }}</p>
    </div>

    <div
      class="rounded-2xl px-4 py-3 text-center font-display text-base font-bold shadow-pop transition-colors"
      :class="isMyTurn ? 'animate-pulse-slow bg-primary text-primary-foreground' : 'bg-secondary/70 text-muted-foreground'"
    >
      {{ isMyTurn ? t.bidding.yourTurn : t.bidding.waitingFor(turnPlayerName) }}
    </div>

    <div class="flex flex-wrap justify-center gap-2">
      <SeatBadge v-for="(p, seat) in state.players" :key="seat" :player="p" :seat="seat" :state="state" show-bid />
    </div>

    <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-7">
      <div v-for="card in sortedHand" :key="`${card.suit}${card.rank}`" class="w-full">
        <PlayingCard :card="card" />
      </div>
    </div>

    <Card v-if="isMyTurn">
      <CardContent class="flex flex-col items-center gap-4 pt-6">
        <div class="flex items-center gap-4">
          <Button variant="outline" size="icon" class="h-12 w-12 rounded-full text-xl" @click="dec">−</Button>
          <span class="w-16 text-center font-display text-5xl font-bold">{{ callValue }}</span>
          <Button variant="outline" size="icon" class="h-12 w-12 rounded-full text-xl" @click="inc">+</Button>
        </div>
        <Button size="lg" class="w-full" @click="submit">{{ t.bidding.callButton }}</Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MAX_CALL, MIN_CALL } from '@callbreak/shared-logic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import PlayingCard from '@/components/cards/PlayingCard.vue'
import { en } from '@/locales/en'
import { useGame } from '../composables/useGame'
import SeatBadge from './SeatBadge.vue'

const t = en.callBreak
const game = useGame()
const state = computed(() => game.state.value)
const isMyTurn = computed(() => game.isMyTurn.value)

const sortedHand = computed(() => {
  const order = { S: 0, H: 1, D: 2, C: 3 }
  return [...(state.value?.hand ?? [])].sort((a, b) => order[a.suit] - order[b.suit] || b.rank - a.rank)
})

const dealerName = computed(() => state.value?.players[state.value.dealerSeat]?.name ?? '')
const turnPlayerName = computed(() => (state.value ? (state.value.players[state.value.turnSeat]?.name ?? '') : ''))

const callValue = ref(MIN_CALL)
function inc() {
  if (callValue.value < MAX_CALL) callValue.value++
}
function dec() {
  if (callValue.value > MIN_CALL) callValue.value--
}
function submit() {
  game.submitBid(callValue.value)
  callValue.value = MIN_CALL
}
</script>
