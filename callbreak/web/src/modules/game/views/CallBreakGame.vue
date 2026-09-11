<template>
  <div class="isolate flex min-h-dvh flex-col bg-background text-foreground">
    <AppBlob flavor="grape" size="22rem" class="fixed -left-24 -top-24 -z-10" />
    <AppBlob flavor="citron" size="18rem" class="fixed -bottom-16 -right-16 -z-10" :delay="1.2" />

    <header class="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <RouterLink to="/" class="font-display text-lg font-bold text-foreground/80 hover:text-foreground">
        ← {{ t.common.backToHub }}
      </RouterLink>
      <div class="flex items-center gap-2">
        <span
          v-if="game.state.value"
          class="rounded-full px-2.5 py-1 text-xs font-display font-semibold"
          :class="statusClass"
        >
          {{ statusLabel }}
        </span>
        <ThemeToggle />
      </div>
    </header>

    <main class="screen flex-1 px-4 pb-8 pt-4">
      <LandingScreen v-if="game.screen.value === 'landing'" :initial-room-code="initialRoomCode" />
      <WaitingRoom v-else-if="game.screen.value === 'waitingRoom'" />
      <BidPanel v-else-if="game.screen.value === 'bidding'" />
      <TrickPlayScreen v-else-if="game.screen.value === 'trickPlay'" />
      <RoundResultScreen v-else-if="game.screen.value === 'roundResult'" />
      <GameOverScreen v-else-if="game.screen.value === 'gameOver'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppBlob from '@/components/decor/AppBlob.vue'
import ThemeToggle from '@/components/ui/theme-toggle/ThemeToggle.vue'
import { en } from '@/locales/en'
import BidPanel from '../components/BidPanel.vue'
import GameOverScreen from '../components/GameOverScreen.vue'
import LandingScreen from '../components/LandingScreen.vue'
import RoundResultScreen from '../components/RoundResultScreen.vue'
import TrickPlayScreen from '../components/TrickPlayScreen.vue'
import WaitingRoom from '../components/WaitingRoom.vue'
import { useGame } from '../composables/useGame'

const t = en.callBreak
const route = useRoute()
const game = useGame()

const initialRoomCode = computed(() => (typeof route.params.roomCode === 'string' ? route.params.roomCode : ''))

const statusLabel = computed(() => {
  const s = game.connectionState.value
  return s === 'online' ? t.common.online : s === 'reconnecting' ? t.common.reconnecting : t.common.offline
})
const statusClass = computed(() => {
  const s = game.connectionState.value
  return s === 'online'
    ? 'bg-flavor-melon/20 text-flavor-melon-ink'
    : s === 'reconnecting'
      ? 'bg-warning/20 text-warning-foreground'
      : 'bg-destructive/15 text-destructive'
})

onMounted(() => {
  game.attemptRejoin()
})
</script>
