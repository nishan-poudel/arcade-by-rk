<template>
  <div
    class="min-h-dvh flex flex-col px-5 relative overflow-hidden"
    style="padding-top: max(2.5rem, env(safe-area-inset-top))"
  >
    <AppBlob
      flavor="grape" size="14rem"
      class="absolute -left-16 -top-10 -z-10" />
    <AppBlob
      flavor="berry" size="12rem"
      :delay="1.5" class="absolute -right-14 top-24 -z-10" />

    <div class="w-full max-w-md mx-auto flex flex-col flex-1">
      <!-- Brand header -->
      <div class="text-center pt-4 pb-5 animate-fade-in">
        <Drama class="size-12 mb-3 mx-auto text-primary animate-wobble" stroke-width="1.5" />
        <h1 class="text-4xl tracking-tight">{{ locale.traitor.common.brandTitle }}</h1>
        <p class="text-muted-foreground mt-1 text-sm">{{ locale.traitor.common.brandTagline }}</p>
      </div>

      <div class="flex flex-col gap-5">
        <!-- Tab selector -->
        <div class="inline-flex w-full items-center gap-1 rounded-2xl border-2 border-border bg-secondary/60 p-1">
          <button
            v-for="t in (['create', 'join'] as const)"
            :key="t"
            type="button"
            :class="[
              'flex-1 min-h-[44px] rounded-xl text-sm font-display font-bold transition-all duration-200 ease-bounce',
              tab === t ? 'bg-primary text-primary-foreground shadow-pop scale-[1.02]' : 'text-muted-foreground',
            ]"
            @click="tab = t"
          >
            {{ t === 'create' ? locale.traitor.landing.createTab : locale.traitor.landing.joinTab }}
          </button>
        </div>

        <!-- Avatar picker (shared by both tabs) -->
        <div>
          <Label>{{ locale.traitor.landing.avatarLabel }}</Label>
          <div class="grid grid-cols-6 gap-2 mt-1">
            <button
              v-for="a in AVATARS"
              :key="a"
              type="button"
              class="aspect-square rounded-xl border-2 text-2xl flex items-center justify-center transition-all ease-bounce active:scale-90"
              :class="avatar === a ? 'border-primary bg-primary/15 scale-105' : 'border-border bg-secondary/40'"
              @click="avatar = a"
            >
              {{ a }}
            </button>
          </div>
        </div>

        <!-- Create form -->
        <div v-if="tab === 'create'" class="animate-slide-up">
          <Card class="p-1">
            <CardHeader>
              <CardTitle class="text-lg normal-case tracking-normal">{{ locale.traitor.landing.createHeading }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-5">
              <div>
                <Label>{{ locale.traitor.landing.hostNameLabel }}</Label>
                <Input
                  v-model="createForm.hostName"
                  :placeholder="locale.traitor.landing.namePlaceholder"
                  maxlength="24"
                  autocomplete="off"
                  autocapitalize="words"
                  @keyup.enter="submitCreate"
                />
              </div>

              <div>
                <Label>{{ locale.traitor.landing.categoryLabel }}</Label>
                <ToggleGroup
                  class="flex-wrap"
                  :model-value="createForm.category"
                  @update:model-value="(v) => { if (v) createForm.category = v as string }"
                >
                  <ToggleGroupItem
                    v-for="c in categories" :key="c"
                    :value="c" class="basis-[calc(33.333%-0.5rem)] grow">
                    {{ c }}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div>
                <Label>{{ locale.traitor.landing.roundsLabel }}</Label>
                <ToggleGroup
                  :model-value="String(createForm.totalRounds)"
                  @update:model-value="(v) => { if (v) createForm.totalRounds = Number(v) as TotalRounds }"
                >
                  <ToggleGroupItem
                    v-for="n in ([3, 5, 8] as const)" :key="n"
                    :value="String(n)" class="min-h-[52px] text-lg">
                    {{ n }}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <Button
                size="lg"
                class="w-full"
                :disabled="!createForm.hostName.trim() || !createForm.category || pendingAction !== null"
                @click="submitCreate"
              >
                <Loader2Icon v-if="pendingAction === 'create'" class="animate-spin" />
                {{ pendingAction === 'create' ? locale.traitor.landing.creatingButton : locale.traitor.landing.createButton }}
              </Button>
              <p
                v-if="pendingAction === 'create' && isSlowConnection"
                class="text-center text-xs text-muted-foreground -mt-2 animate-fade-in"
              >
                {{ locale.traitor.landing.slowConnectionHint }}
              </p>
            </CardContent>
          </Card>
        </div>

        <!-- Join form -->
        <div v-else class="animate-slide-up">
          <Card class="p-1">
            <CardHeader>
              <CardTitle class="text-lg normal-case tracking-normal">{{ locale.traitor.landing.joinHeading }}</CardTitle>
            </CardHeader>
            <CardContent class="space-y-5">
              <div>
                <Label>{{ locale.traitor.landing.roomCodeLabel }}</Label>
                <Input
                  :model-value="joinForm.roomCode"
                  class="font-mono tracking-[0.4em] text-2xl text-center uppercase"
                  :placeholder="locale.traitor.landing.roomCodePlaceholder"
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
                <Label>{{ locale.traitor.landing.yourNameLabel }}</Label>
                <Input
                  v-model="joinForm.playerName"
                  :placeholder="locale.traitor.landing.namePlaceholder"
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
                {{ pendingAction === 'join' ? locale.traitor.landing.joiningButton : locale.traitor.landing.joinButton }}
              </Button>
              <p
                v-if="pendingAction === 'join' && isSlowConnection"
                class="text-center text-xs text-muted-foreground -mt-2 animate-fade-in"
              >
                {{ locale.traitor.landing.slowConnectionHint }}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- Rules + back link -->
      <div class="mt-auto pt-6 text-center text-muted-foreground/60 text-xs space-y-1">
        <p>{{ locale.traitor.landing.rulesLine1 }}</p>
        <p>{{ locale.traitor.landing.rulesLine2 }}</p>
        <p class="pt-1">
          <a href="/" class="underline underline-offset-2 hover:text-foreground/80 transition-colors">
            {{ locale.traitor.landing.backLink }}
          </a>
        </p>
      </div>

      <AppFooter />
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { Drama, Loader2Icon } from '@lucide/vue'
import { en as locale } from '@/locales/en'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import AppFooter from './AppFooter.vue'
import AppBlob from './decor/AppBlob.vue'
import type { TotalRounds } from '../types/index.js'

const AVATARS = ['🕵️', '🦊', '🐺', '👻', '🎭', '🃏', '🐍', '🦉', '🐈‍⬛', '🦝', '🧛', '🕶️']

const props = defineProps<{
  pendingAction: 'create' | 'join' | null
  isSlowConnection: boolean
  categories: string[]
  initialRoomCode?: string
  initialPlayerName?: string
  initialAvatar?: string
}>()

const emit = defineEmits<{
  create: [payload: { hostName: string; avatar: string; category: string; totalRounds: TotalRounds }]
  join: [payload: { roomCode: string; playerName: string; avatar: string }]
}>()

const tab = ref<'create' | 'join'>(props.initialRoomCode ? 'join' : 'create')
const avatar = ref(props.initialAvatar || AVATARS[0])

const createForm = reactive({
  hostName: '',
  category: props.categories[0] ?? '',
  totalRounds: 5 as TotalRounds,
})

const joinForm = reactive({
  roomCode: props.initialRoomCode ?? '',
  playerName: props.initialPlayerName ?? '',
})

// Categories arrive from the server after connect — seed the default once.
watch(
  () => props.categories,
  (cats) => {
    if (!createForm.category && cats.length) {createForm.category = cats[0]}
  },
)

function submitCreate() {
  if (!createForm.hostName.trim() || !createForm.category) {return}
  emit('create', {
    hostName: createForm.hostName.trim(),
    avatar: avatar.value,
    category: createForm.category,
    totalRounds: createForm.totalRounds,
  })
}

function submitJoin() {
  if (!joinForm.roomCode.trim() || !joinForm.playerName.trim()) {return}
  emit('join', {
    roomCode: joinForm.roomCode.trim().toUpperCase(),
    playerName: joinForm.playerName.trim(),
    avatar: avatar.value,
  })
}
</script>
