<template>
  <div v-if="state" class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <h2 class="text-center font-display text-2xl font-bold">{{ t.waitingRoom.title }}</h2>

    <Card>
      <CardContent class="flex flex-col items-center gap-2 pt-6">
        <p class="text-sm text-muted-foreground">{{ t.waitingRoom.shareCode }}</p>
        <button
          class="rounded-2xl border-2 border-dashed border-primary/50 bg-primary/10 px-6 py-3 font-display text-3xl font-bold tracking-[0.3em] text-primary transition active:scale-95"
          data-testid="room-code"
          @click="copyCode"
        >
          {{ state.code }}
        </button>
        <p class="text-xs font-medium text-flavor-melon-ink">{{ copied ? t.waitingRoom.copied : t.waitingRoom.tapToCopy }}</p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle class="flex items-center justify-between text-base">
          {{ t.waitingRoom.playersHeading }}
          <Badge variant="secondary">{{ t.waitingRoom.playersCount(state.players.length) }}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 pt-0">
        <PlayerRow
          v-for="player in state.players"
          :key="player.id"
          :player="player"
          :is-me="player.id === faras.myPlayerId.value"
          :removable="faras.isHost.value && !player.connected && player.id !== faras.myPlayerId.value"
          @remove="faras.removePlayer(player.id)"
        />
        <p v-if="state.players.length === 0" class="text-center text-sm text-muted-foreground">
          {{ t.waitingRoom.needMorePlayers }}
        </p>
      </CardContent>
    </Card>

    <Button v-if="faras.isHost.value" size="lg" :disabled="state.players.length < 2" @click="faras.startHand()">
      {{ t.waitingRoom.startButton }}
    </Button>
    <p v-else class="text-center text-sm text-muted-foreground">{{ t.waitingRoom.onlyHostCanStart }}</p>
    <p v-if="faras.isHost.value && state.players.length < 2" class="text-center text-xs text-muted-foreground">
      {{ t.waitingRoom.needMorePlayers }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { en } from '@/locales/en'
import { useFaras } from '../composables/useFaras'
import PlayerRow from './PlayerRow.vue'

const t = en.faras
const faras = useFaras()
const state = computed(() => faras.state.value)

const copied = ref(false)
function copyCode() {
  if (!state.value) return
  navigator.clipboard?.writeText(state.value.code).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  })
}
</script>
