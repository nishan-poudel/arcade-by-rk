<template>
  <div class="h-dvh flex flex-col" style="padding-top: max(1rem, env(safe-area-inset-top))">
    <!-- Scrollable body -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Room code: BIG, easy to read from across the table.
             Tap anywhere on the badge to copy it to clipboard. -->
        <div class="text-center mb-6 animate-fade-in">
          <p class="text-muted-foreground text-xs uppercase tracking-widest mb-3 font-display font-semibold">{{ locale.imposter.waitingRoom.title }}</p>
          <button
            class="inline-flex flex-col items-center justify-center bg-secondary/60 border-2 border-dashed border-primary/50
                   rounded-3xl px-6 py-5 mb-2 active:scale-[0.98] transition-all duration-200 ease-bounce w-full max-w-xs shadow-pop hover:-translate-y-0.5"
            @click="copyCode"
          >
            <span class="font-display font-bold text-4xl tracking-[0.25em] text-primary">
              {{ gameState.roomCode }}
            </span>
            <Transition name="copy-pop" mode="out-in">
              <span
                :key="copied ? 'copied' : 'idle'"
                class="text-xs mt-2 flex items-center gap-1"
                :class="copied ? 'text-primary' : 'text-muted-foreground'"
              >
                <CheckIcon v-if="copied" class="size-3.5" />
                <CopyIcon v-else class="size-3.5" />
                {{ copied ? locale.imposter.waitingRoom.copied : locale.imposter.waitingRoom.tapToCopy }}
              </span>
            </Transition>
          </button>
          <p class="text-muted-foreground text-sm">{{ locale.imposter.waitingRoom.shareCode }}</p>
          <button
            class="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/80 transition-colors"
            @click="copyInviteLink"
          >
            <LinkIcon class="size-3.5" />
            {{ linkCopied ? locale.imposter.waitingRoom.linkCopied : locale.imposter.waitingRoom.copyInviteLink }}
          </button>
        </div>

        <!-- Player list -->
        <Card class="mb-4">
          <CardHeader class="flex-row items-center justify-between space-y-0">
            <CardTitle class="text-base normal-case tracking-normal flex items-center gap-2">
              <UsersIcon class="size-4 text-muted-foreground" />
              {{ locale.imposter.waitingRoom.playersHeading }}
            </CardTitle>
            <Badge variant="secondary" class="text-sm">
              {{ locale.imposter.waitingRoom.playersCount(gameState.players.length) }}
            </Badge>
          </CardHeader>
          <CardContent>
            <TransitionGroup
              name="player-list" tag="ul"
              class="space-y-2">
              <li
                v-for="player in gameState.players"
                :key="player.id"
                class="flex items-center gap-3 py-3 px-3 rounded-2xl bg-secondary/40 border-2 border-border transition-colors hover:border-primary/40"
              >
                <span
                  :class="[
                    'w-2.5 h-2.5 rounded-full flex-shrink-0',
                    player.connected ? 'bg-primary' : 'bg-muted-foreground/30',
                  ]"
                />
                <span class="flex-1 font-medium text-base">{{ player.name }}</span>
                <Badge
                  v-if="player.isHost" variant="warning"
                  class="gap-1">
                  <Crown class="size-3" />{{ locale.imposter.waitingRoom.hostBadge }}
                </Badge>
              </li>
            </TransitionGroup>

            <p v-if="gameState.players.length < 3" class="text-muted-foreground/70 text-xs mt-3 text-center">
              {{ locale.imposter.waitingRoom.needMorePlayers }}
            </p>
          </CardContent>
        </Card>

        <!-- Host settings -->
        <Card v-if="isHost" class="mb-4">
          <CardHeader>
            <CardTitle class="text-base normal-case tracking-normal">{{ locale.imposter.waitingRoom.settingsHeading }}</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div>
              <Label>{{ locale.imposter.waitingRoom.difficultyLabel }}</Label>
              <ToggleGroup
                :model-value="gameState.difficulty"
                @update:model-value="(v) => $emit('set-difficulty', v as Difficulty)"
              >
                <ToggleGroupItem value="easy">
                  <DifficultyIcon difficulty="easy" />{{ locale.imposter.difficulty.easy }}
                </ToggleGroupItem>
                <ToggleGroupItem value="medium">
                  <DifficultyIcon difficulty="medium" />{{ locale.imposter.difficulty.medium }}
                </ToggleGroupItem>
                <ToggleGroupItem value="hard">
                  <DifficultyIcon difficulty="hard" />{{ locale.imposter.difficulty.hard }}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div>
              <Label>{{ locale.imposter.waitingRoom.impostersLabel }}</Label>
              <ToggleGroup
                :model-value="String(gameState.imposterCount)"
                @update:model-value="(v) => $emit('set-imposter-count', Number(v))"
              >
                <ToggleGroupItem
                  v-for="n in Math.min(4, Math.max(1, gameState.players.length - 1))"
                  :key="n"
                  :value="String(n)"
                  class="min-h-[52px] text-lg"
                >
                  {{ n }}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <!-- Keep-alive toggle: prevents a free-tier backend (e.g. Render)
                 from spinning down while the group lingers in the lobby. -->
            <div
              class="w-full flex items-center justify-between text-left rounded-xl px-3 py-3 border transition-colors"
              :class="keepAliveEnabled ? 'border-primary/30 bg-primary/5' : 'border-border bg-secondary/30'"
            >
              <span class="flex items-center gap-2">
                <BatteryCharging class="size-4 shrink-0" :class="keepAliveEnabled ? 'text-primary' : 'text-muted-foreground'" />
                <span>
                  <span class="block text-sm font-semibold" :class="keepAliveEnabled ? 'text-primary' : 'text-foreground/80'">
                    {{ keepAliveEnabled ? locale.imposter.common.keepAliveOn : locale.imposter.common.keepAliveOff }}
                  </span>
                  <span class="block text-xs text-muted-foreground/80 mt-0.5">{{ locale.imposter.common.keepAliveHint }}</span>
                </span>
              </span>
              <Switch
                :model-value="keepAliveEnabled" class="ml-3"
                @update:model-value="toggleKeepAlive" />
            </div>
          </CardContent>
        </Card>

        <!-- Non-host waiting message -->
        <div v-else class="text-center text-muted-foreground text-sm py-3">
          <div class="flex items-center gap-2 justify-center">
            <span class="w-2 h-2 bg-primary rounded-full animate-pulse-slow" />
            {{ locale.imposter.waitingRoom.waitingForHost }}
          </div>
        </div>
        <AppFooter />
      </div>
    </div>

    <!-- Sticky action bar at bottom -->
    <div class="action-bar space-y-2">
      <div class="w-full max-w-md mx-auto space-y-2">
        <Button
          v-if="isHost"
          size="lg"
          class="w-full"
          :disabled="gameState.players.length < 3"
          @click="$emit('start')"
        >
          <Rocket class="size-4" />{{ locale.imposter.waitingRoom.startGame }}
        </Button>
        <Button
          variant="secondary" class="w-full"
          @click="$emit('leave')">
          {{ locale.imposter.waitingRoom.leaveRoom }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { BatteryCharging, CheckIcon, CopyIcon, Crown, LinkIcon, Rocket, UsersIcon } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import { useKeepAlive } from '../composables/useKeepAlive.js'
import type { GameState, Difficulty } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import DifficultyIcon from './DifficultyIcon.vue'
import AppFooter from './AppFooter.vue'

const props = defineProps<{
  gameState: GameState
  isHost: boolean
}>()

defineEmits<{
  start: []
  leave: []
  'set-difficulty': [difficulty: Difficulty]
  'set-imposter-count': [count: number]
}>()
// ── Keep-alive toggle (prevents free-tier backend spin-down mid-lobby) ────────
const { enabled: keepAliveEnabled, toggle: toggleKeepAlive } = useKeepAlive()
// ── Copy room code ────────────────────────────────────────────────────────────
const copied = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.gameState.roomCode)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Clipboard API not available (non-HTTPS) — code is still visible on screen
  }
}

// ── Copy shareable invite link (full URL, so opening it lands directly on
//    the Join form with the room code pre-filled) ───────────────────────────
const linkCopied = ref(false)

async function copyInviteLink() {
  try {
    const url = `${location.origin}/${props.gameState.roomCode}`
    await navigator.clipboard.writeText(url)
    linkCopied.value = true
    setTimeout(() => { linkCopied.value = false }, 2000)
  } catch {
    // Clipboard API not available (non-HTTPS) — room code is still visible on screen
  }
}
</script>

<style scoped>
.player-list-enter-active,
.player-list-leave-active {
  transition: all 0.25s ease;
}
.player-list-enter-from,
.player-list-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

/* Little "pop" when the copy-to-clipboard status swaps in/out. */
.copy-pop-enter-active,
.copy-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.copy-pop-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
.copy-pop-leave-to {
  opacity: 0;
  transform: scale(1.1);
}
</style>
