<template>
  <div v-if="state && state.lastResult" class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <div class="text-center">
      <h2 class="font-display text-2xl font-bold">{{ t.handResult.title }}</h2>
      <p class="mt-2 animate-pop-in font-display text-lg font-bold text-primary">{{ announceLine }}</p>
      <p v-if="flourishLine" class="text-sm text-muted-foreground">{{ flourishLine }}</p>
    </div>

    <CardPanel v-if="revealedEntries.length">
      <CardContent class="flex flex-col gap-4 pt-4">
        <div v-for="entry in revealedEntries" :key="entry.playerId" class="flex flex-col gap-1.5">
          <p class="font-display text-sm font-semibold" :class="isWinner(entry.playerId) ? 'text-primary' : 'text-muted-foreground'">
            {{ playerName(entry.playerId) }}<span v-if="isWinner(entry.playerId)"> 🏆</span>
          </p>
          <div class="grid max-w-[15rem] grid-cols-3 gap-2">
            <PlayingCard v-for="card in entry.cards" :key="`${card.suit}${card.rank}`" :card="card" />
          </div>
        </div>
      </CardContent>
    </CardPanel>

    <div class="flex flex-col gap-2">
      <Button v-if="faras.isHost.value" size="lg" @click="faras.nextHand()">
        {{ isLastHand ? t.handResult.seeFinalButton : t.handResult.nextHandButton }}
      </Button>
      <p v-else class="text-center text-sm text-muted-foreground">{{ t.handResult.onlyHostCanContinue }}</p>
      <Button v-if="faras.isHost.value" size="lg" variant="ghost" @click="faras.endSession()">
        {{ t.handResult.endSessionButton }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { rankFarasHand, type Card } from '@callbreak/shared-logic'
import { Button } from '@/components/ui/button'
import { Card as CardPanel, CardContent } from '@/components/ui/card'
import PlayingCard from '@/components/cards/PlayingCard.vue'
import { rankLabel } from '@/components/cards/suitPaths'
import { en } from '@/locales/en'
import { useFaras } from '../composables/useFaras'
import type { FarasCategory } from '../types'

const t = en.faras
const faras = useFaras()
const state = computed(() => faras.state.value)

const PLURAL_RANK: Record<number, string> = {
  2: 'Twos',
  3: 'Threes',
  4: 'Fours',
  5: 'Fives',
  6: 'Sixes',
  7: 'Sevens',
  8: 'Eights',
  9: 'Nines',
  10: 'Tens',
  11: 'Jacks',
  12: 'Queens',
  13: 'Kings',
  14: 'Aces',
}

function playerName(playerId: string): string {
  return state.value?.players.find((p) => p.id === playerId)?.name ?? ''
}
function isWinner(playerId: string): boolean {
  return state.value?.lastResult?.winnerIds.includes(playerId) ?? false
}

const revealedEntries = computed(() => {
  const revealed = state.value?.lastResult?.revealedHands ?? {}
  return Object.entries(revealed).map(([playerId, cards]) => ({ playerId, cards: cards as Card[] }))
})

const announceLine = computed(() => {
  const result = state.value?.lastResult
  if (!result) return ''
  if (state.value?.mode === 'betting' && result.potWon !== undefined) {
    if (result.winnerIds.length > 1) return t.handResult.tiePotAnnounce(result.potWon)
    return t.handResult.wonPotAnnounce(playerName(result.winnerIds[0]), result.potWon)
  }
  if (result.winnerIds.length > 1) return t.handResult.tieAnnounce
  return t.handResult.winnerAnnounce(playerName(result.winnerIds[0]))
})

// Client-side mirror of the server's "one chip-holder left" end condition —
// only changes which button label shows; the server is still the one that
// actually decides on the next_hand click.
const isLastHand = computed(() => {
  if (state.value?.mode !== 'betting') return false
  const withChips = state.value?.players.filter((p) => p.chips > 0).length ?? 0
  return withChips < 2
})

function flourishFor(category: FarasCategory, cards: Card[]): string {
  const label = t.common.categoryLabel[category]
  const rank = rankFarasHand(cards as [Card, Card, Card])
  if (category === 'trail' || category === 'pair') {
    return `${label} of ${PLURAL_RANK[rank.ranks[0]] ?? rank.ranks[0]}${category === 'trail' ? '!' : ''}`
  }
  if (category === 'pureSequence' || category === 'sequence') {
    return rank.ranks[0] === 15 ? `${label}: Ace-2-3!` : `${label}, ${rankLabel(rank.ranks[0])} high`
  }
  return `${label}, ${rankLabel(rank.ranks[0])} high`
}

const flourishLine = computed(() => {
  const result = state.value?.lastResult
  if (!result) return ''
  if (result.category === null) return t.handResult.foldOutNote
  const winnerHand = result.revealedHands[result.winnerIds[0]]
  return winnerHand ? flourishFor(result.category, winnerHand) : ''
})
</script>
