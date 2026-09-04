<template>
  <!--
    Layout: fixed-height screen split into scrollable content + sticky Done button.
    The Done button stays in the thumb zone (bottom of screen) at all times.
  -->
  <div
    class="h-dvh flex flex-col"
    style="padding-top: max(1rem, env(safe-area-inset-top))"
  >
    <!-- Scrollable content area -->
    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <!-- Player header: name + score -->
        <div class="flex items-center justify-between mb-4 animate-fade-in">
          <div>
            <p class="text-muted-foreground text-xs uppercase tracking-wider">{{ locale.imposter.playerScreen.playerLabel }}</p>
            <h2 class="text-xl font-bold leading-tight">{{ me?.name ?? '—' }}</h2>
          </div>
          <div class="text-right">
            <p class="text-muted-foreground text-xs uppercase tracking-wider">{{ locale.imposter.playerScreen.scoreLabel }}</p>
            <p class="text-3xl font-extrabold text-primary">{{ me?.score ?? 0 }}</p>
          </div>
        </div>

        <!-- Role + secret word card: the most important info, takes centre stage -->
        <Card
          class="text-center mb-4 transition-all duration-300 shadow-pop"
          :class="myAssignment.role === 'imposter'
            ? 'border-destructive/60 bg-destructive/10'
            : 'border-primary/30 bg-primary/5'"
        >
          <CardContent class="pt-4">
            <Transition name="role" mode="out-in">
              <div
                v-if="myAssignment.role === 'crewmate'" key="crew"
                class="py-2">
                <p class="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-display font-semibold">{{ locale.imposter.playerScreen.yourRoleLabel }}</p>
                <p class="text-2xl font-bold mb-4">
                  <span class="font-extrabold text-primary">{{ locale.imposter.playerScreen.notImposterPrefix }}</span>
                  <span class="text-foreground"> {{ locale.imposter.playerScreen.notImposterSuffix }}</span>
                </p>
                <Separator class="mb-4" />
                <div>
                  <p class="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-display font-semibold">{{ locale.imposter.playerScreen.secretWordLabel }}</p>
                  <!-- Word is very large so it's easy to remember at a glance -->
                  <p class="text-5xl font-display font-bold tracking-tight leading-tight break-words text-primary">
                    {{ myAssignment.word }}
                  </p>
                </div>
              </div>
              <div
                v-else key="imp"
                class="py-2">
                <p class="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-display font-semibold">{{ locale.imposter.playerScreen.yourRoleLabel }}</p>
                <p class="text-2xl font-bold text-destructive mb-4 flex items-center justify-center gap-2">
                  <VenetianMask class="size-6" />{{ locale.imposter.playerScreen.imposterLabel }}
                </p>
                <Separator class="mb-4" />
                <div>
                  <p class="text-xs text-muted-foreground uppercase tracking-widest mb-2 font-display font-semibold">{{ locale.imposter.playerScreen.secretWordLabel }}</p>
                  <p class="text-5xl font-display font-bold text-muted-foreground/30">？？？</p>
                  <p class="text-xs text-destructive/70 mt-3">{{ locale.imposter.playerScreen.blendIn }}</p>
                </div>
              </div>
            </Transition>
          </CardContent>
        </Card>

        <!-- Current turn indicator -->
        <Card class="mb-4">
          <CardContent class="pt-4">
            <p class="text-xs text-muted-foreground uppercase tracking-widest mb-2">{{ locale.imposter.playerScreen.currentTurnLabel }}</p>
            <!--
              No enter/leave transition here on purpose: this text changes every
              turn (frequently, mid-round) and must always reflect the current
              server state immediately. A CSS/JS transition here would add
              latency and — if the tab is ever backgrounded at the wrong instant —
              can get stuck showing a stale player name until refocused.
            -->
            <div v-if="screen === 'discussion'" class="text-center py-2">
              <p class="text-2xl font-bold text-warning flex items-center justify-center gap-2">
                <MessagesSquare class="size-6" />{{ locale.imposter.playerScreen.discussionTitle }}
              </p>
              <p class="text-sm text-muted-foreground mt-1">{{ locale.imposter.playerScreen.discussionSub }}</p>
            </div>
            <div v-else class="flex items-center gap-3">
              <span
                :class="[
                  'w-3 h-3 rounded-full flex-shrink-0 transition-colors',
                  isMyTurn ? 'bg-primary animate-pulse-slow' : 'bg-muted-foreground/30',
                ]"
              />
              <span
                :class="[
                  'font-semibold text-lg',
                  isMyTurn ? 'text-primary' : 'text-foreground',
                ]"
              >
                {{ isMyTurn ? locale.imposter.playerScreen.yourTurn : gameState.currentTurnName }}
              </span>
            </div>
          </CardContent>
        </Card>

        <!-- In-app voting (discussion phase) -->
        <Transition name="panel">
          <Card v-if="screen === 'discussion'" class="mb-4 border-warning/20">
            <CardContent class="pt-4">
              <div class="flex items-center justify-between mb-3">
                <p class="text-xs text-muted-foreground uppercase tracking-widest">{{ locale.imposter.playerScreen.voteHeading }}</p>
                <Badge variant="secondary">{{ locale.imposter.playerScreen.votedOf(votedCount, totalVoters) }}</Badge>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in votablePlayers"
                  :key="p.id"
                  class="rounded-2xl py-3 px-2 border-2 text-sm font-display font-semibold transition-all duration-150 ease-bounce active:scale-95 flex items-center justify-center gap-1.5 truncate"
                  :class="myVote === p.id ? 'bg-destructive/20 border-destructive/60 text-destructive' : 'bg-secondary/40 border-border text-foreground/80'"
                  @click="$emit('submit-vote', p.id)"
                >
                  <Vote v-if="myVote === p.id" class="size-4" />
                  <span class="truncate">{{ p.name }}</span>
                </button>
              </div>
              <p class="text-xs text-muted-foreground/70 mt-3 text-center">
                <template v-if="myVote">{{ locale.imposter.playerScreen.votedForChange(votedName) }}</template>
                <template v-else>{{ locale.imposter.playerScreen.tapToVote }}</template>
              </p>
            </CardContent>
          </Card>
        </Transition>

        <!-- Compact scoreboard -->
        <Card>
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.imposter.playerScreen.scoresLabel }}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul class="space-y-1">
              <li
                v-for="(player, idx) in sortedPlayers"
                :key="player.id"
                :class="[
                  'flex items-center gap-3 py-2 px-2 rounded-lg',
                  player.id === myId ? 'bg-secondary/50' : '',
                ]"
              >
                <span class="text-xs text-muted-foreground/60 w-5 shrink-0">{{ idx + 1 }}</span>
                <span
                  :class="['w-2 h-2 rounded-full shrink-0', player.connected ? 'bg-primary' : 'bg-muted-foreground/30']"
                />
                <span class="flex-1 text-sm truncate">{{ player.name }}</span>
                <span class="font-bold text-primary">{{ player.score }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        <AppFooter />
      </div>
    </div>

    <!--
      Sticky Done button — lives in the action-bar so it stays at the bottom
      of the screen regardless of scroll position. Huge target for easy tapping.
      Visible only during 'game' phase.
    -->
    <div v-if="screen === 'game'" class="action-bar">
      <div class="w-full max-w-md mx-auto">
        <Transition name="btn-bounce" appear>
          <Button
            size="lg"
            :variant="isMyTurn && !me?.hasDone ? 'default' : 'secondary'"
            :class="[
              'w-full text-xl py-7 rounded-3xl font-display font-bold transition-all duration-150',
              isMyTurn && !me?.hasDone
                ? 'shadow-[0_0_40px_hsl(var(--primary)/0.45)] animate-bounce-once'
                : 'text-muted-foreground/50',
            ]"
            :disabled="!isMyTurn || me?.hasDone"
            @click="$emit('player-done')"
          >
            <component :is="isMyTurn && !me?.hasDone ? Check : Hourglass" class="size-5" />
            {{ isMyTurn && !me?.hasDone ? locale.imposter.playerScreen.doneButton : locale.imposter.playerScreen.waitButton }}
          </Button>
        </Transition>
      </div>
    </div>

    <!-- Discussion phase bottom message -->
    <div v-else-if="screen === 'discussion'" class="action-bar text-center">
      <p class="text-warning font-semibold flex items-center justify-center gap-2">
        <Vote class="size-4" />{{ locale.imposter.playerScreen.votedBottomBar(votedCount, totalVoters) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, Hourglass, MessagesSquare, VenetianMask, Vote } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { GameState, PlayerAssignment, AppScreen } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import AppFooter from './AppFooter.vue'

const props = defineProps<{
  gameState: GameState
  myId: string
  myAssignment: PlayerAssignment
  myVote: string
  isMyTurn: boolean
  screen: AppScreen
}>()

defineEmits<{ 'player-done': []; 'submit-vote': [playerId: string] }>()

const me = computed(() => props.gameState.players.find((p) => p.id === props.myId))

const sortedPlayers = computed(() =>
  [...props.gameState.players].sort((a, b) => b.score - a.score),
)

/** Everyone except me — valid vote targets */
const votablePlayers = computed(() => props.gameState.players.filter((p) => p.id !== props.myId))

const votedCount = computed(() => props.gameState.players.filter((p) => p.hasVoted).length)
const totalVoters = computed(() => props.gameState.players.length)

const votedName = computed(
  () => props.gameState.players.find((p) => p.id === props.myVote)?.name ?? '',
)
</script>

<style scoped>
.role-enter-active,
.role-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.role-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.role-leave-to {
  opacity: 0;
  transform: scale(1.04);
}
</style>
