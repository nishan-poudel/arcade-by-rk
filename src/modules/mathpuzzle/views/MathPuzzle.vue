<template>
  <div class="mp-page">
    <!-- ──────────────────────────────────────────────────────── IDLE ── -->
    <div v-if="phase === 'IDLE'" class="mp-screen">
      <div class="idle-card">
        <div class="idle-tags">
          <span
            v-for="tag in locale.mathPuzzle.idle.tags"
            :key="tag"
            class="idle-tag"
          >{{ tag }}</span>
        </div>
        <div class="idle-glyph">±</div>
        <h1 class="idle-title">{{ locale.mathPuzzle.idle.title }}</h1>
        <p class="idle-sub">{{ locale.mathPuzzle.idle.sub }}</p>
        <p class="idle-desc">{{ locale.mathPuzzle.idle.desc }}</p>

        <ul class="rules-list">
          <li
            v-for="r in locale.mathPuzzle.idle.rules"
            :key="r.icon"
            class="rule"
          >
            <span class="rule-icon">{{ r.icon }}</span>
            <span>{{ r.text }}</span>
          </li>
        </ul>

        <div class="diff-picker">
          <button
            v-for="d in DIFFICULTIES"
            :key="d.value"
            :class="['diff-btn', { active: difficulty === d.value }]"
            @click="difficulty = d.value"
          >
            <span class="diff-name">{{ d.label }}</span>
            <span class="diff-hint">{{ d.hint }}</span>
          </button>
        </div>

        <button class="mp-btn primary" @click="pickAndStart">
          {{ locale.mathPuzzle.startBtn }}
        </button>
      </div>
    </div>

    <!-- ─────────────────────────────────────────────────────── PLAYING ── -->
    <div v-else-if="phase === 'PLAYING' && puzzle" class="mp-screen play-screen">
      <!-- stats bar -->
      <div class="mp-stats">
        <div class="mp-stat">
          <span class="mp-stat-label">{{ locale.mathPuzzle.stats.level }}</span>
          <span class="mp-stat-val level-val">{{ level }}</span>
        </div>
        <div class="mp-stat">
          <span class="mp-stat-label">{{ locale.mathPuzzle.stats.time }}</span>
          <span class="mp-stat-val timer">{{ timerDisplay }}</span>
        </div>
        <div class="mp-stat">
          <span class="mp-stat-label">{{ locale.mathPuzzle.stats.score }}</span>
          <span class="mp-stat-val score-val">{{ totalScore.toLocaleString() }}</span>
        </div>
        <div class="mp-stat">
          <span class="mp-stat-label">{{ locale.mathPuzzle.stats.blanks }}</span>
          <span class="mp-stat-val">{{ remainingCount }}/{{ totalHidden }}</span>
        </div>
      </div>

      <!--
        ── Main puzzle grid ──────────────────────────────────────────────────
        Flat CSS grid: 7 columns, 7 auto-placed rows.
        7 items per logical row maps naturally via auto-placement.

        Column layout:  [cell0] [rowOp0] [cell1] [rowOp1] [cell2] [=] [result]
        Row layout:     data0 / colOps01 / data1 / colOps12 / data2 / colEq / colResult
      -->
      <div
        class="puzzle-grid"
        role="grid"
        :aria-label="locale.mathPuzzle.gridLabel"
      >
        <!-- ── data row 0 ── -->
        <button :class="cellClass(0,0)" @click="selectCell(0,0)">{{ dv(0,0) }}</button>
        <span class="row-op">{{ puzzle.rowOps[0][0] }}</span>
        <button :class="cellClass(0,1)" @click="selectCell(0,1)">{{ dv(0,1) }}</button>
        <span class="row-op">{{ puzzle.rowOps[0][1] }}</span>
        <button :class="cellClass(0,2)" @click="selectCell(0,2)">{{ dv(0,2) }}</button>
        <span class="eq-sign">=</span>
        <span :class="['row-target', rowStatus(0)]">{{ puzzle.rowTargets[0] }}</span>

        <!-- ── col ops between row 0 and 1 ── (7 items: cols 1 3 5 are ops, rest empty) -->
        <span class="col-op">{{ puzzle.colOps[0][0] }}</span>
        <span />
        <span class="col-op">{{ puzzle.colOps[0][1] }}</span>
        <span />
        <span class="col-op">{{ puzzle.colOps[0][2] }}</span>
        <span />
        <span />

        <!-- ── data row 1 ── -->
        <button :class="cellClass(1,0)" @click="selectCell(1,0)">{{ dv(1,0) }}</button>
        <span class="row-op">{{ puzzle.rowOps[1][0] }}</span>
        <button :class="cellClass(1,1)" @click="selectCell(1,1)">{{ dv(1,1) }}</button>
        <span class="row-op">{{ puzzle.rowOps[1][1] }}</span>
        <button :class="cellClass(1,2)" @click="selectCell(1,2)">{{ dv(1,2) }}</button>
        <span class="eq-sign">=</span>
        <span :class="['row-target', rowStatus(1)]">{{ puzzle.rowTargets[1] }}</span>

        <!-- ── col ops between row 1 and 2 ── -->
        <span class="col-op">{{ puzzle.colOps[1][0] }}</span>
        <span />
        <span class="col-op">{{ puzzle.colOps[1][1] }}</span>
        <span />
        <span class="col-op">{{ puzzle.colOps[1][2] }}</span>
        <span />
        <span />

        <!-- ── data row 2 ── -->
        <button :class="cellClass(2,0)" @click="selectCell(2,0)">{{ dv(2,0) }}</button>
        <span class="row-op">{{ puzzle.rowOps[2][0] }}</span>
        <button :class="cellClass(2,1)" @click="selectCell(2,1)">{{ dv(2,1) }}</button>
        <span class="row-op">{{ puzzle.rowOps[2][1] }}</span>
        <button :class="cellClass(2,2)" @click="selectCell(2,2)">{{ dv(2,2) }}</button>
        <span class="eq-sign">=</span>
        <span :class="['row-target', rowStatus(2)]">{{ puzzle.rowTargets[2] }}</span>

        <!-- ── col = signs ── -->
        <span class="col-eq">=</span>
        <span />
        <span class="col-eq">=</span>
        <span />
        <span class="col-eq">=</span>
        <span />
        <span />

        <!-- ── col targets ── -->
        <span :class="['col-target', colStatus(0)]">{{ puzzle.colTargets[0] }}</span>
        <span />
        <span :class="['col-target', colStatus(1)]">{{ puzzle.colTargets[1] }}</span>
        <span />
        <span :class="['col-target', colStatus(2)]">{{ puzzle.colTargets[2] }}</span>
        <span />
        <span />
      </div>

      <!-- ── diagonal equations ── -->
      <div
        class="diag-section"
        :aria-label="locale.mathPuzzle.diagLabel"
      >
        <!-- ↘ main diagonal: (0,0)→(1,1)→(2,2) -->
        <div :class="['diag-eq', `diag-${diagStatus(0)}`]">
          <span class="diag-arrow">↘</span>
          <button
            :class="['diag-cell', diagCellCls(0,0)]"
            @click="selectCell(0,0)"
          >
            {{ dv(0,0) }}
          </button>
          <span class="diag-op">{{ puzzle.diagOps[0][0] }}</span>
          <button
            :class="['diag-cell', diagCellCls(1,1)]"
            @click="selectCell(1,1)"
          >
            {{ dv(1,1) }}
          </button>
          <span class="diag-op">{{ puzzle.diagOps[0][1] }}</span>
          <button
            :class="['diag-cell', diagCellCls(2,2)]"
            @click="selectCell(2,2)"
          >
            {{ dv(2,2) }}
          </button>
          <span class="diag-eq-sign">=</span>
          <span class="diag-result">{{ puzzle.diagTargets[0] }}</span>
        </div>

        <!-- ↗ anti-diagonal: (2,0)→(1,1)→(0,2) -->
        <div :class="['diag-eq', `diag-${diagStatus(1)}`]">
          <span class="diag-arrow">↗</span>
          <button
            :class="['diag-cell', diagCellCls(2,0)]"
            @click="selectCell(2,0)"
          >
            {{ dv(2,0) }}
          </button>
          <span class="diag-op">{{ puzzle.diagOps[1][0] }}</span>
          <button
            :class="['diag-cell', diagCellCls(1,1)]"
            @click="selectCell(1,1)"
          >
            {{ dv(1,1) }}
          </button>
          <span class="diag-op">{{ puzzle.diagOps[1][1] }}</span>
          <button
            :class="['diag-cell', diagCellCls(0,2)]"
            @click="selectCell(0,2)"
          >
            {{ dv(0,2) }}
          </button>
          <span class="diag-eq-sign">=</span>
          <span class="diag-result">{{ puzzle.diagTargets[1] }}</span>
        </div>
      </div>

      <!-- ── numpad ── -->
      <div
        class="numpad"
        role="group"
        :aria-label="locale.mathPuzzle.numpadLabel"
      >
        <button
          v-for="n in 9"
          :key="n"
          class="numpad-key"
          @click="inputNumber(n)"
        >
          {{ n }}
        </button>
        <button class="numpad-key erase-key" @click="clearCell">⌫</button>
      </div>

      <!-- ── bottom actions ── -->
      <div class="mp-actions">
        <button class="mp-btn ghost back-btn" @click="goBack">
          {{ locale.mathPuzzle.backBtn }}
        </button>
        <button class="mp-btn ghost" @click="newPuzzle">
          {{ locale.mathPuzzle.newBtn }}
        </button>
        <button class="mp-btn reveal-btn" @click="revealAnswer">
          {{ locale.mathPuzzle.revealBtn }}
        </button>
      </div>
    </div>

    <!-- ──────────────────────────────────────────────────────── SOLVED ── -->
    <Transition name="solve-pop">
      <div v-if="phase === 'SOLVED'" class="solved-overlay">
        <div class="solved-card">
          <div class="solved-check">✓</div>
          <div class="solved-level-tag">LEVEL {{ level }} COMPLETE</div>
          <h2 class="solved-title">{{ locale.mathPuzzle.solved.title }}</h2>

          <!-- score earned this puzzle -->
          <div class="solved-score-big">
            <span class="score-pts">+{{ lastScore.toLocaleString() }}</span>
            <span class="score-pts-label">{{ locale.mathPuzzle.solved.scored }}</span>
          </div>

          <!-- new hi-score badge -->
          <div v-if="totalScore === hiScore && lastScore > 0" class="solved-newhi">
            {{ locale.mathPuzzle.solved.newHi }}
          </div>

          <p class="solved-sub">{{ locale.mathPuzzle.solved.sub }}</p>

          <!-- stats row -->
          <div class="solved-stats">
            <div class="solved-stat">
              <span class="ss-label">{{ locale.mathPuzzle.stats.time }}</span>
              <strong class="ss-val">{{ timerDisplay }}</strong>
            </div>
            <div class="solved-stat">
              <span class="ss-label">{{ locale.mathPuzzle.stats.mode }}</span>
              <strong :class="['ss-val', `diff-accent-${difficulty}`]">
                {{ difficulty.toUpperCase() }}
              </strong>
            </div>
            <div class="solved-stat">
              <span class="ss-label">{{ locale.mathPuzzle.solved.total }}</span>
              <strong class="ss-val score-val">{{ totalScore.toLocaleString() }}</strong>
            </div>
            <div class="solved-stat">
              <span class="ss-label">{{ locale.mathPuzzle.solved.hiScore }}</span>
              <strong class="ss-val hi-val">{{ hiScore.toLocaleString() }}</strong>
            </div>
          </div>

          <p class="solved-next-hint">
            Level {{ level + 1 }} → {{ levelToDifficulty(level + 1).toUpperCase() }}
          </p>
          <button class="mp-btn primary" @click="levelUp">
            {{ locale.mathPuzzle.solved.nextBtn }}
          </button>
          <button class="mp-btn ghost solved-retry-btn" @click="newPuzzle">
            {{ locale.mathPuzzle.solved.newBtn }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePageTitle } from '@/modules/shared/composables/usePageTitle'
import { en as locale } from '@/locales/en'

usePageTitle(locale.mathPuzzle.pageTitle)

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Phase      = 'IDLE' | 'PLAYING' | 'SOLVED'
type Difficulty = 'easy' | 'medium' | 'hard'
type EqStatus   = 'pending' | 'correct' | 'wrong'

interface Puzzle {
  values:      number[][]  // [3][3] — correct values
  hidden:      boolean[][] // [3][3] — which cells the player fills in
  rowOps:      string[][]  // [3][2] — rowOps[r][c] = op between col c and c+1 in row r
  colOps:      string[][]  // [2][3] — colOps[r][c] = op between rows r and r+1 in col c
  diagOps:     string[][]  // [2][2] — [0]=↘, [1]=↗
  rowTargets:  number[]    // [3]
  colTargets:  number[]    // [3]
  diagTargets: number[]    // [2]
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const DIFFICULTIES: { value: Difficulty; label: string; hint: string }[] = [
  { value: 'easy',   label: locale.mathPuzzle.difficulty.easy,   hint: locale.mathPuzzle.difficulty.easyHint },
  { value: 'medium', label: locale.mathPuzzle.difficulty.medium, hint: locale.mathPuzzle.difficulty.mediumHint },
  { value: 'hard',   label: locale.mathPuzzle.difficulty.hard,   hint: locale.mathPuzzle.difficulty.hardHint },
]

const OPS = ['+', '−', '×']

// difficulty score multipliers
const DIFF_MULT: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }

// ─────────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────────

const phase      = ref<Phase>('IDLE')
const difficulty = ref<Difficulty>('medium')
const level      = ref(1)
const puzzle     = ref<Puzzle | null>(null)
const userInput  = ref<(number | null)[][]>(blankInput())
const selected   = ref<[number, number] | null>(null)
const elapsed    = ref(0)
const revealed   = ref(false)  // true after REVEAL btn — blocks isSolved so win screen doesn't fire

const lastScore  = ref(0)   // points earned on the last completed puzzle
const totalScore = ref(0)   // accumulated score for the current run
const hiScore    = ref(parseInt(localStorage.getItem('mp-hiscore') ?? '0', 10))

let   timerRef: ReturnType<typeof setInterval> | null = null

function blankInput(): (number | null)[][] {
  return Array.from({ length: 3 }, () => Array(3).fill(null) as (number | null)[])
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORE
// Formula: (level × 100 × diffMult) + time bonus
// Time bonus: fastest possible = full points; sub-30s = 3× level pts per second saved
// ─────────────────────────────────────────────────────────────────────────────

function calcScore(lvl: number, diff: Difficulty, secs: number): number {
  const base      = lvl * 100 * DIFF_MULT[diff]
  // Time par = 30s per blank. Reward solving faster than par.
  const par       = levelToHideCount(lvl) * 30
  const timeBonus = Math.max(0, Math.round((par - secs) * lvl * 1.5))
  return base + timeBonus
}

// ─────────────────────────────────────────────────────────────────────────────
// EVALUATION  (strict left-to-right — no operator precedence)
// ─────────────────────────────────────────────────────────────────────────────

function evalChain(vals: number[], ops: string[]): number {
  let res = vals[0]
  for (let i = 0; i < ops.length; i++) {
    const b = vals[i + 1]
    if (ops[i] === '+')  { res += b }
    else if (ops[i] === '−') { res -= b }
    else if (ops[i] === '×') { res *= b }
  }
  return res
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE GENERATION
// ─────────────────────────────────────────────────────────────────────────────

function ri(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function ro(): string { return OPS[Math.floor(Math.random() * OPS.length)] }

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

// Smooth ramp: level 1 → 2 hidden, level 2 → 3, …, level 6+ → 7 (max)
function levelToHideCount(n: number): number {
  return Math.min(n + 1, 7)
}

function levelToDifficulty(n: number): Difficulty {
  if (n <= 2) return 'easy'
  if (n <= 4) return 'medium'
  return 'hard'
}

function difficultyToStartLevel(d: Difficulty): number {
  if (d === 'easy')   return 1
  if (d === 'medium') return 3
  return 5
}

function generatePuzzle(hideCount: number): Puzzle {

  for (let attempt = 0; attempt < 600; attempt++) {
    const values: number[][] = Array.from({ length: 3 }, () =>
      Array.from({ length: 3 }, () => ri(1, 9))
    )
    const rowOps:  string[][] = Array.from({ length: 3 }, () => [ro(), ro()])
    const colOps:  string[][] = Array.from({ length: 2 }, () => [ro(), ro(), ro()])
    const diagOps: string[][] = [[ro(), ro()], [ro(), ro()]]

    const rowTargets  = values.map((row, r) => evalChain(row, rowOps[r]))
    const colTargets  = Array.from({ length: 3 }, (_, c) =>
      evalChain([values[0][c], values[1][c], values[2][c]], [colOps[0][c], colOps[1][c]])
    )
    const diagTargets = [
      evalChain([values[0][0], values[1][1], values[2][2]], diagOps[0]),  // ↘
      evalChain([values[2][0], values[1][1], values[0][2]], diagOps[1]),  // ↗
    ]

    // All targets must be integers in a displayable, believable range
    const allT = [...rowTargets, ...colTargets, ...diagTargets]
    if (allT.some(t => !Number.isInteger(t) || t < -99 || t > 999)) { continue }

    // Choose cells to hide — shuffle and take the first N
    const order = Array.from({ length: 9 }, (_, i) => i).sort(() => Math.random() - 0.5)
    const hiddenSet = new Set(order.slice(0, hideCount))
    const hidden: boolean[][] = Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => hiddenSet.has(r * 3 + c))
    )

    return { values, hidden, rowOps, colOps, diagOps, rowTargets, colTargets, diagTargets }
  }

  // Guaranteed fallback — simple values, clean arithmetic
  return fallbackPuzzle(hideCount)
}

function fallbackPuzzle(hideCount: number): Puzzle {
  const values: number[][] = [[3, 5, 2], [4, 1, 6], [7, 3, 8]]
  const rowOps:  string[][] = [['+', '−'], ['×', '+'], ['−', '+']]
  const colOps:  string[][] = [['+', '−', '×'], ['×', '+', '−']]
  const diagOps: string[][] = [['+', '×'], ['−', '+']]

  const rowTargets  = values.map((row, r) => evalChain(row, rowOps[r]))
  const colTargets  = Array.from({ length: 3 }, (_, c) =>
    evalChain([values[0][c], values[1][c], values[2][c]], [colOps[0][c], colOps[1][c]])
  )
  const diagTargets = [
    evalChain([values[0][0], values[1][1], values[2][2]], diagOps[0]),
    evalChain([values[2][0], values[1][1], values[0][2]], diagOps[1]),
  ]

  const hiddenSet = new Set(
    Array.from({ length: 9 }, (_, i) => i).sort(() => Math.random() - 0.5).slice(0, hideCount)
  )
  const hidden: boolean[][] = Array.from({ length: 3 }, (_, r) =>
    Array.from({ length: 3 }, (_, c) => hiddenSet.has(r * 3 + c))
  )

  return { values, hidden, rowOps, colOps, diagOps, rowTargets, colTargets, diagTargets }
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPLAY VALUE  (fixed cells show correct value; hidden cells show user input or blank)
// ─────────────────────────────────────────────────────────────────────────────

function dv(r: number, c: number): string {
  if (!puzzle.value) { return '' }
  if (!puzzle.value.hidden[r][c]) { return String(puzzle.value.values[r][c]) }
  const u = userInput.value[r][c]
  return u !== null ? String(u) : ''
}

// ─────────────────────────────────────────────────────────────────────────────
// EQUATION STATUS  (all checked against the stored targets — any valid solution wins)
// ─────────────────────────────────────────────────────────────────────────────

function cv(r: number, c: number): number | null {
  if (!puzzle.value) { return null }
  if (!puzzle.value.hidden[r][c]) { return puzzle.value.values[r][c] }
  return userInput.value[r][c]
}

function rowStatus(r: number): EqStatus {
  if (!puzzle.value) { return 'pending' }
  const row = [cv(r, 0), cv(r, 1), cv(r, 2)]
  if (row.some(v => v === null)) { return 'pending' }
  return evalChain(row as number[], puzzle.value.rowOps[r]) === puzzle.value.rowTargets[r]
    ? 'correct' : 'wrong'
}

function colStatus(c: number): EqStatus {
  if (!puzzle.value) { return 'pending' }
  const col = [cv(0, c), cv(1, c), cv(2, c)]
  if (col.some(v => v === null)) { return 'pending' }
  return evalChain(col as number[], [puzzle.value.colOps[0][c], puzzle.value.colOps[1][c]]) === puzzle.value.colTargets[c]
    ? 'correct' : 'wrong'
}

function diagStatus(d: number): EqStatus {
  if (!puzzle.value) { return 'pending' }
  const vals: (number | null)[] = d === 0
    ? [cv(0, 0), cv(1, 1), cv(2, 2)]
    : [cv(2, 0), cv(1, 1), cv(0, 2)]
  if (vals.some(v => v === null)) { return 'pending' }
  return evalChain(vals as number[], puzzle.value.diagOps[d]) === puzzle.value.diagTargets[d]
    ? 'correct' : 'wrong'
}

const isSolved = computed(() => {
  if (!puzzle.value || phase.value !== 'PLAYING' || revealed.value) { return false }
  return (
    [0, 1, 2].every(r => rowStatus(r) === 'correct') &&
    [0, 1, 2].every(c => colStatus(c) === 'correct') &&
    [0, 1].every(d    => diagStatus(d) === 'correct')
  )
})

watch(isSolved, (val) => {
  if (val) {
    const pts     = calcScore(level.value, difficulty.value, elapsed.value)
    lastScore.value  = pts
    totalScore.value += pts
    if (totalScore.value > hiScore.value) {
      hiScore.value = totalScore.value
      localStorage.setItem('mp-hiscore', String(hiScore.value))
    }
    phase.value = 'SOLVED'
    if (timerRef) { clearInterval(timerRef) }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED
// ─────────────────────────────────────────────────────────────────────────────

const timerDisplay = computed(() => {
  const m = Math.floor(elapsed.value / 60).toString().padStart(2, '0')
  const s = (elapsed.value % 60).toString().padStart(2, '0')
  return `${m}:${s}`
})

const totalHidden = computed(() =>
  puzzle.value ? puzzle.value.hidden.flat().filter(Boolean).length : 0
)

const remainingCount = computed(() => {
  if (!puzzle.value) { return 0 }
  return puzzle.value.hidden.flat().reduce((acc, isH, i) => {
    const r = Math.floor(i / 3)
    const c = i % 3
    return acc + (isH && userInput.value[r][c] === null ? 1 : 0)
  }, 0)
})

// ─────────────────────────────────────────────────────────────────────────────
// CELL CSS CLASSES
// ─────────────────────────────────────────────────────────────────────────────

function cellClass(r: number, c: number): string {
  if (!puzzle.value) { return 'mp-cell cell-empty' }
  if (!puzzle.value.hidden[r][c]) { return 'mp-cell cell-fixed' }

  const isSel = selected.value?.[0] === r && selected.value?.[1] === c
  const uv    = userInput.value[r][c]

  // Show wrong state even when selected — the user must see their answer is wrong
  if (uv !== null && uv !== puzzle.value.values[r][c]) {
    return isSel ? 'mp-cell cell-wrong cell-selected' : 'mp-cell cell-wrong'
  }
  if (isSel)        { return 'mp-cell cell-selected' }
  if (uv === null)  { return 'mp-cell cell-blank' }
  return 'mp-cell cell-correct'
}

function diagCellCls(r: number, c: number): string {
  return selected.value?.[0] === r && selected.value?.[1] === c ? 'diag-cell-sel' : ''
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

function firstHidden(): [number, number] | null {
  if (!puzzle.value) { return null }
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      if (puzzle.value.hidden[r][c]) { return [r, c] }
    }
  }
  return null
}

function startGame() {
  difficulty.value = levelToDifficulty(level.value)
  puzzle.value     = generatePuzzle(levelToHideCount(level.value))
  userInput.value  = blankInput()
  selected.value   = firstHidden()
  elapsed.value    = 0
  revealed.value   = false
  phase.value      = 'PLAYING'
  if (timerRef) { clearInterval(timerRef) }
  timerRef = setInterval(() => { elapsed.value++ }, 1000)
}

function selectCell(r: number, c: number) {
  if (!puzzle.value?.hidden[r][c]) { return }
  selected.value = [r, c]
}

function inputNumber(n: number) {
  if (!selected.value || !puzzle.value) { return }
  const [r, c] = selected.value
  if (!puzzle.value.hidden[r][c]) { return }
  // Immutable update — guarantees Vue reactivity on the nested array
  userInput.value = userInput.value.map((row, ri) =>
    ri === r ? row.map((val, ci) => (ci === c ? n : val)) : [...row]
  )
  advanceToNextBlank(r, c)
}

function clearCell() {
  if (!selected.value || !puzzle.value) { return }
  const [r, c] = selected.value
  if (!puzzle.value.hidden[r][c]) { return }
  userInput.value = userInput.value.map((row, ri) =>
    ri === r ? row.map((val, ci) => (ci === c ? null : val)) : [...row]
  )
}

function advanceToNextBlank(fromR: number, fromC: number) {
  if (!puzzle.value) { return }
  for (let i = fromR * 3 + fromC + 1; i < 9; i++) {
    const r = Math.floor(i / 3)
    const c = i % 3
    if (puzzle.value.hidden[r][c]) { selected.value = [r, c]; return }
  }
  // Wrap to beginning
  for (let i = 0; i < fromR * 3 + fromC; i++) {
    const r = Math.floor(i / 3)
    const c = i % 3
    if (puzzle.value.hidden[r][c]) { selected.value = [r, c]; return }
  }
}

function revealAnswer() {
  if (!puzzle.value) { return }
  // Set revealed flag BEFORE updating userInput — this prevents isSolved
  // from firing the win screen when the answers are backfilled.
  revealed.value  = true
  userInput.value = puzzle.value.values.map(row => [...row])
}

function newPuzzle() {
  startGame()
}

function pickAndStart() {
  level.value = difficultyToStartLevel(difficulty.value)
  startGame()
}

function goBack() {
  if (timerRef) { clearInterval(timerRef); timerRef = null }
  totalScore.value = 0
  lastScore.value  = 0
  phase.value = 'IDLE'
}

function levelUp() {
  level.value++
  startGame()
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD  (1–9 to fill, Backspace to clear, arrows to navigate)
// ─────────────────────────────────────────────────────────────────────────────

function onKeydown(e: KeyboardEvent) {
  if (phase.value !== 'PLAYING') { return }

  if (e.key >= '1' && e.key <= '9') {
    e.preventDefault()
    inputNumber(Number(e.key))
    return
  }

  if (e.key === 'Backspace' || e.key === 'Delete') {
    e.preventDefault()
    clearCell()
    return
  }

  if (!selected.value || !puzzle.value) { return }

  const moves: Record<string, [number, number]> = {
    ArrowRight: [0,  1], Tab:    [0,  1],
    ArrowLeft:  [0, -1],
    ArrowDown:  [1,  0],
    ArrowUp:    [-1, 0],
  }
  const delta = moves[e.key]
  if (!delta) { return }
  e.preventDefault()

  const [dr, dc] = delta
  const [r, c]   = selected.value
  // Walk in direction, wrap, find next hidden cell
  for (let step = 1; step <= 4; step++) {
    const nr = ((r + dr * step) % 3 + 3) % 3
    const nc = ((c + dc * step) % 3 + 3) % 3
    if (puzzle.value.hidden[nr][nc]) { selected.value = [nr, nc]; return }
  }
}

onMounted(()  => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (timerRef) { clearInterval(timerRef) }
})
</script>

<style scoped src="./MathPuzzle.scss"></style>
