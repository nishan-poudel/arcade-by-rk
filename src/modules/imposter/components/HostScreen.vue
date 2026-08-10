<template>
  <div
    class="h-dvh flex flex-col bg-background"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <!-- Scrollable content -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Header -->
        <div class="flex items-center justify-between mb-4 animate-fade-in">
          <div>
            <Badge variant="warning" class="mb-1 gap-1">
              <Crown class="size-3" />{{ locale.imposter.hostScreen.hostBadge }}
            </Badge>
            <h2 class="text-xl font-bold leading-tight">{{ hostPlayer?.name ?? locale.imposter.hostScreen.hostFallback }}</h2>
          </div>
          <div class="text-right">
            <p class="text-muted-foreground text-xs uppercase tracking-wider">{{ locale.imposter.hostScreen.roundLabel }}</p>
            <p class="text-3xl font-extrabold">{{ gameState.round }}</p>
          </div>
        </div>

        <!--
          Secret word — HIDDEN if host is the imposter.
          This is the key fix: before, the host always saw the word even when
          they were assigned the imposter role.
        -->
        <Card
          class="mb-3 text-center"
          :class="isHostImposter
            ? 'border-destructive/40 bg-destructive/10'
            : 'border-warning/30 bg-warning/5'"
        >
          <CardContent class="pt-4">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-1">
              {{ isHostImposter ? locale.imposter.hostScreen.yourRoleLabel : locale.imposter.hostScreen.secretWordLabel }}
            </p>
            <p v-if="isHostImposter" class="text-2xl font-bold text-destructive mb-1 flex items-center justify-center gap-2">
              <VenetianMask class="size-6" />{{ locale.imposter.hostScreen.imposterLabel }}
            </p>
            <p v-if="isHostImposter" class="text-5xl font-extrabold text-muted-foreground/30">？？？</p>
            <p v-else class="text-4xl font-extrabold tracking-tight break-words">
              {{ myAssignment.word ?? '???' }}
            </p>
            <p class="text-xs text-muted-foreground/70 mt-1 flex items-center justify-center gap-1">
              <DifficultyIcon :difficulty="gameState.difficulty" class="size-3" />
              {{ gameState.difficulty }} {{ locale.imposter.hostScreen.difficultySuffix }}
            </p>
          </CardContent>
        </Card>

        <!-- Turn status + progress -->
        <Card class="mb-3">
          <CardContent class="pt-4">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-2">{{ locale.imposter.hostScreen.statusLabel }}</p>
            <!--
              No enter/leave transition here on purpose: this text changes every
              turn (frequently, mid-round) and must always reflect the current
              server state immediately. A CSS/JS transition here would add
              latency and — if the tab is ever backgrounded at the wrong instant —
              can get stuck showing a stale player name until refocused.
            -->
            <div v-if="screen === 'discussion'" class="text-center py-1">
              <p class="text-xl font-bold text-warning flex items-center justify-center gap-2">
                <MessagesSquare class="size-5" />{{ locale.imposter.hostScreen.discussionTitle }}
              </p>
              <p class="text-sm text-muted-foreground mt-1">{{ locale.imposter.hostScreen.discussionSub }}</p>
            </div>
            <div v-else>
              <div class="flex items-center gap-2 mb-3">
                <span class="w-2.5 h-2.5 bg-primary rounded-full animate-pulse-slow" />
                <span class="font-semibold">{{ locale.imposter.hostScreen.turnSuffix(gameState.currentTurnName) }}</span>
              </div>
              <Progress :model-value="turnProgress" />
              <p class="text-xs text-muted-foreground/70 mt-1.5">
                {{ locale.imposter.hostScreen.doneProgress(donePlayers, gameState.players.length) }}
              </p>
            </div>
          </CardContent>
        </Card>

        <!-- Keep-alive toggle: prevents a free-tier backend (e.g. Render) from
             spinning down mid-game due to 15 min of no inbound HTTP traffic. -->
        <Card
          class="mb-3 flex items-center justify-between py-3 px-4"
          :class="keepAliveEnabled ? 'border-primary/30 bg-primary/5' : ''"
        >
          <span class="text-sm font-semibold flex items-center gap-2" :class="keepAliveEnabled ? 'text-primary' : 'text-foreground/80'">
            <BatteryCharging class="size-4" />{{ keepAliveEnabled ? locale.imposter.common.keepAliveOn : locale.imposter.common.keepAliveOff }}
          </span>
          <Switch :model-value="keepAliveEnabled" @update:model-value="toggleKeepAlive" />
        </Card>

        <!-- Player list -->
        <Card class="mb-3">
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.imposter.hostScreen.allPlayersHeading }}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li
                v-for="(player, idx) in sortedPlayers"
                :key="player.id"
                class="flex items-center gap-2 py-2.5 px-3 rounded-xl bg-secondary/40 border border-border"
              >
                <span class="text-xs text-muted-foreground/60 w-5 shrink-0">{{ idx + 1 }}</span>
                <span
                  :class="['w-2 h-2 rounded-full shrink-0', player.connected ? 'bg-primary' : 'bg-muted-foreground/30']"
                />
                <span class="flex-1 font-medium truncate">{{ player.name }}</span>
                <Badge v-if="player.hasDone && screen === 'game'" class="animate-in zoom-in-50 duration-200"><Check class="size-3" /></Badge>
                <Badge
                  v-if="player.hasVoted && screen === 'discussion'" variant="warning"
                  class="animate-in zoom-in-50 duration-200">
                  <Vote class="size-3" />
                </Badge>
                <span class="font-bold text-primary text-sm">{{ player.score }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <!-- In-app voting (discussion phase) — host votes too, plus can force-reveal early -->
        <Transition name="panel">
          <Card v-if="screen === 'discussion'" class="mb-3 border-warning/20">
            <CardContent class="pt-4">
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs text-muted-foreground uppercase tracking-widest">{{ locale.imposter.hostScreen.voteHeading }}</p>
                <Badge variant="secondary">{{ locale.imposter.hostScreen.votedOf(votedCount, totalVoters) }}</Badge>
              </div>
              <div class="grid grid-cols-2 gap-2 mb-3">
                <button
                  v-for="p in votablePlayers"
                  :key="p.id"
                  class="rounded-xl py-3 px-2 border text-sm font-semibold transition-all active:scale-95 flex items-center justify-center gap-1.5 truncate"
                  :class="myVote === p.id ? 'bg-destructive/20 border-destructive/60 text-destructive' : 'bg-secondary/40 border-border text-foreground/80'"
                  @click="$emit('submit-vote', p.id)"
                >
                  <Vote v-if="myVote === p.id" class="size-4" />
                  <span class="truncate">{{ p.name }}</span>
                </button>
              </div>
              <p class="text-xs text-muted-foreground/70 mb-3 text-center">
                <template v-if="myVote">{{ locale.imposter.hostScreen.votedForChange(votedName) }}</template>
                <template v-else>{{ locale.imposter.hostScreen.tapToVote }}</template>
              </p>
              <Button
                variant="secondary" class="w-full text-sm"
                size="sm" @click="$emit('force-reveal')">
                <Zap class="size-4" />{{ locale.imposter.hostScreen.forceReveal }}
              </Button>
            </CardContent>
          </Card>
        </Transition>

        <!-- Host's own Done button (if it's their turn) -->
        <div v-if="screen === 'game' && isHostTurn" class="mb-3">
          <Button
            size="lg"
            class="w-full text-xl py-7 rounded-2xl font-extrabold
                   shadow-[0_0_40px_hsl(var(--primary)/0.4)] animate-bounce-once"
            :disabled="hostPlayer?.hasDone"
            @click="$emit('player-done')"
          >
            <Check class="size-5" />{{ locale.imposter.hostScreen.hostDoneButton }}
          </Button>
        </div>
        <AppFooter />
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="action-bar space-y-2">
      <div class="w-full max-w-md mx-auto space-y-2">
        <!-- Skip turn — only during game phase when it's NOT the host's own turn -->
        <Button
          v-if="screen === 'game' && !isHostTurn"
          variant="secondary"
          class="w-full text-sm"
          size="sm"
          @click="$emit('skip-turn')"
        >
          <SkipForward class="size-4" />{{ locale.imposter.hostScreen.skipTurn(gameState.currentTurnName) }}
        </Button>

        <div class="grid grid-cols-2 gap-3">
          <Button
            variant="secondary" size="sm"
            @click="openConfirm('reset')">
            <RotateCcw class="size-4" />{{ locale.imposter.hostScreen.resetScoresButton }}
          </Button>
          <Button
            variant="destructive" size="sm"
            @click="openConfirm('end')">
            <OctagonX class="size-4" />{{ locale.imposter.hostScreen.endGameButton }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Confirm dialog for destructive actions -->
    <AlertDialog :open="confirmAction !== null" @update:open="(v) => { if (!v) confirmAction = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {{ confirmAction === 'reset' ? locale.imposter.hostScreen.confirmReset : locale.imposter.hostScreen.confirmEnd }}
          </AlertDialogTitle>
          <!-- Visually hidden: satisfies dialog a11y requirements without adding new copy -->
          <AlertDialogDescription class="sr-only">
            {{ confirmAction === 'reset' ? locale.imposter.hostScreen.confirmReset : locale.imposter.hostScreen.confirmEnd }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="confirmAction = null">
            {{ locale.imposter.hostScreen.cancel }}
          </AlertDialogCancel>
          <AlertDialogAction :variant="confirmAction === 'end' ? 'destructive' : 'default'" @click="confirmAndExecute">
            {{ confirmAction === 'reset' ? locale.imposter.hostScreen.confirmResetButton : locale.imposter.hostScreen.confirmEndButton }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  BatteryCharging,
  Check,
  Crown,
  MessagesSquare,
  OctagonX,
  RotateCcw,
  SkipForward,
  VenetianMask,
  Vote,
  Zap,
} from '@lucide/vue'
import { en as locale } from '@/locales/en'
import { useKeepAlive } from '../composables/useKeepAlive.js'
import type { GameState, PlayerAssignment, AppScreen } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import DifficultyIcon from './DifficultyIcon.vue'
import AppFooter from './AppFooter.vue'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

const props = defineProps<{
  gameState: GameState
  myAssignment: PlayerAssignment
  myId: string
  myVote: string
  screen: AppScreen
}>()

const emit = defineEmits<{
  'end-game': []
  'reset-scores': []
  'submit-vote': [playerId: string]
  'force-reveal': []
  'player-done': []
  'skip-turn': []
}>()

// ── Confirm state ─────────────────────────────────────────────────────────────
const confirmAction = ref<'reset' | 'end' | null>(null)
// Captured (non-reactive) at trigger time: reka-ui's AlertDialogAction closes the
// dialog via its own internal handler, which fires *before* our own @click below
// and already resets `confirmAction` to null (via @update:open) by the time we'd
// read it — so the action to run is snapshotted here instead of re-read live.
let pendingExecute: (() => void) | null = null

function openConfirm(action: 'reset' | 'end') {
  confirmAction.value = action
  pendingExecute = () => {
    if (action === 'reset') {emit('reset-scores')}
    else {emit('end-game')}
  }
}

function confirmAndExecute() {
  pendingExecute?.()
  pendingExecute = null
  confirmAction.value = null
}

// ── Computed ──────────────────────────────────────────────────────────────────
const hostPlayer = computed(() =>
  props.gameState.players.find((p) => p.id === props.gameState.hostId),
)

/** True if the host themselves has been assigned the imposter role this round */
const isHostImposter = computed(
  () => props.myAssignment.role === 'imposter',
)

const isHostTurn = computed(
  () => props.gameState.currentTurnPlayerId === props.gameState.hostId,
)

const sortedPlayers = computed(() =>
  [...props.gameState.players].sort((a, b) => b.score - a.score),
)

const donePlayers = computed(() => props.gameState.players.filter((p) => p.hasDone).length)

const turnProgress = computed(() => {
  const total = props.gameState.players.length
  if (total === 0) {return 0}
  return Math.round((donePlayers.value / total) * 100)
})

/** Everyone except me — valid vote targets (host is a player too) */
const votablePlayers = computed(() => props.gameState.players.filter((p) => p.id !== props.myId))

const votedCount = computed(() => props.gameState.players.filter((p) => p.hasVoted).length)
const totalVoters = computed(() => props.gameState.players.length)

const votedName = computed(
  () => props.gameState.players.find((p) => p.id === props.myVote)?.name ?? '',
)

// ── Keep-alive toggle (prevents free-tier backend spin-down mid-game) ────────
const { enabled: keepAliveEnabled, toggle: toggleKeepAlive } = useKeepAlive()
</script>

<style scoped>
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.panel-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
