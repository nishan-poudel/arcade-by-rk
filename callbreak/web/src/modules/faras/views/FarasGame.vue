<template>
  <div class="isolate flex min-h-dvh flex-col bg-background text-foreground">
    <AppBlob flavor="peach" size="22rem" class="fixed -left-24 -top-24 -z-10" />
    <AppBlob flavor="lychee" size="18rem" class="fixed -bottom-16 -right-16 -z-10" :delay="1.2" />

    <header class="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <RouterLink to="/" class="font-display text-lg font-bold text-foreground/80 hover:text-foreground">
        ← {{ t.common.backToHub }}
      </RouterLink>
      <div class="flex items-center gap-2">
        <span
          v-if="faras.state.value"
          class="rounded-full px-2.5 py-1 text-xs font-display font-semibold"
          :class="statusClass"
        >
          {{ statusLabel }}
        </span>
        <ResyncButton v-if="faras.state.value" :label="t.common.resyncButton" :resync="faras.requestState" />
        <ThemeToggle />
      </div>
    </header>

    <main class="screen flex-1 px-4 pb-8 pt-4">
      <LandingScreen v-if="faras.screen.value === 'landing'" :initial-room-code="initialRoomCode" />
      <WaitingRoom v-else-if="faras.screen.value === 'waitingRoom'" />
      <HandScreen v-else-if="faras.screen.value === 'hand'" />
      <HandResultScreen v-else-if="faras.screen.value === 'handResult'" />
      <GameOverScreen v-else-if="faras.screen.value === 'gameOver'" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppBlob from '@/components/decor/AppBlob.vue'
import ResyncButton from '@/components/ResyncButton.vue'
import ThemeToggle from '@/components/ui/theme-toggle/ThemeToggle.vue'
import { en } from '@/locales/en'
import { useFaras } from '../composables/useFaras'
import GameOverScreen from '../components/GameOverScreen.vue'
import HandResultScreen from '../components/HandResultScreen.vue'
import HandScreen from '../components/HandScreen.vue'
import LandingScreen from '../components/LandingScreen.vue'
import WaitingRoom from '../components/WaitingRoom.vue'

const t = en.faras
const route = useRoute()
const faras = useFaras()

const initialRoomCode = computed(() => (typeof route.params.roomCode === 'string' ? route.params.roomCode : ''))

const statusLabel = computed(() => {
  const s = faras.connectionState.value
  return s === 'online' ? t.common.online : s === 'reconnecting' ? t.common.reconnecting : t.common.offline
})
const statusClass = computed(() => {
  const s = faras.connectionState.value
  return s === 'online'
    ? 'bg-flavor-melon/20 text-flavor-melon-ink'
    : s === 'reconnecting'
      ? 'bg-warning/20 text-warning-foreground'
      : 'bg-destructive/15 text-destructive'
})

onMounted(() => {
  faras.attemptRejoin()
})
</script>
