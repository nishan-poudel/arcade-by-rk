<template>
  <div class="h-dvh flex flex-col" style="padding-top: max(3.25rem, calc(env(safe-area-inset-top) + 2.5rem))">
    <!-- Pinned: progress + host force -->
    <div class="px-4 pt-1 shrink-0">
      <div class="w-full max-w-md mx-auto rounded-2xl border-2 border-border bg-secondary/40 px-4 py-2 flex items-center justify-between">
        <span class="text-sm font-medium text-muted-foreground">{{ locale.traitor.answer.answeredOf(answeredCount, gameState.players.length) }}</span>
        <button
          v-if="isHost"
          type="button"
          class="text-xs text-muted-foreground/80 hover:text-foreground/90 flex items-center gap-1.5"
          @click="$emit('force-reveal')"
        >
          <Zap class="size-3.5" />{{ locale.traitor.answer.forceReveal }}
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-4 scroll-area">
      <div class="w-full max-w-md mx-auto">
        <div class="flex items-center justify-between mb-4 animate-fade-in">
          <div>
            <p class="text-muted-foreground text-xs uppercase tracking-wider">
              {{ locale.traitor.answer.roundLabel(gameState.round, gameState.totalRounds) }}
            </p>
            <h2 class="text-xl font-bold leading-tight">{{ me?.name ?? '—' }}</h2>
          </div>
          <div class="text-right">
            <p class="text-muted-foreground text-xs uppercase tracking-wider">{{ locale.traitor.answer.scoresLabel }}</p>
            <p class="text-3xl font-extrabold text-primary">{{ me?.score ?? 0 }}</p>
          </div>
        </div>

        <!-- Role + question card -->
        <Card
          class="text-center mb-4 shadow-pop border-2"
          :class="isTraitor ? 'border-destructive/60 bg-destructive/10' : 'border-flavor-melon/50 bg-flavor-melon-soft'"
        >
          <CardContent class="pt-5 pb-5">
            <p
              class="text-2xl font-display font-extrabold mb-3 flex items-center justify-center gap-2 tracking-wide"
              :class="isTraitor ? 'text-destructive' : 'text-flavor-melon-ink'"
            >
              <component :is="isTraitor ? Drama : ShieldCheck" class="size-6" />
              {{ isTraitor ? locale.traitor.answer.traitorLabel : locale.traitor.answer.detectiveLabel }}
            </p>
            <p
              class="text-xs uppercase tracking-widest mb-2 font-display font-semibold"
              :class="isTraitor ? 'text-destructive/70' : 'text-flavor-melon-ink/70'"
            >
              {{ locale.traitor.answer.yourQuestionLabel }}
            </p>
            <p class="text-2xl font-display font-bold leading-snug break-words" :class="isTraitor ? 'text-destructive' : 'text-flavor-melon-ink'">
              {{ myAssignment?.prompt ?? '…' }}
            </p>
            <p class="text-xs mt-3" :class="isTraitor ? 'text-destructive/70' : 'text-flavor-melon-ink/70'">
              {{ isTraitor ? locale.traitor.answer.traitorBlend : locale.traitor.answer.keepPrivate }}
            </p>
          </CardContent>
        </Card>

        <!-- Pick a player -->
        <Card>
          <CardHeader>
            <CardTitle class="text-xs normal-case">{{ locale.traitor.answer.pickPrompt }}</CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="locked" class="rounded-xl border-2 border-flavor-melon/50 bg-flavor-melon-soft px-3 py-3 text-center">
              <p class="text-sm font-display font-bold text-flavor-melon-ink flex items-center justify-center gap-1.5">
                <Check class="size-4" />{{ locale.traitor.answer.lockedFor(lockedName) }}
              </p>
              <p class="text-[11px] text-flavor-melon-ink/70 mt-0.5">{{ locale.traitor.answer.waitingOthers }}</p>
            </div>
            <template v-else>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="p in pickablePlayers"
                  :key="p.id"
                  type="button"
                  class="rounded-2xl py-3 px-2 border-2 text-sm font-display font-semibold transition-all duration-150 ease-bounce active:scale-95 flex items-center justify-center gap-1.5"
                  :class="myAnswerSelection === p.id ? 'bg-primary/20 border-primary/60 text-primary' : 'bg-secondary/40 border-border text-foreground/80'"
                  @click="$emit('select', p.id)"
                >
                  <span>{{ p.avatar }}</span><span class="truncate">{{ p.name }}</span>
                </button>
              </div>
              <p class="text-[11px] text-muted-foreground/70 text-center mt-2">
                {{ myAnswerSelection ? locale.traitor.answer.confirmHint : locale.traitor.answer.pickHint }}
              </p>
            </template>
          </CardContent>
        </Card>

        <AppFooter />
      </div>
    </div>

    <!-- Sticky action bar -->
    <div class="action-bar" :class="{ 'action-bar--active': !locked && !!myAnswerSelection }">
      <div class="w-full max-w-md mx-auto">
        <Button
          size="lg"
          class="w-full rounded-3xl font-display font-bold text-lg py-6"
          :disabled="locked || !myAnswerSelection"
          @click="$emit('submit')"
        >
          <component :is="locked ? Hourglass : Check" class="size-5" />
          {{ locked ? locale.traitor.answer.waitingOthers : locale.traitor.answer.lockIn }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Check, Drama, Hourglass, ShieldCheck, Zap } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { TraitorGameState, RoundAssignment } from '../types/index.js'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import AppFooter from './AppFooter.vue'

const props = defineProps<{
  gameState: TraitorGameState
  myId: string
  myAssignment: RoundAssignment | null
  myAnswer: string
  myAnswerSelection: string
  isHost: boolean
}>()

defineEmits<{ select: [id: string]; submit: []; 'force-reveal': [] }>()

const me = computed(() => props.gameState.players.find((p) => p.id === props.myId))
const isTraitor = computed(() => props.myAssignment?.role === 'traitor')
const pickablePlayers = computed(() => props.gameState.players.filter((p) => p.id !== props.myId))
const answeredCount = computed(() => props.gameState.players.filter((p) => p.hasAnswered).length)
const locked = computed(() => !!me.value?.hasAnswered || !!props.myAnswer)
const lockedName = computed(() => props.gameState.players.find((p) => p.id === props.myAnswer)?.name ?? '')
</script>

<style scoped>
.action-bar--active {
  border-top-color: hsl(var(--primary));
  background: hsl(var(--primary) / 0.08);
}
</style>
