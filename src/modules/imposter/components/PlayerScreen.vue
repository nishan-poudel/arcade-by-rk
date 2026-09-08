<template>
  <!--
    Layout: fixed-height screen. The pinned top block (outside the scroll area)
    holds the turn status during 'game' and the whole voting panel during
    'discussion', so neither ever needs scrolling. The one Done button lives in
    the bottom sticky bar.
  -->
  <div
    class="h-dvh flex flex-col"
    style="padding-top: max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))"
  >
    <!-- Pinned: turn status during describe -->
    <div v-if="screen === 'game'" class="px-4 pt-1 shrink-0">
      <div class="w-full max-w-md mx-auto">
        <Transition name="turn-banner" mode="out-in">
          <div
            v-if="isMyTurn && !me?.hasDone"
            key="mine"
            class="rounded-2xl border-2 border-primary bg-primary/15 px-4 py-3 text-center
                   shadow-[0_0_28px_hsl(var(--primary)/0.3)] animate-bounce-once"
          >
            <p class="text-lg font-display font-extrabold text-primary flex items-center justify-center gap-2">
              <Megaphone class="size-5" />{{ locale.imposter.playerScreen.yourTurnBanner }}
            </p>
            <p class="text-xs text-foreground/70 mt-0.5">{{ locale.imposter.playerScreen.yourTurnAction }}</p>
          </div>
          <div
            v-else-if="isMyTurn && me?.hasDone"
            key="done"
            class="rounded-2xl border-2 border-primary/40 bg-primary/10 px-4 py-2.5 text-center"
          >
            <p class="text-sm font-display font-bold text-primary flex items-center justify-center gap-2">
              <Check class="size-4" />{{ locale.imposter.playerScreen.doneWaitOthers }}
            </p>
          </div>
          <div
            v-else-if="isUpNext"
            key="next"
            class="rounded-2xl border-2 border-warning/50 bg-warning/10 px-4 py-2 text-center"
          >
            <p class="text-sm font-display font-bold text-warning flex items-center justify-center gap-2">
              <Hourglass class="size-4" />{{ locale.imposter.playerScreen.upNextBanner }}
            </p>
          </div>
          <div
            v-else
            key="wait"
            class="rounded-2xl border-2 border-border bg-secondary/40 px-4 py-2 text-center"
          >
            <p class="text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
              <span class="w-2 h-2 rounded-full bg-muted-foreground/40" />
              {{ locale.imposter.playerScreen.waitingTurn(gameState.currentTurnName) }}
            </p>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Pinned: the whole voting panel during discussion -->
    <VotePanel
      v-else-if="screen === 'discussion'"
      :game-state="gameState"
      :my-id="myId"
      :selection="myVoteSelection"
      :my-vote="myVote"
      :is-host="false"
      @select="$emit('select', $event)"
      @submit="$emit('submit')"
    />

    <!-- Scrollable content area -->
    <div ref="scrollArea" class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
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

        <!-- Role + secret word card: clean green (crewmate) / red (imposter) -->
        <Card
          class="text-center mb-4 shadow-pop border-2"
          :class="isImposter
            ? 'border-destructive/60 bg-destructive/10'
            : 'border-flavor-melon/50 bg-flavor-melon-soft'"
        >
          <CardContent class="pt-5 pb-5">
            <p
              class="text-2xl font-display font-extrabold mb-4 flex items-center justify-center gap-2 tracking-wide"
              :class="isImposter ? 'text-destructive' : 'text-flavor-melon-ink'"
            >
              <component :is="isImposter ? VenetianMask : ShieldCheck" class="size-6" />
              {{ isImposter ? locale.imposter.playerScreen.imposterLabel : locale.imposter.playerScreen.crewmateLabel }}
            </p>

            <p
              class="text-xs uppercase tracking-widest mb-2 font-display font-semibold"
              :class="isImposter ? 'text-destructive/70' : 'text-flavor-melon-ink/70'"
            >
              {{ isImposter && myAssignment.hint ? locale.imposter.playerScreen.imposterHintLabel : locale.imposter.playerScreen.secretWordLabel }}
            </p>

            <p
              v-if="!isImposter"
              class="text-5xl font-display font-bold tracking-tight leading-tight break-words text-flavor-melon-ink"
            >
              {{ myAssignment.word }}
            </p>
            <template v-else>
              <p
                v-if="myAssignment.hint"
                class="text-5xl font-display font-bold tracking-tight leading-tight break-words text-destructive"
              >
                {{ myAssignment.hint }}
              </p>
              <p v-else class="text-5xl font-display font-bold text-muted-foreground/30">？？？</p>
              <p class="text-xs text-destructive/70 mt-3">
                {{ myAssignment.hint ? locale.imposter.playerScreen.imposterHintSub : locale.imposter.playerScreen.blendIn }}
              </p>
            </template>
          </CardContent>
        </Card>

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
                  player.eliminated ? 'opacity-45' : '',
                ]"
              >
                <span class="text-xs text-muted-foreground/60 w-5 shrink-0">{{ idx + 1 }}</span>
                <span
                  :class="['w-2 h-2 rounded-full shrink-0', player.connected ? 'bg-primary' : 'bg-muted-foreground/30']"
                />
                <span class="flex-1 text-sm truncate">
                  <span class="truncate">{{ player.name }}</span>
                  <span v-if="player.eliminated" class="text-[10px] uppercase tracking-wider text-muted-foreground/70 ml-1.5">
                    {{ locale.imposter.playerScreen.outTag(player.eliminatedInRound) }}
                  </span>
                </span>
                <span v-if="player.lastGamePoints > 0" class="text-[11px] font-semibold text-flavor-melon-ink shrink-0">
                  +{{ player.lastGamePoints }}
                </span>
                <span class="font-bold text-primary">{{ player.score }}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
        <AppFooter />
      </div>
    </div>

    <!--
      The single Done button. Always in the thumb zone for the whole describe
      phase — active + glowing on your turn, muted otherwise.
    -->
    <div
      v-if="screen === 'game'"
      class="action-bar"
      :class="{ 'action-bar--active': isMyTurn && !me?.hasDone }"
    >
      <div class="w-full max-w-md mx-auto">
        <Button
          size="lg"
          :variant="isMyTurn && !me?.hasDone ? 'default' : 'secondary'"
          :class="[
            'w-full rounded-3xl font-display font-bold transition-all duration-150',
            isMyTurn && !me?.hasDone
              ? 'text-2xl py-7 shadow-[0_0_44px_hsl(var(--primary)/0.5)] animate-bounce-once'
              : 'text-lg py-6 text-muted-foreground/50',
          ]"
          :disabled="!isMyTurn || me?.hasDone"
          @click="$emit('player-done')"
        >
          <component :is="isMyTurn && !me?.hasDone ? Check : Hourglass" class="size-6" />
          {{ isMyTurn && !me?.hasDone ? locale.imposter.playerScreen.doneButton : locale.imposter.playerScreen.waitButton }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { Check, Hourglass, Megaphone, ShieldCheck, VenetianMask } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { GameState, PlayerAssignment, AppScreen } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import AppFooter from './AppFooter.vue'
import VotePanel from './VotePanel.vue'

const props = defineProps<{
  gameState: GameState
  myId: string
  myAssignment: PlayerAssignment
  myVote: string
  myVoteSelection: string
  isMyTurn: boolean
  screen: AppScreen
}>()

defineEmits<{ 'player-done': []; select: [playerId: string]; submit: [] }>()

const me = computed(() => props.gameState.players.find((p) => p.id === props.myId))
const isImposter = computed(() => props.myAssignment.role === 'imposter')

const scrollArea = ref<HTMLElement | null>(null)

/** True when I'm the very next player to go (banner: "you're up next"). */
const isUpNext = computed(
  () => !props.isMyTurn && props.gameState.nextTurnPlayerId === props.myId,
)

// When my turn starts: buzz the phone and scroll the content back to the top so
// the "IT'S YOUR TURN" banner (and the pinned Done button) are both in view.
watch(
  () => props.isMyTurn && props.screen === 'game' && !me.value?.hasDone,
  (mine, wasMine) => {
    if (mine && !wasMine) {
      try { navigator.vibrate?.([120, 60, 120]) } catch { /* not supported */ }
      nextTick(() => scrollArea.value?.scrollTo({ top: 0, behavior: 'smooth' }))
    }
  },
)

const sortedPlayers = computed(() =>
  [...props.gameState.players].sort((a, b) => b.score - a.score),
)
</script>

<style scoped>
/* Turn banner swap */
.turn-banner-enter-active,
.turn-banner-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.4, 0.5, 1);
}
.turn-banner-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.96);
}
.turn-banner-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* Extra emphasis on the action bar when it's the player's turn */
.action-bar--active {
  border-top-color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.08);
}
</style>
