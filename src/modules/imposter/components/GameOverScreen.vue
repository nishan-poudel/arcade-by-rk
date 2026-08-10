<template>
  <div
    class="h-dvh flex flex-col bg-background"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <!-- Scrollable body -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Header -->
        <div class="text-center pt-4 mb-6 animate-bounce-once">
          <Trophy class="size-14 mb-3 mx-auto text-warning" />
          <h1 class="text-3xl font-extrabold mb-1">{{ locale.imposter.gameOver.title }}</h1>
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
              class="w-full h-20 bg-secondary/60 rounded-t-xl flex items-end justify-center pb-2
                     animate-in slide-in-from-bottom-8 fade-in fill-mode-both duration-500"
              style="animation-delay: 100ms"
            >
              <span class="text-xl font-extrabold text-foreground/70">{{ sortedPlayers[1].score }}</span>
            </div>
            <div class="w-full bg-secondary/60 text-center text-xs text-muted-foreground py-1.5 rounded-b flex items-center justify-center gap-1">
              <Medal class="size-3.5" />{{ locale.imposter.gameOver.second }}
            </div>
          </div>

          <!-- 1st place — taller than others -->
          <div class="flex flex-col items-center flex-1 max-w-[110px]">
            <p class="text-sm font-bold text-warning mb-1 truncate w-full text-center">
              {{ sortedPlayers[0].name }}
            </p>
            <div
              class="w-full h-28 bg-warning/20 border border-warning/40
                     rounded-t-xl flex items-end justify-center pb-2
                     animate-in slide-in-from-bottom-8 fade-in fill-mode-both duration-500"
              style="animation-delay: 200ms"
            >
              <span class="text-3xl font-extrabold text-warning">{{ sortedPlayers[0].score }}</span>
            </div>
            <div
              class="w-full bg-warning/20 border border-warning/30
                     text-center text-xs text-warning py-1.5 rounded-b flex items-center justify-center gap-1"
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
              class="w-full h-14 bg-secondary/40 rounded-t-xl flex items-end justify-center pb-2
                     animate-in slide-in-from-bottom-8 fade-in fill-mode-both duration-500"
              style="animation-delay: 300ms"
            >
              <span class="text-lg font-extrabold text-muted-foreground">{{ sortedPlayers[2].score }}</span>
            </div>
            <div class="w-full bg-secondary/40 text-center text-xs text-muted-foreground/70 py-1.5 rounded-b flex items-center justify-center gap-1">
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
                class="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-secondary/40 border border-border"
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

defineProps<{
  gameState: GameState
  sortedPlayers: PublicPlayer[]
}>()

defineEmits<{ leave: [] }>()
</script>
