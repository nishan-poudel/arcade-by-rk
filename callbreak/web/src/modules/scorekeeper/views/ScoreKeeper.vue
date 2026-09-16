<template>
  <div class="isolate flex min-h-dvh flex-col bg-background text-foreground">
    <AppBlob flavor="lychee" size="20rem" class="fixed -left-20 -top-20 -z-10" />
    <AppBlob flavor="melon" size="18rem" class="fixed -bottom-16 -right-16 -z-10" :delay="1.2" />

    <header class="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <RouterLink to="/" class="font-display text-lg font-bold text-foreground/80 hover:text-foreground">
        ← {{ t.common.backToHub }}
      </RouterLink>
      <div class="flex items-center gap-2">
        <span
          v-if="score.state.value"
          class="rounded-full px-2.5 py-1 text-xs font-display font-semibold"
          :class="statusClass"
        >
          {{ statusLabel }}
        </span>
        <ResyncButton v-if="score.state.value" :label="t.common.resyncButton" :resync="score.requestState" />
        <ThemeToggle />
      </div>
    </header>

    <main class="screen flex-1 px-4 pb-8 pt-4">
      <LandingScreen v-if="score.screen.value === 'landing'" :initial-room-code="initialRoomCode" />
      <WaitingRoom v-else-if="score.screen.value === 'waitingRoom'" />
      <RoundEntryScreen v-else-if="score.screen.value === 'roundEntry'" />
      <Leaderboard v-else-if="score.screen.value === 'roundResult'" />
      <GameOverScreen v-else-if="score.screen.value === 'gameOver'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppBlob from '@/components/decor/AppBlob.vue'
import ResyncButton from '@/components/ResyncButton.vue'
import ThemeToggle from '@/components/ui/theme-toggle/ThemeToggle.vue'
import { en } from '@/locales/en'
import GameOverScreen from '../components/GameOverScreen.vue'
import LandingScreen from '../components/LandingScreen.vue'
import Leaderboard from '../components/Leaderboard.vue'
import RoundEntryScreen from '../components/RoundEntryScreen.vue'
import WaitingRoom from '../components/WaitingRoom.vue'
import { useScoreRoom } from '../composables/useScoreRoom'

const t = en.scoreKeeper
const route = useRoute()
const score = useScoreRoom()

const initialRoomCode = computed(() => (typeof route.params.roomCode === 'string' ? route.params.roomCode : ''))

const statusLabel = computed(() => {
  const s = score.connectionState.value
  return s === 'online' ? t.common.online : s === 'reconnecting' ? t.common.reconnecting : t.common.offline
})
const statusClass = computed(() => {
  const s = score.connectionState.value
  return s === 'online'
    ? 'bg-flavor-melon/20 text-flavor-melon-ink'
    : s === 'reconnecting'
      ? 'bg-warning/20 text-warning-foreground'
      : 'bg-destructive/15 text-destructive'
})

onMounted(() => {
  score.attemptRejoin()
})

// Leaving this route (e.g. "Back to hub" from a finished session) tears
// down the connection and clears in-memory state, so the next visit
// starts fresh instead of instantly showing whatever screen this session
// last had — see the comment on disconnectOnly() for why that's needed.
onUnmounted(() => {
  score.disconnectOnly()
})
</script>
