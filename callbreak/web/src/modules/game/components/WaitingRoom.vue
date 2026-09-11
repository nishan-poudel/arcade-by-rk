<template>
  <div v-if="state" class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <h2 class="text-center font-display text-2xl font-bold">{{ t.waitingRoom.title }}</h2>

    <Card>
      <CardContent class="flex flex-col items-center gap-2 pt-6">
        <p class="text-sm text-muted-foreground">{{ t.waitingRoom.shareCode }}</p>
        <button
          class="rounded-2xl border-2 border-dashed border-primary/50 bg-primary/10 px-6 py-3 font-display text-3xl font-bold tracking-[0.3em] text-primary transition active:scale-95"
          data-testid="room-code" @click="copyCode"
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
          <Badge variant="secondary">{{ t.waitingRoom.playersCount(seatedCount) }}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent class="flex flex-col gap-2 pt-0">
        <div
          v-for="seat in 4"
          :key="seat"
          class="flex items-center justify-between rounded-xl border-2 border-border bg-secondary/40 px-3 py-2.5"
        >
          <template v-if="state.players[seat - 1]">
            <span class="font-display font-semibold">
              {{ state.players[seat - 1]!.name }}
              <Badge v-if="state.players[seat - 1]!.isHost" variant="default" class="ml-1.5">{{ t.common.host }}</Badge>
              <span v-if="state.players[seat - 1]!.id === game.myPlayerId.value" class="text-muted-foreground">
                ({{ t.common.you }})
              </span>
            </span>
            <span class="flex items-center gap-2">
              <span
                class="h-2 w-2 rounded-full"
                :class="state.players[seat - 1]!.connected ? 'bg-flavor-melon' : 'bg-muted-foreground/40'"
              />
              <Button
                v-if="game.isHost.value && !state.players[seat - 1]!.connected"
                size="sm"
                variant="ghost"
                @click="game.removePlayer(seat - 1)"
              >
                {{ t.waitingRoom.removePlayer }}
              </Button>
            </span>
          </template>
          <span v-else class="text-sm text-muted-foreground">{{ t.waitingRoom.waitingForPlayers }}</span>
        </div>
      </CardContent>
    </Card>

    <Card v-if="game.isHost.value">
      <CardHeader>
        <CardTitle class="text-base">{{ t.waitingRoom.roundsLabel }}</CardTitle>
      </CardHeader>
      <CardContent class="pt-0">
        <ToggleGroup :model-value="String(state.roundCount)" class="grid grid-cols-3 gap-2" @update:model-value="onRoundCount">
          <ToggleGroupItem v-for="n in ROUND_COUNT_OPTIONS" :key="n" :value="String(n)" class="h-11">{{ n }}</ToggleGroupItem>
        </ToggleGroup>
      </CardContent>
    </Card>

    <Button v-if="game.isHost.value" size="lg" :disabled="seatedCount < 4" @click="game.startGame()">
      {{ t.waitingRoom.startButton }}
    </Button>
    <p v-else class="text-center text-sm text-muted-foreground">{{ t.waitingRoom.onlyHostCanStart }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ROUND_COUNT_OPTIONS, type RoundCount } from '@callbreak/shared-logic'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { en } from '@/locales/en'
import { useGame } from '../composables/useGame'

const t = en.callBreak
const game = useGame()
const state = computed(() => game.state.value)
const seatedCount = computed(() => state.value?.players.filter((p) => p !== null).length ?? 0)

const copied = ref(false)
function copyCode() {
  if (!state.value) return
  navigator.clipboard?.writeText(state.value.code).then(() => {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  })
}

function onRoundCount(value: string) {
  game.setRoundCount(Number(value) as RoundCount)
}
</script>
