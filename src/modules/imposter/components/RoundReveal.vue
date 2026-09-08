<template>
  <!--
    End-of-game reveal — shown to everyone once the game is decided.
    Safe to display fully: word, decoy, imposter(s), the whole vote history and
    the final scores. The score modal pops on top of this on arrival.
  -->
  <div
    class="h-dvh flex flex-col relative overflow-hidden"
    style="padding-top: max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))"
  >
    <ConfettiBurst v-if="crewWon" />

    <!-- Scrollable body -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Result banner -->
        <div class="text-center mb-6 animate-bounce-once">
          <component
            :is="crewWon ? ShieldCheck : VenetianMask"
            class="size-14 mb-3 mx-auto"
            :class="crewWon ? 'text-flavor-melon-ink' : 'text-destructive'"
          />
          <h1 class="text-2xl mb-1">
            {{ crewWon ? locale.imposter.roundReveal.crewWinTitle : locale.imposter.roundReveal.imposterWinTitle }}
          </h1>
          <p class="text-muted-foreground text-sm">
            {{ crewWon ? locale.imposter.roundReveal.crewWinSub : locale.imposter.roundReveal.imposterWinSub }}
          </p>
        </div>

        <!-- Secret word reveal -->
        <Card
          class="text-center mb-4 animate-fade-in border-2"
          :class="crewWon ? 'bg-flavor-melon-soft border-flavor-melon/40' : 'bg-destructive/5 border-destructive/30'"
        >
          <CardContent class="pt-4">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-display font-semibold">{{ locale.imposter.roundReveal.secretWordLabel }}</p>
            <p class="text-5xl font-display font-bold tracking-tight break-words">{{ result.word }}</p>
            <p v-if="result.imposterHint" class="text-xs text-destructive/70 mt-3 flex items-center justify-center gap-1.5">
              <VenetianMask class="size-3.5" />{{ locale.imposter.roundReveal.imposterHintWas(result.imposterHint) }}
            </p>
          </CardContent>
        </Card>

        <!-- Imposters reveal -->
        <Card class="mb-4 animate-fade-in border-destructive/20 bg-destructive/5">
          <CardContent class="pt-4">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-3 font-display font-semibold">
              {{ result.imposterNames.length === 1 ? locale.imposter.roundReveal.imposterWasSingular : locale.imposter.roundReveal.imposterWasPlural }}
            </p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="(name, i) in result.imposterNames"
                :key="name"
                class="flex items-center gap-2 bg-destructive/20 border-2 border-destructive/40
                       rounded-full px-4 py-2 text-destructive font-display font-semibold text-base animate-pop-in"
                :style="{ animationDelay: `${i * 80}ms` }"
              >
                <VenetianMask class="size-4" />{{ name }}
              </span>
            </div>
          </CardContent>
        </Card>

        <!-- Vote history: round by round, ties included. Anonymous counts only —
             who voted for whom is never shown to anyone. -->
        <Card v-if="result.voteHistory.length" class="mb-4 animate-fade-in">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.imposter.roundReveal.voteHistoryHeading }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-2">
            <div
              v-for="h in result.voteHistory"
              :key="h.voteRound"
              class="rounded-2xl border-2 border-border bg-secondary/40 px-3 py-2.5"
            >
              <div class="flex items-center gap-2">
                <component
                  :is="h.ejectedName ? DoorOpen : Equal"
                  class="size-4 shrink-0"
                  :class="!h.ejectedName ? 'text-muted-foreground' : h.wasImposter ? 'text-flavor-melon-ink' : 'text-destructive'"
                />
                <span class="flex-1 text-sm font-semibold truncate">
                  {{ locale.imposter.roundReveal.voteRoundLine(h.voteRound, h.ejectedName) }}
                </span>
                <Badge
                  v-if="h.wasImposter" variant="destructive"
                  class="shrink-0">
                  {{ locale.imposter.roundReveal.wasImposterTag }}
                </Badge>
              </div>
              <p v-if="countLine(h.voteCounts)" class="text-[11px] text-muted-foreground mt-1">
                {{ countLine(h.voteCounts) }}
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Final scores -->
        <Card class="animate-fade-in">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.imposter.roundReveal.finalScoresHeading }}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li
                v-for="(row, idx) in result.scores"
                :key="row.playerId"
                :class="[
                  'py-2.5 px-3 rounded-2xl bg-secondary/40 border-2 border-border',
                  row.playerId === myId ? 'ring-1 ring-primary/50' : '',
                ]"
              >
                <div class="flex items-center gap-3">
                  <span class="text-xs text-muted-foreground/60 w-5 shrink-0">{{ idx + 1 }}</span>
                  <span class="flex-1 font-medium truncate">{{ row.name }}</span>
                  <Badge
                    v-if="row.isImposter" variant="destructive"
                    class="shrink-0">
                    <VenetianMask class="size-3" />
                  </Badge>
                  <span
                    class="text-sm font-semibold shrink-0"
                    :class="row.points > 0 ? 'text-flavor-melon-ink' : 'text-muted-foreground/50'"
                  >+{{ row.points }}</span>
                  <span class="font-extrabold text-primary text-lg shrink-0">{{ row.total }}</span>
                </div>
                <ul v-if="row.pointsBreakdown.length" class="mt-1.5 pl-8 space-y-0.5">
                  <li
                    v-for="line in row.pointsBreakdown"
                    :key="line"
                    class="text-[11px] text-muted-foreground flex items-center gap-1.5"
                  >
                    <span class="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />{{ line }}
                  </li>
                </ul>
              </li>
            </ul>
            <p class="text-[11px] text-muted-foreground/70 mt-3 text-center">
              {{ locale.imposter.roundReveal.scoreBreakdownNote }}
            </p>
          </CardContent>
        </Card>
        <AppFooter />
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="action-bar">
      <div class="w-full max-w-md mx-auto">
        <div v-if="isHost" class="space-y-2">
          <Button
            size="lg" class="w-full"
            @click="$emit('new-game')">
            <ChevronsRight class="size-4" />{{ locale.imposter.roundReveal.newGame }}
          </Button>
          <Button
            variant="destructive" class="w-full text-sm"
            size="sm" @click="$emit('end-game')">
            {{ locale.imposter.roundReveal.endGame }}
          </Button>
        </div>
        <div v-else class="text-center py-3">
          <div class="flex items-center gap-2 justify-center text-muted-foreground text-sm">
            <span class="w-2 h-2 bg-primary rounded-full animate-pulse-slow" />
            {{ locale.imposter.roundReveal.waitingForHost }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronsRight, DoorOpen, Equal, ShieldCheck, VenetianMask } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { GameResult, GameState } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import AppFooter from './AppFooter.vue'
import ConfettiBurst from './decor/ConfettiBurst.vue'

const props = defineProps<{
  result: GameResult
  gameState: GameState | null
  myId: string
  isHost: boolean
}>()

defineEmits<{
  'new-game': []
  'end-game': []
}>()

const crewWon = computed(() => props.result.outcome === 'crew')

/** "Priya 3 · Sanjay 2" — anonymous, most-voted first, zero-vote players omitted. */
function countLine(voteCounts: Record<string, number>): string {
  const nameOf = (id: string) =>
    props.gameState?.players.find((p) => p.id === id)?.name ?? '?'
  return Object.entries(voteCounts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => `${nameOf(id)} ${n}`)
    .join(' · ')
}
</script>
