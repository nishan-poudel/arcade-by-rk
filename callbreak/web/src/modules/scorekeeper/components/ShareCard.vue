<template>
  <div
    ref="root"
    style="
      position: fixed;
      left: -10000px;
      top: 0;
      width: 640px;
      padding: 40px;
      background: #faf6ef;
      color: #241f24;
      font-family: 'Hanken Grotesk Variable', sans-serif;
    "
  >
    <p style="font-family: 'Fredoka Variable', sans-serif; font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: #8a7f6a; margin: 0">
      Call Break: Final Scores
    </p>
    <h1 style="font-family: 'Fredoka Variable', sans-serif; font-size: 32px; margin: 8px 0 24px; color: #e8695a">
      🏆 {{ winnerName }}
    </h1>
    <div v-for="(row, i) in ranked" :key="row.seat" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-top: 1px solid #e7ddc9">
      <span style="font-family: 'Fredoka Variable', sans-serif; font-size: 20px">{{ i + 1 }}. {{ row.name }}</span>
      <span style="font-family: 'Fredoka Variable', sans-serif; font-size: 24px; font-weight: 700; color: #2f6f56">{{ row.total }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ScoreStateView } from '../types'

const props = defineProps<{ state: ScoreStateView }>()

const root = ref<HTMLElement | null>(null)
defineExpose({ getEl: () => root.value })

const ranked = computed(() =>
  props.state.players
    .map((p, seat) => (p ? { seat, name: p.name, total: props.state.totals[seat] } : null))
    .filter((r): r is { seat: number; name: string; total: number } => r !== null)
    .sort((a, b) => b.total - a.total),
)
const winnerName = computed(() => ranked.value[0]?.name ?? '')
</script>
