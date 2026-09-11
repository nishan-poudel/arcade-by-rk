<template>
  <div class="mx-auto flex w-full max-w-sm flex-col gap-6 animate-slide-up">
    <div class="text-center">
      <h1 class="font-display text-3xl font-bold">{{ hub.brandTitle }}</h1>
      <p class="mt-2 text-sm text-muted-foreground">{{ t.landing.rulesLine1 }}</p>
      <p class="text-sm text-muted-foreground">{{ t.landing.rulesLine2 }}</p>
    </div>

    <ToggleGroup v-model="tab" class="grid grid-cols-2 gap-2">
      <ToggleGroupItem value="create" class="h-11">{{ t.landing.createHeading }}</ToggleGroupItem>
      <ToggleGroupItem value="join" class="h-11">{{ t.landing.joinHeading }}</ToggleGroupItem>
    </ToggleGroup>

    <Card v-if="tab === 'create'">
      <CardContent class="flex flex-col gap-4 pt-4">
        <div>
          <Label for="host-name">{{ t.landing.hostNameLabel }}</Label>
          <Input id="host-name" v-model="hostName" :placeholder="t.landing.namePlaceholder" maxlength="24" />
        </div>
        <Button size="lg" :disabled="!hostName.trim() || !!pending" @click="onCreate">
          {{ pending === 'create' ? t.landing.creatingButton : t.landing.createButton }}
        </Button>
      </CardContent>
    </Card>

    <Card v-else>
      <CardContent class="flex flex-col gap-4 pt-4">
        <div>
          <Label for="room-code">{{ t.landing.roomCodeLabel }}</Label>
          <Input
            id="room-code"
            v-model="roomCode"
            :placeholder="t.landing.roomCodePlaceholder"
            maxlength="6"
            class="uppercase tracking-widest"
            @input="roomCode = roomCode.toUpperCase()"
          />
        </div>
        <div>
          <Label for="player-name">{{ t.landing.yourNameLabel }}</Label>
          <Input id="player-name" v-model="playerName" :placeholder="t.landing.namePlaceholder" maxlength="24" />
        </div>
        <Button size="lg" :disabled="!canJoin || !!pending" @click="onJoin">
          {{ pending === 'join' ? t.landing.joiningButton : t.landing.joinButton }}
        </Button>
      </CardContent>
    </Card>

    <p v-if="game.errorMessage.value" class="text-center text-sm font-medium text-destructive">
      {{ game.errorMessage.value }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { en } from '@/locales/en'
import { useGame } from '../composables/useGame'

const props = defineProps<{ initialRoomCode?: string }>()

const hub = en.hub
const t = en.callBreak
const game = useGame()

const tab = ref<'create' | 'join'>(props.initialRoomCode ? 'join' : 'create')
const hostName = ref('')
const playerName = ref('')
const roomCode = ref(props.initialRoomCode?.toUpperCase() ?? '')

const pending = computed(() => game.pendingAction.value)
const canJoin = computed(() => roomCode.value.trim().length === 6 && playerName.value.trim().length > 0)

function onCreate() {
  game.createRoom(hostName.value.trim())
}

function onJoin() {
  game.joinRoom(roomCode.value.trim(), playerName.value.trim())
}
</script>
