<template>
  <!--
    Post-round reveal screen.
    Shown to ALL players after the host records a voting result.
    Safe to display: the round is over, no more word-guessing needed.
  -->
  <div
    class="h-dvh flex flex-col bg-background"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <!-- Scrollable body -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Result banner -->
        <div class="text-center mb-6 animate-bounce-once">
          <component
            :is="reveal.imposterCaught ? ShieldCheck : VenetianMask"
            class="size-14 mb-3 mx-auto"
            :class="reveal.imposterCaught ? 'text-primary' : 'text-destructive'"
          />
          <h1 class="text-2xl font-extrabold mb-1">
            {{ reveal.imposterCaught ? locale.imposter.roundReveal.imposterCaughtTitle : locale.imposter.roundReveal.imposterSurvivedTitle }}
          </h1>
          <p class="text-muted-foreground text-sm mb-1">
            <template v-if="reveal.ejectedPlayerName">{{ locale.imposter.roundReveal.ejected(reveal.ejectedPlayerName) }}</template>
            <template v-else>{{ locale.imposter.roundReveal.noMajority }}</template>
          </p>
          <p class="text-muted-foreground/70 text-sm">
            {{ reveal.imposterCaught ? locale.imposter.roundReveal.crewmatesScored : locale.imposter.roundReveal.impostersScored }}
          </p>
        </div>

        <!-- Secret word reveal -->
        <Card
          class="text-center mb-4 animate-fade-in"
          :class="reveal.imposterCaught ? 'bg-primary/5 border-primary/30' : 'bg-destructive/5 border-destructive/30'"
        >
          <CardContent class="pt-4">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-2">{{ locale.imposter.roundReveal.secretWordLabel }}</p>
            <p class="text-5xl font-extrabold tracking-tight">{{ reveal.word }}</p>
          </CardContent>
        </Card>

        <!-- Imposters reveal -->
        <Card class="mb-4 animate-fade-in border-destructive/20 bg-destructive/5">
          <CardContent class="pt-4">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-3">
              {{ reveal.imposterNames.length === 1 ? locale.imposter.roundReveal.imposterWasSingular : locale.imposter.roundReveal.imposterWasPlural }}
            </p>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="name in reveal.imposterNames"
                :key="name"
                class="flex items-center gap-2 bg-destructive/20 border border-destructive/40
                       rounded-full px-4 py-2 text-destructive font-semibold text-base"
              >
                <span class="text-lg"><VenetianMask class="size-4" /></span>
                {{ name }}
              </span>
            </div>
          </CardContent>
        </Card>

        <!-- Vote breakdown -->
        <Card v-if="gameState" class="mb-4 animate-fade-in">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.imposter.roundReveal.voteResultsHeading }}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2 mb-1">
              <li
                v-for="player in gameState.players"
                :key="player.id"
                class="flex items-center gap-3"
              >
                <span
                  class="flex-1 text-sm truncate"
                  :class="player.id === reveal.ejectedPlayerId ? 'text-destructive font-semibold' : 'text-foreground/80'"
                >
                  {{ player.name }}
                  <DoorOpen v-if="player.id === reveal.ejectedPlayerId" class="size-3.5 inline" />
                </span>
                <Progress
                  :model-value="votePercent(player.id)"
                  class="flex-1 max-w-[100px]"
                  indicator-class="bg-destructive"
                />
                <span class="text-xs text-muted-foreground/70 w-4 text-right">{{ reveal.voteCounts[player.id] ?? 0 }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <!-- Round scores snapshot -->
        <Card v-if="gameState" class="animate-fade-in">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.imposter.roundReveal.scoresAfterRound(reveal.round) }}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li
                v-for="(player, idx) in sortedPlayers"
                :key="player.id"
                :class="[
                  'flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/40 border border-border',
                  player.id === myId ? 'ring-1 ring-primary/50' : '',
                ]"
              >
                <span class="text-xs text-muted-foreground/60 w-5 shrink-0">{{ idx + 1 }}</span>
                <span class="flex-1 font-medium truncate">{{ player.name }}</span>
                <Badge
                  v-if="isImposterName(player.name)" variant="destructive"
                  class="shrink-0">
                  <VenetianMask class="size-3" />
                </Badge>
                <span class="font-extrabold text-primary text-lg shrink-0">{{ player.score }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        <AppFooter />
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="action-bar">
      <div class="w-full max-w-md mx-auto">
        <!-- Host: next round or end game -->
        <div v-if="isHost" class="space-y-2">
          <Button
            size="lg" class="w-full"
            @click="$emit('next-round')">
            <ChevronsRight class="size-4" />{{ locale.imposter.roundReveal.nextRound }}
          </Button>
          <Button
            variant="destructive" class="w-full text-sm"
            size="sm" @click="$emit('end-game')">
            {{ locale.imposter.roundReveal.endGame }}
          </Button>
        </div>
        <!-- Players: waiting message -->
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
import { ChevronsRight, DoorOpen, ShieldCheck, VenetianMask } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { GameReveal, GameState, PublicPlayer } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import AppFooter from './AppFooter.vue'

const props = defineProps<{
  reveal: GameReveal
  gameState: GameState | null
  myId: string
  isHost: boolean
}>()

defineEmits<{
  'next-round': []
  'end-game': []
}>()

const sortedPlayers = computed<PublicPlayer[]>(() => {
  if (!props.gameState) {return []}
  return [...props.gameState.players].sort((a, b) => b.score - a.score)
})

/** Used to badge imposters in the score list */
function isImposterName(name: string): boolean {
  return props.reveal.imposterNames.includes(name)
}

function votePercent(playerId: string): number {
  const total = Object.values(props.reveal.voteCounts).reduce((sum, n) => sum + n, 0)
  if (total === 0) {return 0}
  return Math.round(((props.reveal.voteCounts[playerId] ?? 0) / total) * 100)
}

</script>
