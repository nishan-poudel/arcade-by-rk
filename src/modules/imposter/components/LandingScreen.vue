<template>
  <!--
    Full-screen container using dvh so it fills exactly the visible
    viewport on mobile (accounts for browser chrome hiding/showing).
    A max-width wrapper keeps the form comfortably centred on tablet/desktop.
  -->
  <div
    class="min-h-dvh flex flex-col bg-background bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.12),_transparent_55%)] px-5"
    style="padding-top: max(2.5rem, env(safe-area-inset-top))"
  >
    <div class="w-full max-w-md mx-auto flex flex-col flex-1">
      <!-- Brand header -->
      <div class="text-center pt-4 pb-6 animate-fade-in">
        <VenetianMask class="size-12 mb-3 mx-auto text-primary" stroke-width="1.5" />
        <h1 class="text-3xl font-extrabold tracking-tight">{{ locale.imposter.common.brandTitle }}</h1>
        <p class="text-muted-foreground mt-1 text-sm">{{ locale.imposter.common.brandTagline }}</p>
      </div>

      <div class="flex flex-col gap-5">
        <!-- Tab selector: big enough to tap comfortably -->
        <div class="inline-flex w-full items-center gap-1 rounded-2xl bg-secondary/60 p-1">
          <button
            type="button"
            :class="[
              'flex-1 min-h-[44px] rounded-xl text-sm font-bold transition-all',
              tab === 'create' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground',
            ]"
            @click="tab = 'create'"
          >
            {{ locale.imposter.landing.createTab }}
          </button>
          <button
            type="button"
            :class="[
              'flex-1 min-h-[44px] rounded-xl text-sm font-bold transition-all',
              tab === 'join' ? 'bg-primary text-primary-foreground shadow-lg' : 'text-muted-foreground',
            ]"
            @click="tab = 'join'"
          >
            {{ locale.imposter.landing.joinTab }}
          </button>
        </div>

        <!-- Create form -->
        <div v-if="tab === 'create'" class="animate-slide-up">
          <Card class="p-1">
            <CardHeader>
              <CardTitle class="text-lg normal-case tracking-normal">{{ locale.imposter.landing.createHeading }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-5">
              <div>
                <Label>{{ locale.imposter.landing.hostNameLabel }}</Label>
                <Input
                  v-model="createForm.hostName"
                  :placeholder="locale.imposter.landing.namePlaceholder"
                  maxlength="24"
                  autocomplete="off"
                  autocapitalize="words"
                  @keyup.enter="submitCreate"
                />
              </div>

              <div>
                <Label>{{ locale.imposter.landing.difficultyLabel }}</Label>
                <ToggleGroup
                  :model-value="createForm.difficulty"
                  @update:model-value="(v) => createForm.difficulty = v as Difficulty"
                >
                  <ToggleGroupItem value="easy">
                    <DifficultyIcon difficulty="easy" />{{ locale.imposter.difficulty.easy }}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="medium">
                    <DifficultyIcon difficulty="medium" />{{ locale.imposter.difficulty.medium }}
                  </ToggleGroupItem>
                  <ToggleGroupItem value="hard">
                    <DifficultyIcon difficulty="hard" />{{ locale.imposter.difficulty.hard }}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <!-- Imposter count with big visual buttons instead of range slider -->
              <div>
                <Label>{{ locale.imposter.landing.impostersLabel }}</Label>
                <ToggleGroup
                  :model-value="String(createForm.imposterCount)"
                  @update:model-value="(v) => createForm.imposterCount = Number(v)"
                >
                  <ToggleGroupItem
                    v-for="n in 4" :key="n"
                    :value="String(n)" class="min-h-[52px] text-lg">
                    {{ n }}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Button
                size="lg"
                class="w-full"
                :disabled="!createForm.hostName.trim() || pendingAction !== null"
                @click="submitCreate"
              >
                <Loader2Icon v-if="pendingAction === 'create'" class="animate-spin" />
                {{ pendingAction === 'create' ? locale.imposter.landing.creatingButton : locale.imposter.landing.createButton }}
              </Button>

              <p
                v-if="pendingAction === 'create' && isSlowConnection"
                class="text-center text-xs text-muted-foreground -mt-2 animate-fade-in"
              >
                {{ locale.imposter.landing.slowConnectionHint }}
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- Join form -->
        <div v-else class="animate-slide-up">
          <Card class="p-1">
            <CardHeader>
              <CardTitle class="text-lg normal-case tracking-normal">{{ locale.imposter.landing.joinHeading }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-5">
              <div>
                <Label>{{ locale.imposter.landing.roomCodeLabel }}</Label>
                <!--
                  autocorrect=off + spellcheck=false prevents iOS suggesting corrections
                  on the 6-char room code
                -->
                <Input
                  :model-value="joinForm.roomCode"
                  class="font-mono tracking-[0.4em] text-2xl text-center uppercase"
                  :placeholder="locale.imposter.landing.roomCodePlaceholder"
                  maxlength="6"
                  autocomplete="off"
                  autocorrect="off"
                  autocapitalize="characters"
                  spellcheck="false"
                  inputmode="text"
                  @update:model-value="(v) => joinForm.roomCode = v.toUpperCase()"
                  @keyup.enter="submitJoin"
                />
              </div>

              <div>
                <Label>{{ locale.imposter.landing.yourNameLabel }}</Label>
                <Input
                  v-model="joinForm.playerName"
                  :placeholder="locale.imposter.landing.namePlaceholder"
                  maxlength="24"
                  autocomplete="off"
                  autocapitalize="words"
                  @keyup.enter="submitJoin"
                />
              </div>

              <Button
                size="lg"
                class="w-full"
                :disabled="!joinForm.roomCode.trim() || !joinForm.playerName.trim() || pendingAction !== null"
                @click="submitJoin"
              >
                <Loader2Icon v-if="pendingAction === 'join'" class="animate-spin" />
                {{ pendingAction === 'join' ? locale.imposter.landing.joiningButton : locale.imposter.landing.joinButton }}
              </Button>

              <p
                v-if="pendingAction === 'join' && isSlowConnection"
                class="text-center text-xs text-muted-foreground -mt-2 animate-fade-in"
              >
                {{ locale.imposter.landing.slowConnectionHint }}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Rules at bottom -->
      <div class="mt-auto pt-6 text-center text-muted-foreground/60 text-xs space-y-1">
        <p>{{ locale.imposter.landing.rulesLine1 }}</p>
        <p>{{ locale.imposter.landing.rulesLine2 }}</p>
      </div>

      <!--
        Footer — simple attribution with a hidden easter egg: tapping the
        name spins it around to reveal the real name underneath (and spins
        back if tapped again). Purely decorative, local-only state.
      -->
      <AppFooter />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Loader2Icon, VenetianMask } from '@lucide/vue'
import { en as locale } from '@/locales/en'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import DifficultyIcon from './DifficultyIcon.vue'
import AppFooter from './AppFooter.vue'
import type { Difficulty } from '../types/index.js'

const props = defineProps<{
  pendingAction: 'create' | 'join' | null
  isSlowConnection: boolean
  /** Pre-fills the Join form when opened via a shared room link (e.g. /ABC123). */
  initialRoomCode?: string
  /** Pre-fills the name field too, if a saved session for that room exists. */
  initialPlayerName?: string
}>()

const emit = defineEmits<{
  create: [payload: { hostName: string; difficulty: Difficulty; imposterCount: number }]
  join: [payload: { roomCode: string; playerName: string }]
}>()

// Land straight on the Join tab, pre-filled, when a room code arrived via the URL.
const tab = ref<'create' | 'join'>(props.initialRoomCode ? 'join' : 'create')

const createForm = reactive({
  hostName: '',
  difficulty: 'easy' as Difficulty,
  imposterCount: 1,
})

const joinForm = reactive({
  roomCode: props.initialRoomCode ?? '',
  playerName: props.initialPlayerName ?? '',
})

function submitCreate() {
  if (!createForm.hostName.trim()) {return}
  emit('create', {
    hostName: createForm.hostName.trim(),
    difficulty: createForm.difficulty,
    imposterCount: createForm.imposterCount,
  })
}

function submitJoin() {
  if (!joinForm.roomCode.trim() || !joinForm.playerName.trim()) {return}
  emit('join', {
    roomCode: joinForm.roomCode.trim().toUpperCase(),
    playerName: joinForm.playerName.trim(),
  })
}
</script>
