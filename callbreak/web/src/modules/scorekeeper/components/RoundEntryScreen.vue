<template>
  <div v-if="state" class="mx-auto flex w-full max-w-sm flex-col gap-5 animate-slide-up">
    <div class="text-center">
      <h2 class="font-display text-2xl font-bold">{{ t.roundEntry.title(state.round + 1) }}</h2>
      <p class="mt-1 font-display text-sm font-bold text-primary">
        {{ allCallsLocked ? t.roundEntry.tricksStepLabel : t.roundEntry.callStepLabel }}
      </p>
    </div>

    <div class="flex flex-wrap justify-center gap-2">
      <button
        v-for="(p, seat) in state.players"
        :key="seat"
        type="button"
        class="flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-display font-bold transition-all"
        :class="[chipClass(seat), justLockedSeat === seat ? 'animate-bounce-once' : '']"
        :disabled="!score.isHost.value || !isUnlockable(seat)"
        @click="isUnlockable(seat) && unlockSeat(seat)"
      >
        <Check v-if="isSeatDone(seat)" class="h-3.5 w-3.5" />
        {{ p?.name }}
        <span v-if="state.pendingEntries[seat].callLocked" class="font-normal opacity-80">
          {{ state.pendingEntries[seat].call }}<template v-if="state.pendingEntries[seat].tricksLocked">/{{ state.pendingEntries[seat].tricksWon }}</template>
        </span>
      </button>
    </div>

    <Transition name="pop" mode="out-in">
      <!-- Step 1: go around the table asking each player's call. -->
      <Card v-if="score.isHost.value && !allCallsLocked && currentCallSeat !== -1" :key="`call-${currentCallSeat}`">
        <CardContent class="flex flex-col items-center gap-4 pt-6">
          <p class="text-center font-display text-lg font-bold">🎯 {{ t.roundEntry.askCall(currentCallName) }}</p>
          <div class="grid w-full grid-cols-5 gap-2">
            <button
              v-for="n in MAX_CALL"
              :key="n"
              type="button"
              class="aspect-square rounded-xl border-2 border-border bg-secondary/40 font-display text-lg font-bold shadow-hard-sm transition-transform active:scale-90 hover:border-primary hover:bg-primary/10"
              @click="score.lockCall(currentCallSeat, n)"
            >
              {{ n }}
            </button>
          </div>
        </CardContent>
      </Card>

      <!-- Step 2: once every call is in, go around again asking tricks won. -->
      <Card v-else-if="score.isHost.value && allCallsLocked && currentTricksSeat !== -1" :key="`tricks-${currentTricksSeat}`">
        <CardContent class="flex flex-col items-center gap-4 pt-6">
          <span class="rounded-full bg-secondary px-3 py-1 text-xs font-display font-bold text-muted-foreground">
            🃏 {{ t.roundEntry.tricksRemaining(remainingTricks) }}
          </span>

          <template v-if="isLastTricksSeat">
            <p class="text-center font-display text-lg font-bold">{{ t.roundEntry.lastOneLeft(currentTricksName) }}</p>
            <Button size="lg" class="w-full" @click="score.lockTricks(currentTricksSeat, remainingTricks)">
              {{ t.roundEntry.lockInLastTricks(remainingTricks) }}
            </Button>
          </template>
          <template v-else>
            <p class="text-center font-display text-lg font-bold">{{ t.roundEntry.askTricks(currentTricksName) }}</p>
            <div class="grid w-full grid-cols-5 gap-2">
              <button
                v-for="n in tricksOptions"
                :key="n"
                type="button"
                class="aspect-square rounded-xl border-2 border-border bg-secondary/40 font-display text-lg font-bold shadow-hard-sm transition-transform active:scale-90 hover:border-primary hover:bg-primary/10"
                @click="score.lockTricks(currentTricksSeat, n)"
              >
                {{ n }}
              </button>
            </div>
          </template>
        </CardContent>
      </Card>
    </Transition>

    <p v-if="!score.isHost.value" class="text-center text-sm text-muted-foreground">{{ t.roundEntry.onlyHostCanSubmit }}</p>
    <p v-if="score.errorMessage.value" class="text-center text-sm font-medium text-destructive">{{ score.errorMessage.value }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check } from '@lucide/vue'
import { MAX_CALL } from '@callbreak/shared-logic'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { en } from '@/locales/en'
import { useScoreRoom } from '../composables/useScoreRoom'

const t = en.scoreKeeper
const score = useScoreRoom()
const state = computed(() => score.state.value)

const currentCallSeat = computed(() => state.value?.pendingEntries.findIndex((e) => !e.callLocked) ?? -1)
const allCallsLocked = computed(() => currentCallSeat.value === -1)
const currentTricksSeat = computed(() => state.value?.pendingEntries.findIndex((e) => !e.tricksLocked) ?? -1)

const currentCallName = computed(() => (currentCallSeat.value === -1 ? '' : (state.value?.players[currentCallSeat.value]?.name ?? '')))
const currentTricksName = computed(() =>
  currentTricksSeat.value === -1 ? '' : (state.value?.players[currentTricksSeat.value]?.name ?? ''),
)

const lockedTricksSum = computed(
  () => state.value?.pendingEntries.reduce((sum, e) => sum + (e.tricksLocked ? (e.tricksWon ?? 0) : 0), 0) ?? 0,
)
const remainingTricks = computed(() => 13 - lockedTricksSum.value)
const tricksOptions = computed(() => Array.from({ length: remainingTricks.value + 1 }, (_, i) => i))
const isLastTricksSeat = computed(() => (state.value?.pendingEntries.filter((e) => e.tricksLocked).length ?? 0) === 3)

function isSeatDone(seat: number): boolean {
  const e = state.value?.pendingEntries[seat]
  if (!e) return false
  return allCallsLocked.value ? e.tricksLocked : e.callLocked
}

function isUnlockable(seat: number): boolean {
  const e = state.value?.pendingEntries[seat]
  return !!e && (e.callLocked || e.tricksLocked)
}

function unlockSeat(seat: number): void {
  const e = state.value?.pendingEntries[seat]
  if (!e) return
  if (e.tricksLocked) score.unlockTricks(seat)
  else if (e.callLocked) score.unlockCall(seat)
}

function chipClass(seat: number): string {
  if (isSeatDone(seat)) return 'border-flavor-melon/50 bg-flavor-melon/10 text-foreground'
  if (seat === (allCallsLocked.value ? currentTricksSeat.value : currentCallSeat.value)) {
    return 'border-primary bg-primary/10 text-primary shadow-pop animate-pulse-slow'
  }
  return 'border-border bg-secondary/20 text-muted-foreground'
}

// A quick bounce on whichever chip just flipped to "done", for a little
// tactile payoff each time the host locks something in.
const justLockedSeat = ref<number | null>(null)
watch(
  () => state.value?.pendingEntries.map((e) => (e.tricksLocked ? 'T' : e.callLocked ? 'C' : '')).join(''),
  (curr, prev) => {
    if (!curr || !prev || curr.length !== prev.length) return
    for (let seat = 0; seat < curr.length; seat++) {
      if (curr[seat] !== prev[seat] && curr[seat] !== '') {
        justLockedSeat.value = seat
        setTimeout(() => {
          if (justLockedSeat.value === seat) justLockedSeat.value = null
        }, 500)
      }
    }
  },
)
</script>

<style scoped>
.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s var(--ease-bounce, cubic-bezier(0.34, 1.4, 0.5, 1));
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(6px) scale(0.96);
}
</style>
