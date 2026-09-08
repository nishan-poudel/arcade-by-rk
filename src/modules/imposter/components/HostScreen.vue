<template>
  <div
    class="h-dvh flex flex-col"
    style="padding-top: max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))"
  >
    <!-- Pinned: turn status during describe (Done is in the bottom bar) -->
    <div v-if="screen === 'game' && isHostTurn" class="px-4 pt-1 shrink-0">
      <div
        v-if="!hostPlayer?.hasDone"
        class="w-full max-w-md mx-auto rounded-2xl border-2 border-primary bg-primary/15 px-4 py-3 text-center
               shadow-[0_0_28px_hsl(var(--primary)/0.3)] animate-bounce-once"
      >
        <p class="text-lg font-display font-extrabold text-primary flex items-center justify-center gap-2">
          <Megaphone class="size-5" />{{ locale.imposter.hostScreen.yourTurnBanner }}
        </p>
        <p class="text-xs text-foreground/70 mt-0.5">{{ locale.imposter.hostScreen.yourTurnAction }}</p>
      </div>
      <div
        v-else
        class="w-full max-w-md mx-auto rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 py-2.5 text-center"
      >
        <p class="text-sm font-display font-bold text-primary flex items-center justify-center gap-2">
          <Check class="size-4" />{{ locale.imposter.playerScreen.doneWaitOthers }}
        </p>
      </div>
    </div>

    <!-- Pinned: the whole voting panel during discussion -->
    <VotePanel
      v-else-if="screen === 'discussion'"
      :game-state="gameState"
      :my-id="myId"
      :selection="myVoteSelection"
      :my-vote="myVote"
      :is-host="true"
      @select="$emit('select', $event)"
      @submit="$emit('submit')"
      @force-reveal="$emit('force-reveal')"
    />

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

        <!-- Role + word card: green (crewmate) / red (imposter). The word is
             HIDDEN when the host is the imposter — they only see the decoy. -->
        <Card
          class="mb-3 text-center shadow-pop border-2"
          :class="isHostImposter
            ? 'border-destructive/60 bg-destructive/10'
            : 'border-flavor-melon/50 bg-flavor-melon-soft'"
        >
          <CardContent class="pt-4 pb-4">
            <p
              class="text-xl font-display font-extrabold mb-3 flex items-center justify-center gap-2 tracking-wide"
              :class="isHostImposter ? 'text-destructive' : 'text-flavor-melon-ink'"
            >
              <component :is="isHostImposter ? VenetianMask : ShieldCheck" class="size-5" />
              {{ isHostImposter ? locale.imposter.hostScreen.imposterLabel : locale.imposter.hostScreen.crewmateLabel }}
            </p>
            <p
              class="text-xs uppercase tracking-widest mb-1.5 font-display font-semibold"
              :class="isHostImposter ? 'text-destructive/70' : 'text-flavor-melon-ink/70'"
            >
              {{ isHostImposter && myAssignment.hint ? locale.imposter.hostScreen.imposterHintLabel : locale.imposter.hostScreen.secretWordLabel }}
            </p>
            <p
              v-if="!isHostImposter"
              class="text-4xl font-display font-bold tracking-tight break-words text-flavor-melon-ink"
            >
              {{ myAssignment.word ?? '???' }}
            </p>
            <p
              v-else-if="myAssignment.hint"
              class="text-4xl font-display font-bold tracking-tight break-words text-destructive"
            >
              {{ myAssignment.hint }}
            </p>
            <p v-else class="text-5xl font-display font-bold text-muted-foreground/30">？？？</p>
            <p
              class="text-xs mt-2 flex items-center justify-center gap-1"
              :class="isHostImposter ? 'text-destructive/60' : 'text-flavor-melon-ink/60'"
            >
              <DifficultyIcon :difficulty="gameState.difficulty" class="size-3" />
              {{ gameState.difficulty }} {{ locale.imposter.hostScreen.difficultySuffix }}
            </p>
          </CardContent>
        </Card>

        <!-- Turn progress (describe phase only — the pinned vote panel covers
             the discussion phase). No transition: must reflect server state now. -->
        <Card v-if="screen === 'game'" class="mb-3">
          <CardContent class="pt-4">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-2">{{ locale.imposter.hostScreen.statusLabel }}</p>
            <div class="flex items-center gap-2 mb-3">
              <span class="w-2.5 h-2.5 bg-primary rounded-full animate-pulse-slow" />
              <span class="font-semibold">{{ locale.imposter.hostScreen.turnSuffix(gameState.currentTurnName) }}</span>
            </div>
            <Progress :model-value="turnProgress" />
            <p class="text-xs text-muted-foreground/70 mt-1.5">
              {{ locale.imposter.hostScreen.doneProgress(donePlayers, gameState.players.length) }}
            </p>
          </CardContent>
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
                class="flex items-center gap-2 py-2.5 px-3 rounded-2xl bg-secondary/40 border-2 border-border transition-colors hover:border-primary/40"
                :class="{ 'opacity-45': player.eliminated }"
              >
                <span class="text-xs text-muted-foreground/60 w-5 shrink-0">{{ idx + 1 }}</span>
                <span
                  :class="['w-2 h-2 rounded-full shrink-0', player.connected ? 'bg-primary' : 'bg-muted-foreground/30 animate-pulse-slow']"
                />
                <span class="flex-1 font-medium truncate" :class="{ 'text-muted-foreground/60': !player.connected }">{{ player.name }}</span>
                <span v-if="player.eliminated" class="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
                  {{ locale.imposter.hostScreen.outTag(player.eliminatedInRound) }}
                </span>
                <span v-else-if="!player.connected" class="text-[10px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
                  {{ locale.imposter.hostScreen.offlineTag }}
                </span>
                <button
                  v-if="!player.connected && player.id !== gameState.hostId"
                  class="shrink-0 p-1.5 rounded-lg text-destructive/80 hover:bg-destructive/10 active:scale-90 transition"
                  :aria-label="locale.imposter.hostScreen.removeOffline(player.name)"
                  @click="openRemove(player.id, player.name)"
                >
                  <UserMinus class="size-4" />
                </button>
                <Badge v-if="player.hasDone && screen === 'game'" class="animate-in zoom-in-50 duration-200"><Check class="size-3" /></Badge>
                <Badge
                  v-if="player.hasVoted && !player.eliminated && screen === 'discussion'" variant="warning"
                  class="animate-in zoom-in-50 duration-200">
                  <Vote class="size-3" />
                </Badge>
                <span v-if="player.lastGamePoints > 0" class="text-[11px] font-semibold text-flavor-melon-ink shrink-0">+{{ player.lastGamePoints }}</span>
                <span class="font-bold text-primary text-sm">{{ player.score }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <!-- (Voting + Done both live in the pinned areas, not this scroll area.) -->
        <AppFooter />
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="action-bar space-y-2" :class="{ 'action-bar--active': screen === 'game' && isHostTurn && !hostPlayer?.hasDone }">
      <div class="w-full max-w-md mx-auto space-y-2">
        <!-- The one Done button — host's own turn -->
        <Button
          v-if="screen === 'game' && isHostTurn"
          size="lg"
          class="w-full rounded-3xl font-display font-bold text-xl py-6
                 shadow-[0_0_40px_hsl(var(--primary)/0.45)]"
          :class="{ 'animate-bounce-once': !hostPlayer?.hasDone }"
          :disabled="hostPlayer?.hasDone"
          @click="$emit('player-done')"
        >
          <component :is="hostPlayer?.hasDone ? Hourglass : Check" class="size-5" />
          {{ hostPlayer?.hasDone ? locale.imposter.playerScreen.waitButton : locale.imposter.hostScreen.hostDoneButton }}
        </Button>

        <!-- Skip turn — describe phase, someone else is up -->
        <Button
          v-if="screen === 'game' && !isHostTurn"
          variant="secondary"
          class="w-full text-sm"
          size="sm"
          @click="$emit('skip-turn')"
        >
          <SkipForward class="size-4" />{{ locale.imposter.hostScreen.skipTurn(gameState.currentTurnName) }}
        </Button>

        <!-- New Word — full new round; confirmed because it's easy to misclick -->
        <Button
          v-if="screen === 'game' || screen === 'discussion'"
          variant="secondary"
          class="w-full text-sm"
          size="sm"
          @click="openConfirm('nextWord')"
        >
          <RefreshCw class="size-4" />{{ locale.imposter.hostScreen.nextWordButton }}
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

    <!-- Confirm dialog for host actions that are disruptive or easy to misclick -->
    <AlertDialog :open="confirmAction !== null" @update:open="(v) => { if (!v) closeConfirm() }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{ confirmCopy.title }}</AlertDialogTitle>
          <AlertDialogDescription :class="{ 'sr-only': !confirmCopy.body }">
            {{ confirmCopy.body || confirmCopy.title }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="closeConfirm">
            {{ locale.imposter.hostScreen.cancel }}
          </AlertDialogCancel>
          <AlertDialogAction :variant="confirmCopy.destructive ? 'destructive' : 'default'" @click="confirmAndExecute">
            {{ confirmCopy.button }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Check,
  Crown,
  Hourglass,
  OctagonX,
  Megaphone,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  UserMinus,
  VenetianMask,
  Vote,
} from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { GameState, PlayerAssignment, AppScreen } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import DifficultyIcon from './DifficultyIcon.vue'
import AppFooter from './AppFooter.vue'
import VotePanel from './VotePanel.vue'
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
  myVoteSelection: string
  screen: AppScreen
}>()

const emit = defineEmits<{
  'end-game': []
  'reset-scores': []
  select: [playerId: string]
  submit: []
  'force-reveal': []
  'player-done': []
  'skip-turn': []
  'change-word': []
  'remove-player': [playerId: string]
}>()

// ── Confirm state ─────────────────────────────────────────────────────────────
type ConfirmAction = 'reset' | 'end' | 'nextWord' | 'remove' | 'removeTooFew'
const confirmAction = ref<ConfirmAction | null>(null)
const removeTarget = ref<{ id: string; name: string } | null>(null)
// Captured (non-reactive) at trigger time: reka-ui's AlertDialogAction closes the
// dialog via its own internal handler, which fires *before* our own @click below
// and already resets `confirmAction` to null (via @update:open) by the time we'd
// read it — so the action to run is snapshotted here instead of re-read live.
let pendingExecute: (() => void) | null = null

const confirmCopy = computed(() => {
  const t = locale.imposter.hostScreen
  switch (confirmAction.value) {
    case 'reset':
      return { title: t.confirmReset, body: '', button: t.confirmResetButton, destructive: false }
    case 'end':
      return { title: t.confirmEnd, body: '', button: t.confirmEndButton, destructive: true }
    case 'nextWord':
      return { title: t.confirmNextWord, body: t.confirmNextWordBody, button: t.confirmNextWordButton, destructive: false }
    case 'remove':
      return {
        title: t.confirmRemove(removeTarget.value?.name ?? ''),
        body: t.confirmRemoveBody,
        button: t.confirmRemoveButton,
        destructive: true,
      }
    case 'removeTooFew':
      return {
        title: t.confirmRemoveTooFew(removeTarget.value?.name ?? ''),
        body: t.confirmRemoveTooFewBody,
        button: t.confirmEndButton,
        destructive: true,
      }
    default:
      return { title: '', body: '', button: '', destructive: false }
  }
})

function openConfirm(action: 'reset' | 'end' | 'nextWord') {
  confirmAction.value = action
  pendingExecute = () => {
    if (action === 'reset') {emit('reset-scores')}
    else if (action === 'end') {emit('end-game')}
    else if (action === 'nextWord') {emit('change-word')}
  }
}

function openRemove(id: string, name: string) {
  removeTarget.value = { id, name }
  // A game in progress needs ≥ 3 players. If removing this player would strand
  // it, offer to end the game instead.
  if (props.gameState.players.length <= 3) {
    confirmAction.value = 'removeTooFew'
    pendingExecute = () => emit('end-game')
    return
  }
  confirmAction.value = 'remove'
  pendingExecute = () => emit('remove-player', id)
}

function closeConfirm() {
  confirmAction.value = null
  removeTarget.value = null
  pendingExecute = null
}

function confirmAndExecute() {
  pendingExecute?.()
  pendingExecute = null
  confirmAction.value = null
  removeTarget.value = null
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
</script>

<style scoped>
.action-bar--active {
  border-top-color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.08);
}
</style>
