<template>
  <!--
    Full-screen container using dvh so it fills exactly the visible
    viewport on mobile (accounts for browser chrome hiding/showing).
    pb-safe pads the bottom above the iOS home indicator.
  -->
  <div class="min-h-dvh flex flex-col bg-[#0d0d0d] px-5" style="padding-top: max(2.5rem, env(safe-area-inset-top))">
    <!-- Brand header -->
    <div class="text-center pt-4 pb-6 animate-fade-in">
      <div class="text-5xl mb-3">🕵️</div>
      <h1 class="text-3xl font-extrabold tracking-tight">{{ locale.imposter.common.brandTitle }}</h1>
      <p class="text-white/50 mt-1 text-sm">{{ locale.imposter.common.brandTagline }}</p>
    </div>

    <!-- Tab selector: big enough to tap comfortably -->
    <div class="flex gap-1 bg-white/5 p-1 rounded-2xl mb-5">
      <button
        :class="[
          'flex-1 min-h-[44px] rounded-xl text-sm font-bold transition-all',
          tab === 'create' ? 'bg-green-500 text-white shadow-lg' : 'text-white/50',
        ]"
        @click="tab = 'create'"
      >
        {{ locale.imposter.landing.createTab }}
      </button>
      <button
        :class="[
          'flex-1 min-h-[44px] rounded-xl text-sm font-bold transition-all',
          tab === 'join' ? 'bg-green-500 text-white shadow-lg' : 'text-white/50',
        ]"
        @click="tab = 'join'"
      >
        {{ locale.imposter.landing.joinTab }}
      </button>
    </div>

    <!-- Forms -->
    <Transition name="tab" mode="out-in">
      <!-- Create form -->
      <div
        v-if="tab === 'create'" key="create"
        class="card space-y-5 animate-slide-up">
        <h2 class="font-bold text-lg">{{ locale.imposter.landing.createHeading }}</h2>

        <div>
          <label class="block text-xs text-white/50 mb-2 uppercase tracking-wider">{{ locale.imposter.landing.hostNameLabel }}</label>
          <input
            v-model="createForm.hostName"
            class="input text-base"
            :placeholder="locale.imposter.landing.namePlaceholder"
            maxlength="24"
            autocomplete="off"
            autocapitalize="words"
            @keyup.enter="submitCreate"
          >
        </div>

        <div>
          <label class="block text-xs text-white/50 mb-2 uppercase tracking-wider">{{ locale.imposter.landing.difficultyLabel }}</label>
          <select v-model="createForm.difficulty" class="input">
            <option value="easy">{{ locale.imposter.difficulty.easy }}</option>
            <option value="medium">{{ locale.imposter.difficulty.medium }}</option>
            <option value="hard">{{ locale.imposter.difficulty.hard }}</option>
          </select>
        </div>

        <!-- Imposter count with big visual buttons instead of range slider -->
        <div>
          <label class="block text-xs text-white/50 mb-2 uppercase tracking-wider">
            {{ locale.imposter.landing.impostersLabel }}
          </label>
          <div class="flex gap-2">
            <button
              v-for="n in 4"
              :key="n"
              :class="[
                'flex-1 min-h-[52px] rounded-xl font-bold text-lg border transition-all active:scale-95',
                createForm.imposterCount === n
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white/5 border-white/10 text-white/60',
              ]"
              @click="createForm.imposterCount = n"
            >
              {{ n }}
            </button>
          </div>
        </div>

        <button
          class="btn-primary w-full text-base py-4 flex items-center justify-center gap-2"
          :disabled="!createForm.hostName.trim() || pendingAction !== null"
          @click="submitCreate"
        >
          <span
            v-if="pendingAction === 'create'"
            class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
          />
          {{ pendingAction === 'create' ? locale.imposter.landing.creatingButton : locale.imposter.landing.createButton }}
        </button>

        <p
          v-if="pendingAction === 'create' && isSlowConnection"
          class="text-center text-xs text-white/40 -mt-2 animate-fade-in"
        >
          {{ locale.imposter.landing.slowConnectionHint }}
        </p>
      </div>

      <!-- Join form -->
      <div
        v-else key="join"
        class="card space-y-5 animate-slide-up">
        <h2 class="font-bold text-lg">{{ locale.imposter.landing.joinHeading }}</h2>

        <div>
          <label class="block text-xs text-white/50 mb-2 uppercase tracking-wider">{{ locale.imposter.landing.roomCodeLabel }}</label>
          <!--
            autocorrect=off + spellcheck=false prevents iOS suggesting corrections
            on the 6-char room code
          -->
          <input
            v-model="joinForm.roomCode"
            class="input font-mono tracking-[0.4em] text-2xl text-center uppercase"
            :placeholder="locale.imposter.landing.roomCodePlaceholder"
            maxlength="6"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="characters"
            spellcheck="false"
            inputmode="text"
            @input="joinForm.roomCode = ($event.target as HTMLInputElement).value.toUpperCase()"
            @keyup.enter="submitJoin"
          >
        </div>

        <div>
          <label class="block text-xs text-white/50 mb-2 uppercase tracking-wider">{{ locale.imposter.landing.yourNameLabel }}</label>
          <input
            v-model="joinForm.playerName"
            class="input text-base"
            :placeholder="locale.imposter.landing.namePlaceholder"
            maxlength="24"
            autocomplete="off"
            autocapitalize="words"
            @keyup.enter="submitJoin"
          >
        </div>

        <button
          class="btn-primary w-full text-base py-4 flex items-center justify-center gap-2"
          :disabled="!joinForm.roomCode.trim() || !joinForm.playerName.trim() || pendingAction !== null"
          @click="submitJoin"
        >
          <span
            v-if="pendingAction === 'join'"
            class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"
          />
          {{ pendingAction === 'join' ? locale.imposter.landing.joiningButton : locale.imposter.landing.joinButton }}
        </button>

        <p
          v-if="pendingAction === 'join' && isSlowConnection"
          class="text-center text-xs text-white/40 -mt-2 animate-fade-in"
        >
          {{ locale.imposter.landing.slowConnectionHint }}
        </p>
      </div>
    </Transition>

    <!-- Rules at bottom -->
    <div class="mt-auto py-6 text-center text-white/25 text-xs space-y-1">
      <p>{{ locale.imposter.landing.rulesLine1 }}</p>
      <p>{{ locale.imposter.landing.rulesLine2 }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { en as locale } from '@/locales/en'
import type { Difficulty } from '../types/index.js'

defineProps<{
  pendingAction: 'create' | 'join' | null
  isSlowConnection: boolean
}>()

const emit = defineEmits<{
  create: [payload: { hostName: string; difficulty: Difficulty; imposterCount: number }]
  join: [payload: { roomCode: string; playerName: string }]
}>()

const tab = ref<'create' | 'join'>('create')

const createForm = reactive({
  hostName: '',
  difficulty: 'easy' as Difficulty,
  imposterCount: 1,
})

const joinForm = reactive({
  roomCode: '',
  playerName: '',
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

<style scoped>
.tab-enter-active,
.tab-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tab-enter-from {
  opacity: 0;
  transform: translateX(10px);
}
.tab-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
