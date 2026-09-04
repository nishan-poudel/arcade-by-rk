<template>
  <div
    class="h-dvh flex flex-col relative overflow-hidden"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <ConfettiBurst />

    <!-- Scrollable body -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Header -->
        <div class="text-center pt-4 mb-6 animate-bounce-once">
          <Trophy class="size-14 mb-3 mx-auto text-warning" />
          <h1 class="text-3xl mb-1">{{ locale.imposter.gameOver.title }}</h1>
          <p class="text-muted-foreground text-sm">
            {{ locale.imposter.gameOver.roundsPlayed(gameState.round) }}
          </p>
        </div>

        <!-- Podium — scales to the actual number of players -->
        <div
          v-if="sortedPlayers.length >= 1"
          class="flex items-end justify-center gap-3 mb-8 animate-fade-in"
        >
          <!-- 2nd place -->
          <div v-if="sortedPlayers[1]" class="flex flex-col items-center flex-1 max-w-[100px]">
            <p class="text-xs font-semibold text-foreground/70 mb-1 truncate w-full text-center">
              {{ sortedPlayers[1].name }}
            </p>
            <div
              class="w-full h-20 bg-flavor-lychee-soft border-2 border-flavor-lychee/40 rounded-t-2xl flex items-end justify-center pb-2
                     animate-in slide-in-from-bottom-8 fade-in fill-mode-both duration-500"
              style="animation-delay: 100ms"
            >
              <span class="text-xl font-display font-bold text-flavor-lychee-ink">{{ sortedPlayers[1].score }}</span>
            </div>
            <div class="w-full bg-flavor-lychee-soft border-x-2 border-b-2 border-flavor-lychee/40 text-center text-xs text-flavor-lychee-ink py-1.5 rounded-b-lg flex items-center justify-center gap-1 font-display font-semibold">
              <Medal class="size-3.5" />{{ locale.imposter.gameOver.second }}
            </div>
          </div>

          <!-- 1st place — taller than others, candy gradient -->
          <div class="flex flex-col items-center flex-1 max-w-[110px]">
            <p class="text-sm font-bold text-warning mb-1 truncate w-full text-center">
              {{ sortedPlayers[0].name }}
            </p>
            <div
              class="w-full h-28 border-2 border-warning/50
                     rounded-t-2xl flex items-end justify-center pb-2 shadow-pop
                     animate-in slide-in-from-bottom-8 fade-in fill-mode-both duration-500"
              style="animation-delay: 200ms; background-image: linear-gradient(160deg, hsl(var(--flavor-citron-soft)), hsl(var(--warning) / 0.35))"
            >
              <span class="text-3xl font-display font-bold text-warning-foreground">{{ sortedPlayers[0].score }}</span>
            </div>
            <div
              class="w-full bg-warning border-x-2 border-b-2 border-warning/50
                     text-center text-xs text-warning-foreground py-1.5 rounded-b-lg flex items-center justify-center gap-1 font-display font-semibold"
            >
              <Medal class="size-3.5" />{{ locale.imposter.gameOver.first }}
            </div>
          </div>

          <!-- 3rd place -->
          <div v-if="sortedPlayers[2]" class="flex flex-col items-center flex-1 max-w-[90px]">
            <p class="text-xs font-semibold text-muted-foreground mb-1 truncate w-full text-center">
              {{ sortedPlayers[2].name }}
            </p>
            <div
              class="w-full h-14 bg-flavor-peach-soft border-2 border-flavor-peach/40 rounded-t-2xl flex items-end justify-center pb-2
                     animate-in slide-in-from-bottom-8 fade-in fill-mode-both duration-500"
              style="animation-delay: 300ms"
            >
              <span class="text-lg font-display font-bold text-flavor-peach-ink">{{ sortedPlayers[2].score }}</span>
            </div>
            <div class="w-full bg-flavor-peach-soft border-x-2 border-b-2 border-flavor-peach/40 text-center text-xs text-flavor-peach-ink py-1.5 rounded-b-lg flex items-center justify-center gap-1 font-display font-semibold">
              <Medal class="size-3.5" />{{ locale.imposter.gameOver.third }}
            </div>
          </div>
        </div>

        <!-- Full scoreboard -->
        <Card class="mb-4">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.imposter.gameOver.allScoresHeading }}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li
                v-for="(player, idx) in sortedPlayers"
                :key="player.id"
                class="flex items-center gap-3 py-2.5 px-3 rounded-2xl bg-secondary/40 border-2 border-border transition-colors hover:border-primary/40"
              >
                <span class="text-xs text-muted-foreground/60 w-5 shrink-0">{{ idx + 1 }}</span>
                <span class="flex-1 font-medium truncate">{{ player.name }}</span>
                <Badge
                  v-if="player.isHost" variant="warning"
                  class="shrink-0 gap-1">
                  <Crown class="size-3" />{{ locale.imposter.gameOver.hostBadge }}
                </Badge>
                <span class="font-extrabold text-primary text-lg shrink-0">{{ player.score }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        <AppFooter />
      </div>
    </div>

    <!-- Sticky back button -->
    <div class="action-bar">
      <div class="w-full max-w-md mx-auto">
        <Button
          size="lg" class="w-full"
          @click="$emit('leave')">
          <Home class="size-4" />{{ locale.imposter.gameOver.backHome }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Crown, Home, Medal, Trophy } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { GameState, PublicPlayer } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import AppFooter from './AppFooter.vue'
import ConfettiBurst from './decor/ConfettiBurst.vue'

defineProps<{
  gameState: GameState
  sortedPlayers: PublicPlayer[]
}>()

defineEmits<{ leave: [] }>()
</script>
