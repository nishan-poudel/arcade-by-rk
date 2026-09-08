<template>
  <Transition name="modal" appear>
    <div
      class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      @click.self="$emit('dismiss')"
    >
      <ConfettiBurst v-if="result.outcome === 'crew'" />

      <div
        ref="card"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        class="w-full max-w-sm rounded-3xl border-2 border-border bg-card shadow-pop
               max-h-[85dvh] overflow-y-auto scroll-area outline-none animate-pop-in"
        @keydown.esc="$emit('dismiss')"
      >
        <div
          class="text-center px-5 pt-6 pb-4 rounded-t-[calc(1.25rem)]"
          :class="result.outcome === 'crew'
            ? 'bg-flavor-melon-soft text-flavor-melon-ink'
            : 'bg-destructive/15 text-foreground'"
        >
          <component
            :is="result.outcome === 'crew' ? Trophy : VenetianMask"
            class="size-11 mx-auto mb-2"
            :class="result.outcome === 'crew' ? 'text-flavor-melon-ink' : 'text-destructive'"
          />
          <h2 class="text-2xl font-display font-extrabold leading-tight">
            {{ result.outcome === 'crew' ? locale.imposter.scoreModal.crewWin : locale.imposter.scoreModal.imposterWin }}
          </h2>
        </div>

        <ul class="px-4 py-3 space-y-1.5">
          <li
            v-for="(row, idx) in result.scores"
            :key="row.playerId"
            class="py-2.5 px-3 rounded-2xl border-2 transition-colors"
            :class="row.playerId === myId
              ? 'bg-primary/10 border-primary/40'
              : 'bg-secondary/40 border-border'"
          >
            <div class="flex items-center gap-3">
              <span class="text-xs text-muted-foreground/60 w-4 shrink-0 text-right">{{ idx + 1 }}</span>
              <span class="flex-1 min-w-0">
                <span class="font-semibold truncate block">{{ row.name }}</span>
                <span class="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span v-if="row.playerId === myId" class="text-primary font-semibold">{{ locale.imposter.scoreModal.youTag }}</span>
                  <span v-if="row.isImposter" class="text-destructive font-semibold">{{ locale.imposter.scoreModal.imposterTag }}</span>
                </span>
              </span>
              <span class="text-right shrink-0">
                <span
                  class="block text-lg font-display font-extrabold"
                  :class="row.points > 0 ? 'text-flavor-melon-ink' : 'text-muted-foreground/50'"
                >+{{ row.points }}</span>
                <span class="block text-[11px] text-muted-foreground">
                  {{ locale.imposter.scoreModal.total }} {{ row.total }}
                </span>
              </span>
            </div>
            <ul v-if="row.pointsBreakdown.length" class="mt-1.5 pl-7 space-y-0.5">
              <li
                v-for="line in row.pointsBreakdown"
                :key="line"
                class="text-[11px] text-muted-foreground flex items-center gap-1.5"
              >
                <span class="w-1 h-1 rounded-full bg-muted-foreground/40 shrink-0" />{{ line }}
              </li>
            </ul>
          </li>
        </ul>

        <div class="px-4 pb-4 pt-1">
          <Button
            class="w-full" size="lg"
            @click="$emit('dismiss')">
            {{ locale.imposter.scoreModal.done }}
          </Button>
          <p v-if="isHost" class="text-xs text-muted-foreground/70 text-center mt-2">
            {{ locale.imposter.scoreModal.hostNext }}
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Trophy, VenetianMask } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { GameResult } from '../types/index.js'
import { Button } from '@/components/ui/button'
import ConfettiBurst from './decor/ConfettiBurst.vue'

defineProps<{ result: GameResult; myId: string; isHost: boolean }>()
defineEmits<{ dismiss: [] }>()

const card = ref<HTMLElement | null>(null)
onMounted(() => card.value?.focus())
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
