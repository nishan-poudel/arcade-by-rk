<template>
  <div class="h-dvh flex flex-col" style="padding-top: max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))">
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <div class="text-center mb-5 animate-bounce-once">
          <MessagesSquare class="size-12 mb-2 mx-auto text-primary" />
          <h1 class="text-2xl mb-1">{{ locale.traitor.discussion.title }}</h1>
          <p class="text-muted-foreground text-sm">{{ locale.traitor.discussion.sub }}</p>
          <p class="text-muted-foreground/70 text-xs mt-1">
            {{ locale.traitor.answer.roundLabel(gameState.round, gameState.totalRounds) }}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.traitor.discussion.boardHeading }}</CardTitle>
          </CardHeader>
          <CardContent>
            <PickBoard :players="gameState.players" :picks="gameState.picks" />
          </CardContent>
        </Card>

        <AppFooter />
      </div>
    </div>

    <div class="action-bar space-y-2">
      <div class="w-full max-w-md mx-auto space-y-2">
        <template v-if="isHost">
          <Button
            size="lg" class="w-full"
            @click="$emit('open-vote')">
            <Vote class="size-5" />{{ locale.traitor.discussion.startVote }}
          </Button>
          <Button
            variant="destructive" size="sm"
            class="w-full text-sm" @click="$emit('end-game')">
            {{ locale.traitor.result.endSession }}
          </Button>
        </template>
        <div v-else class="text-center py-3">
          <div class="flex items-center gap-2 justify-center text-muted-foreground text-sm">
            <span class="w-2 h-2 bg-primary rounded-full animate-pulse-slow" />
            {{ locale.traitor.discussion.waitingForHost }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MessagesSquare, Vote } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { TraitorGameState } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import AppFooter from './AppFooter.vue'
import PickBoard from './PickBoard.vue'

defineProps<{ gameState: TraitorGameState; isHost: boolean }>()
defineEmits<{ 'open-vote': []; 'end-game': [] }>()
</script>
