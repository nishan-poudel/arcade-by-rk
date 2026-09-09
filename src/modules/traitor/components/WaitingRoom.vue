<template>
  <div class="h-dvh flex flex-col" style="padding-top: max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))">
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Room code -->
        <div class="text-center mb-6 animate-fade-in">
          <p class="text-muted-foreground text-xs uppercase tracking-widest mb-3 font-display font-semibold">
            {{ locale.traitor.waitingRoom.title }}
          </p>
          <button
            class="inline-flex flex-col items-center justify-center bg-secondary/60 border-2 border-dashed border-primary/50
                   rounded-3xl px-6 py-5 mb-2 active:scale-[0.98] transition-all duration-200 ease-bounce w-full max-w-xs shadow-pop hover:-translate-y-0.5"
            @click="copyCode"
          >
            <span class="font-display font-bold text-4xl tracking-[0.25em] text-primary">{{ gameState.roomCode }}</span>
            <span class="text-xs mt-2 flex items-center gap-1" :class="copied ? 'text-primary' : 'text-muted-foreground'">
              <component :is="copied ? CheckIcon : CopyIcon" class="size-3.5" />
              {{ copied ? locale.traitor.waitingRoom.copied : locale.traitor.waitingRoom.tapToCopy }}
            </span>
          </button>
          <p class="text-muted-foreground text-sm">{{ locale.traitor.waitingRoom.shareCode }}</p>
          <button
            class="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
            @click="copyInviteLink"
          >
            <LinkIcon class="size-3.5" />
            {{ linkCopied ? locale.traitor.waitingRoom.linkCopied : locale.traitor.waitingRoom.copyInviteLink }}
          </button>
        </div>

        <!-- Player list -->
        <Card class="mb-4">
          <CardHeader class="flex-row items-center justify-between space-y-0">
            <CardTitle class="text-base normal-case tracking-normal flex items-center gap-2">
              <UsersIcon class="size-4 text-muted-foreground" />{{ locale.traitor.waitingRoom.playersHeading }}
            </CardTitle>
            <Badge variant="secondary" class="text-sm">
              {{ locale.traitor.waitingRoom.readyCount(readyCount, gameState.players.length) }}
            </Badge>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li
                v-for="player in gameState.players"
                :key="player.id"
                class="flex items-center gap-3 py-3 px-3 rounded-2xl bg-secondary/40 border-2 transition-colors"
                :class="player.ready ? 'border-flavor-melon/40' : 'border-border'"
              >
                <span class="text-xl shrink-0">{{ player.avatar }}</span>
                <span class="flex-1 font-medium text-base truncate" :class="{ 'text-muted-foreground/60': !player.connected }">
                  {{ player.name }}
                </span>
                <button
                  v-if="isHost && !player.connected && !player.isHost"
                  class="p-1.5 rounded-lg text-destructive/80 hover:bg-destructive/10 active:scale-90 transition"
                  :aria-label="`Remove ${player.name}`"
                  @click="$emit('remove-player', player.id)"
                >
                  <UserMinus class="size-4" />
                </button>
                <Badge
                  v-if="player.isHost" variant="warning"
                  class="gap-1">
                  <Crown class="size-3" />{{ locale.traitor.waitingRoom.hostBadge }}
                </Badge>
                <CheckCircle2 v-if="player.ready" class="size-5 text-flavor-melon-ink shrink-0" />
                <Circle v-else class="size-5 text-muted-foreground/30 shrink-0" />
              </li>
            </ul>
            <p v-if="gameState.players.length < 3" class="text-muted-foreground/70 text-xs mt-3 text-center">
              {{ locale.traitor.waitingRoom.needMorePlayers }}
            </p>
          </CardContent>
        </Card>

        <!-- Host settings -->
        <Card v-if="isHost" class="mb-4">
          <CardHeader>
            <CardTitle class="text-base normal-case tracking-normal">{{ locale.traitor.waitingRoom.settingsHeading }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div>
              <Label>{{ locale.traitor.waitingRoom.categoryLabel }}</Label>
              <ToggleGroup
                class="flex-wrap"
                :model-value="gameState.category"
                @update:model-value="(v) => { if (v) $emit('set-category', v as string) }"
              >
                <ToggleGroupItem
                  v-for="c in categories" :key="c"
                  :value="c" class="basis-[calc(33.333%-0.5rem)] grow">
                  {{ c }}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div>
              <Label>{{ locale.traitor.waitingRoom.roundsLabel }}</Label>
              <ToggleGroup
                :model-value="String(gameState.totalRounds)"
                @update:model-value="(v) => { if (v) $emit('set-rounds', Number(v) as TotalRounds) }"
              >
                <ToggleGroupItem
                  v-for="n in ([3, 5, 8] as const)" :key="n"
                  :value="String(n)" class="min-h-[52px] text-lg">
                  {{ n }}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </CardContent>
        </Card>

        <AppFooter />
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="action-bar space-y-2">
      <div class="w-full max-w-md mx-auto space-y-2">
        <Button
          v-if="!isHost"
          size="lg"
          class="w-full"
          :variant="me?.ready ? 'secondary' : 'default'"
          @click="$emit('set-ready', !me?.ready)"
        >
          <component :is="me?.ready ? CheckCircle2 : Circle" class="size-5" />
          {{ me?.ready ? locale.traitor.waitingRoom.readyDone : locale.traitor.waitingRoom.readyButton }}
        </Button>

        <Button
          v-if="isHost"
          size="lg"
          class="w-full"
          :disabled="gameState.players.length < 3 || !allReady"
          @click="$emit('start')"
        >
          <Rocket class="size-4" />{{ locale.traitor.waitingRoom.startGame }}
        </Button>
        <p v-if="isHost && gameState.players.length >= 3 && !allReady" class="text-center text-xs text-muted-foreground -mt-1">
          {{ locale.traitor.waitingRoom.notEveryoneReady }}
        </p>

        <Button
          variant="secondary" class="w-full"
          @click="$emit('leave')">
          {{ locale.traitor.waitingRoom.leaveRoom }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  CheckCircle2, CheckIcon, Circle, CopyIcon, Crown, LinkIcon, Rocket, UserMinus, UsersIcon,
} from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { TraitorGameState, TotalRounds } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import AppFooter from './AppFooter.vue'

const props = defineProps<{
  gameState: TraitorGameState
  isHost: boolean
  myId: string
  categories: string[]
}>()

defineEmits<{
  start: []
  leave: []
  'set-ready': [ready: boolean]
  'set-category': [category: string]
  'set-rounds': [rounds: TotalRounds]
  'remove-player': [playerId: string]
}>()

const me = computed(() => props.gameState.players.find((p) => p.id === props.myId))
const readyCount = computed(() => props.gameState.players.filter((p) => p.ready).length)
const allReady = computed(() => props.gameState.players.every((p) => !p.connected || p.ready))

const copied = ref(false)
const linkCopied = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.gameState.roomCode)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* non-HTTPS: code is on screen */ }
}

async function copyInviteLink() {
  try {
    await navigator.clipboard.writeText(`${location.origin}/traitor/${props.gameState.roomCode}`)
    linkCopied.value = true
    setTimeout(() => { linkCopied.value = false }, 2000)
  } catch { /* non-HTTPS: code is on screen */ }
}
</script>
