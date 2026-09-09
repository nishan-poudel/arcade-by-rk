<template>
  <!--
    Off-screen, fixed-size card rasterised to a PNG for the "save scores"
    button. Hard-coded brand colours (not theme tokens) so the export always
    looks the same. Mirrors the Imposter game's ShareCard.
  -->
  <div
    ref="root"
    style="position: fixed; left: -10000px; top: 0; width: 640px; pointer-events: none;
           font-family: 'Hanken Grotesk Variable', system-ui, sans-serif;
           background: #faf6ef; color: #241f24; padding: 36px 40px 40px; border-radius: 28px;"
  >
    <div style="text-align: center; margin-bottom: 20px;">
      <div style="font-family: 'Fredoka Variable', system-ui, sans-serif; font-weight: 700; font-size: 30px; letter-spacing: -0.01em;">
        Traitor
      </div>
      <div style="font-size: 13px; color: #6b5f68; margin-top: 2px;">the in-person party game</div>
    </div>

    <template v-if="result">
      <div
        style="text-align: center; border-radius: 20px; padding: 16px 12px; margin-bottom: 18px;"
        :style="{ background: detectivesWon ? '#d9f0e5' : '#fbe0dc' }"
      >
        <div
          style="font-family: 'Fredoka Variable', system-ui, sans-serif; font-weight: 700; font-size: 24px;"
          :style="{ color: detectivesWon ? '#2f6f56' : '#c0392b' }"
        >
          {{ detectivesWon ? 'Detectives Win!' : 'The Traitor Wins!' }}
        </div>
        <div style="font-size: 14px; margin-top: 6px; color: #c0392b;">
          The Traitor was <b>{{ result.traitorName }}</b>
        </div>
      </div>

      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #6b5f68; margin-bottom: 8px;">
        Scores{{ result.round ? ` · round ${result.round}/${result.totalRounds}` : '' }}
      </div>
      <div
        v-for="(row, i) in result.scores"
        :key="row.playerId"
        style="display: flex; align-items: center; gap: 14px; padding: 11px 14px; border-radius: 16px; background: #fff; border: 2px solid #ece4e9; margin-bottom: 7px;"
      >
        <span style="width: 20px; color: #a99fa6; font-size: 14px; text-align: right;">{{ i + 1 }}</span>
        <span style="flex: 1; font-weight: 600; font-size: 17px;">
          {{ row.name }}
          <span v-if="row.wasTraitor" style="color: #c0392b; font-size: 12px; font-weight: 700;"> · traitor</span>
        </span>
        <span
          style="font-family: 'Fredoka Variable', system-ui, sans-serif; font-weight: 700; font-size: 17px;"
          :style="{ color: row.points > 0 ? '#2f6f56' : '#a99fa6' }"
        >+{{ row.points }}</span>
        <span style="font-family: 'Fredoka Variable', system-ui, sans-serif; font-weight: 700; font-size: 20px; color: #e8695a; min-width: 32px; text-align: right;">
          {{ row.total }}
        </span>
      </div>
    </template>

    <template v-else>
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; color: #6b5f68; margin-bottom: 8px;">
        Standings{{ roundNumber ? ` · ${roundNumber} round${roundNumber === 1 ? '' : 's'}` : '' }}
      </div>
      <div
        v-for="(p, i) in sessionRows"
        :key="p.id"
        style="display: flex; align-items: center; gap: 14px; padding: 11px 14px; border-radius: 16px; background: #fff; border: 2px solid #ece4e9; margin-bottom: 7px;"
      >
        <span style="width: 20px; color: #a99fa6; font-size: 14px; text-align: right;">{{ i + 1 }}</span>
        <span style="flex: 1; font-weight: 600; font-size: 17px;">{{ p.name }}</span>
        <span style="font-family: 'Fredoka Variable', system-ui, sans-serif; font-weight: 700; font-size: 20px; color: #e8695a;">{{ p.score }}</span>
      </div>
    </template>

    <div style="text-align: center; font-size: 12px; color: #a99fa6; margin-top: 14px;">{{ stamp }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TraitorRoundResult, TraitorPublicPlayer } from '../types/index.js'

const props = defineProps<{
  result: TraitorRoundResult | null
  players: TraitorPublicPlayer[]
  roundNumber: number
}>()

const root = ref<HTMLElement | null>(null)
defineExpose({ getEl: () => root.value })

const detectivesWon = computed(() => props.result?.outcome === 'detectives')
const sessionRows = computed(() => [...props.players].sort((a, b) => b.score - a.score))
const stamp = computed(() => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }))
</script>
