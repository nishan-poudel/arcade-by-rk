<template>
  <!--
    Transient overlay shown for a few seconds after each vote round. NOT a
    full-screen state — the discussion screen stays mounted underneath.
  -->
  <div
    class="fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none"
    style="top: max(4.5rem, calc(env(safe-area-inset-top) + 3.75rem))"
  >
    <div
      class="w-full max-w-sm rounded-3xl border-2 shadow-pop px-5 py-4 text-center backdrop-blur"
      :class="notice.wasImposter
        ? 'bg-flavor-melon-soft border-flavor-melon/50 text-flavor-melon-ink'
        : 'bg-destructive/15 border-destructive/50 text-foreground'"
    >
      <component
        :is="notice.wasImposter ? ShieldCheck : DoorOpen"
        class="size-8 mx-auto mb-1.5"
        :class="notice.wasImposter ? 'text-flavor-melon-ink' : 'text-destructive'"
      />
      <p class="font-display font-extrabold text-lg leading-tight">
        {{ notice.isMe ? locale.imposter.ejection.youAreOut : locale.imposter.ejection.votedOut(notice.ejectedName) }}
      </p>
      <p class="text-sm mt-1 text-foreground/80">
        <template v-if="notice.gameOver">
          {{ notice.outcome === 'crew' ? locale.imposter.roundReveal.crewWinTitle : locale.imposter.roundReveal.imposterWinTitle }}
        </template>
        <template v-else-if="notice.wasImposter">
          {{ locale.imposter.ejection.moreImpostersLeft(notice.remaining.imposters) }}
        </template>
        <template v-else>
          {{ locale.imposter.ejection.notImposter(notice.remaining.imposters + notice.remaining.crew) }}
        </template>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { DoorOpen, ShieldCheck } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import type { EjectionResult } from '../types/index.js'

defineProps<{ notice: EjectionResult & { isMe: boolean } }>()
</script>
