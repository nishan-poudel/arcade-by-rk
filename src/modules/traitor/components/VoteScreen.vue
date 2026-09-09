<template>
  <div class="h-dvh flex flex-col" style="padding-top: max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))">
    <!-- Pinned vote panel -->
    <VotePanel
      :players="gameState.players"
      :my-id="myId"
      :selection="myVoteSelection"
      :my-vote="myVote"
      :is-host="isHost"
      @select="$emit('select', $event)"
      @submit="$emit('submit')"
      @force-reveal="$emit('force-reveal')"
    />

    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
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

    <div v-if="isHost" class="action-bar">
      <div class="w-full max-w-md mx-auto">
        <Button
          variant="destructive" size="sm"
          class="w-full text-sm" @click="$emit('end-game')">
          {{ locale.traitor.result.endSession }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { en as locale } from '@/locales/en'
import type { TraitorGameState } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import AppFooter from './AppFooter.vue'
import PickBoard from './PickBoard.vue'
import VotePanel from './VotePanel.vue'

defineProps<{
  gameState: TraitorGameState
  myId: string
  myVote: string
  myVoteSelection: string
  isHost: boolean
}>()

defineEmits<{ select: [id: string]; submit: []; 'force-reveal': []; 'end-game': [] }>()
</script>
