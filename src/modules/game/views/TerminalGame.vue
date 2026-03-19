<template>
  <div class="tg-page">

  <!-- ═══ Game Page Hero ═══════════════════════════════════════════════════ -->
  <section class="game-hero">
    <div class="gh-tags">
      <span
        v-for="tag in locale.game.page.tags"
        :key="tag"
        class="gh-tag"
      >{{ tag }}</span>
    </div>
    <h1 class="gh-title">{{ locale.game.page.headline }}</h1>
    <p class="gh-sub">{{ locale.game.page.sub }}</p>
    <p class="gh-desc">{{ locale.game.page.desc }}</p>

    <div class="gh-htp">
      <p class="gh-htp-title">{{ locale.game.page.htpTitle }}</p>
      <ul class="gh-steps">
        <li
          v-for="(step, i) in locale.game.howToPlay.steps"
          :key="i"
          class="gh-step"
        >
          <span class="gh-step-icon">{{ step.icon }}</span>
          <span class="gh-step-body">
            <strong>{{ step.label }}</strong>
            {{ step.text }}
          </span>
        </li>
      </ul>
    </div>

    <button class="gh-launch-btn" @click="openOverlay">
      {{ locale.game.page.launchBtn }}
    </button>
  </section>

  <!-- ═══ Floating Action Button (quick relaunch) ═══════════════════════════ -->
  <button
    class="fab"
    :aria-label="locale.game.fabAriaLabel"
    data-test="fab"
    @click="openOverlay"
  >
    <span class="fab-icon">&#x25B6;</span>
    <span class="fab-label">{{ locale.game.fabLabel }}</span>
  </button>

  <!-- ─────────────────────────────────────────────────────────
       Full-screen game overlay
  ───────────────────────────────────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="overlayOpen"
      class="crt-overlay"
      role="dialog"
      aria-modal="true"
      :aria-label="locale.game.overlayAriaLabel"
      data-test="game-overlay"
    >
      <!-- scanline effect layer -->
      <div class="scanlines" aria-hidden="true" />

      <!-- ── top HUD ── -->
      <header class="hud" data-test="hud">
        <div class="hud-cell" data-test="hud-level">
          <span class="hud-label">{{ locale.game.hud.level }}</span>
          <span class="hud-value">{{ level }}</span>
        </div>
        <div class="hud-cell" data-test="hud-score">
          <span class="hud-label">{{ locale.game.hud.score }}</span>
          <span class="hud-value">{{ score }}</span>
        </div>
        <div class="hud-cell" data-test="hud-packets">
          <span class="hud-label">{{ locale.game.hud.packets }}</span>
          <span class="hud-value">{{ remainingPackets }}/{{ totalPackets }}</span>
        </div>
        <div class="hud-cell" data-test="hud-hi">
          <span class="hud-label">{{ locale.game.hud.hiScore }}</span>
          <span class="hud-value hi">{{ highScore }}</span>
        </div>
      </header>

      <!-- ── game area ── -->
      <main class="game-area" data-test="game-area">
        <!-- IDLE screen -->
        <div
          v-if="gameState === 'IDLE'"
          class="screen-card"
          data-test="idle-screen"
        >
          <pre class="ascii-art" aria-hidden="true">{{ ASCII_LOGO }}</pre>
          <p class="screen-subtitle">{{ locale.game.idle.subtitle }}</p>
          <p class="screen-subtitle dim">
            {{ locale.game.idle.avoidHint }} &nbsp;<span class="cell-x">X</span>&nbsp;
            · {{ locale.game.idle.collectHint }} &nbsp;<span class="cell-p">P</span>
          </p>
          <p class="screen-subtitle dim">
            {{ locale.game.idle.moveHint }} <kbd>W A S D</kbd> or Arrow keys
          </p>
          <button
            class="crt-btn primary"
            data-test="start-btn"
            @click="startGame"
          >
            {{ locale.game.idle.startBtn }}
          </button>
        </div>

        <!-- PLAYING screen -->
        <div
          v-else-if="gameState === 'PLAYING'"
          class="board-wrapper"
          data-test="board"
          @touchstart.passive="onTouchStart"
          @touchend.passive="onTouchEnd"
        >
          <!-- How to play / goal strip (desktop only, hidden on mobile) -->
          <div class="how-to-play">
            <span class="htp-item">
              <span class="htp-icon">🎯</span>
              <span><strong>{{ locale.game.htp.goalLabel }}</strong> {{ locale.game.htp.goalText }}</span>
            </span>
            <span class="htp-sep">·</span>
            <span class="htp-item">
              <span class="htp-icon">⌨️</span>
              <span><strong>{{ locale.game.htp.moveLabel }}</strong> {{ locale.game.htp.moveKeys }}</span>
            </span>
            <span class="htp-sep">·</span>
            <span class="htp-item">
              <span class="htp-icon">⚠️</span>
              <span><strong>{{ locale.game.htp.avoidLabel }}</strong> <span class="cell-x">▓</span> {{ locale.game.htp.avoidText }}</span>
            </span>
          </div>
          <div
            class="grid"
            data-test="grid"
          >
            <div
              v-for="(cell, idx) in flatGrid"
              :key="`${Math.floor(idx / COLS)}-${idx % COLS}`"
              :class="cellClass(cell)"
              :data-test="`cell-${Math.floor(idx / COLS)}-${idx % COLS}`"
            >
              {{ cell === '0' ? '\u00A0' : cell }}
            </div>
          </div>
          <p class="hint hint--desktop" data-test="hint">
            {{ locale.game.board.cursorLabel }} <span class="cell-c">C</span> &nbsp;|&nbsp;
            {{ locale.game.board.packetLabel }} <span class="cell-p">P</span> &nbsp;|&nbsp;
            {{ locale.game.board.firewallLabel }} <span class="cell-x">X</span>
          </p>

          <!-- Mobile D-pad controls -->
          <div class="dpad" aria-label="Directional controls">
            <button class="dpad-btn dpad-up" aria-label="Move up" @click="movePlayer(-1, 0)">&#x25B2;</button>
            <button class="dpad-btn dpad-left" aria-label="Move left" @click="movePlayer(0, -1)">&#x25C0;</button>
            <button class="dpad-btn dpad-right" aria-label="Move right" @click="movePlayer(0, 1)">&#x25B6;</button>
            <button class="dpad-btn dpad-down" aria-label="Move down" @click="movePlayer(1, 0)">&#x25BC;</button>
          </div>
        </div>

        <!-- GAMEOVER screen -->
        <div
          v-else-if="gameState === 'GAMEOVER'"
          class="screen-card"
          data-test="gameover-screen"
        >
          <p class="screen-title glitch" :data-glitch="locale.game.gameover.title">{{ locale.game.gameover.title }}</p>
          <p class="screen-subtitle">{{ locale.game.gameover.subtitle }}</p>
          <div class="score-summary" data-test="score-summary">
            <div class="summary-row"><span>{{ locale.game.gameover.labelLevel }}</span><span class="val">{{ level }}</span></div>
            <div class="summary-row"><span>{{ locale.game.gameover.labelData }}</span><span class="val">{{ score }} pts</span></div>
            <div class="summary-row"><span>{{ locale.game.gameover.labelHiScore }}</span><span class="val hi">{{ highScore }}</span></div>
          </div>
          <div class="btn-row">
            <button
              class="crt-btn primary"
              data-test="retry-btn"
              @click="startGame"
            >
              {{ locale.game.gameover.retryBtn }}
            </button>
            <button
              class="crt-btn"
              data-test="share-btn"
              @click="shareProgress"
            >
              {{ shareLabel }}
            </button>
          </div>
        </div>

        <!-- LEVEL UP flash (rendered on top of board via overlay) -->
        <Transition name="level-flash">
          <div
            v-if="showLevelFlash"
            class="level-flash"
            data-test="level-flash"
            aria-live="polite"
          >
            LEVEL {{ level }} &nbsp; {{ locale.game.levelFlashUnlocked }}
          </div>
        </Transition>
      </main>

      <!-- ── bottom bar ── -->
      <footer class="bottom-bar" data-test="bottom-bar">
        <span class="status-text" data-test="status-text">{{ statusLine }}</span>
        <div class="bottom-actions">
          <button
            v-if="gameState === 'PLAYING'"
            class="crt-btn sm help-btn"
            data-test="help-btn"
            @click="toggleHowToPlay"
          >
            <span class="help-icon">?</span>
            {{ locale.game.howToPlay.btn }}
          </button>
          <button
            class="crt-btn sm danger"
            data-test="close-btn"
            @click="closeOverlay"
          >
            {{ locale.game.closeBtn }}
          </button>
        </div>
      </footer>
    </div>
  </Teleport>

  <!-- ── How To Play Modal (Teleported to body, above game overlay) ── -->
  <Teleport to="body">
    <Transition name="htp-modal">
      <div
        v-if="showHowToPlay"
        class="htp-modal-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="locale.game.howToPlay.title"
        data-test="htp-modal"
        @click.self="toggleHowToPlay"
      >
        <div class="htp-modal-box">
          <div class="htp-modal-header">
            <span class="htp-modal-title">{{ locale.game.howToPlay.title }}</span>
            <button
              class="htp-close-x"
              aria-label="Close"
              @click="toggleHowToPlay"
            >
              ✕
            </button>
          </div>
          <ul class="htp-steps">
            <li
              v-for="(step, i) in locale.game.howToPlay.steps"
              :key="i"
              class="htp-step"
            >
              <span class="htp-step-icon">{{ step.icon }}</span>
              <span class="htp-step-body">
                <strong class="htp-step-label">{{ step.label }}</strong>
                <span class="htp-step-text">{{ step.text }}</span>
              </span>
            </li>
          </ul>
          <button
            class="crt-btn primary htp-modal-cta"
            @click="toggleHowToPlay"
          >
            {{ locale.game.howToPlay.closeBtn }}
          </button>
        </div>
      </div>
    </Transition>
  </Teleport>

  </div><!-- /.tg-page -->
</template>

<script setup lang="ts">
import { ref, computed, watchEffect, onMounted, onUnmounted } from 'vue'
import { usePageTitle } from '@/modules/shared/composables/usePageTitle'
import { en as locale } from '@/locales/en'

usePageTitle(locale.game.pageTitle)

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ROWS = 12
const COLS = 12

const ASCII_LOGO = `
 ██████╗██╗   ██╗██████╗ ███████╗██╗  ██╗ █████╗  ██████╗██╗  ██╗
██╔════╝╚██╗ ██╔╝██╔══██╗██╔════╝██║  ██║██╔══██╗██╔════╝██║ ██╔╝
██║      ╚████╔╝ ██████╔╝█████╗  ███████║███████║██║     █████╔╝ 
██║       ╚██╔╝  ██╔══██╗██╔══╝  ██╔══██║██╔══██║██║     ██╔═██╗ 
╚██████╗   ██║   ██████╔╝███████╗██║  ██║██║  ██║╚██████╗██║  ██╗
 ╚═════╝   ╚═╝   ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
              T E R M I N A L   H A C K  v2.0`

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Cell = '0' | 'X' | 'P' | 'C'
type Grid = Cell[][]
type GameState = 'IDLE' | 'PLAYING' | 'GAMEOVER'
interface Pos { row: number; col: number }

// ─────────────────────────────────────────────────────────────────────────────
// REACTIVE STATE  (Angular Signals → Vue refs)
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = 'terminalHack_highScore'

const overlayOpen    = ref(false)
const showHowToPlay  = ref(false)
const gameState      = ref<GameState>('IDLE')
const grid         = ref<Grid>([])
const playerPos    = ref<Pos>({ row: 0, col: 0 })
const score        = ref(0)
const level        = ref(1)
const _rawHiScore  = Number(localStorage.getItem(LS_KEY) ?? 0)
// Guard against NaN, Infinity, or tampered values (e.g. from browser extensions)
const highScore    = ref<number>(Number.isFinite(_rawHiScore) && _rawHiScore >= 0 ? Math.min(_rawHiScore, 999999) : 0)
const showLevelFlash = ref(false)
const shareLabel   = ref(locale.game.share.btn)
let   shareLabelTimer: ReturnType<typeof setTimeout> | null = null
let   levelFlashTimer: ReturnType<typeof setTimeout> | null = null

// ── Angular effect() → Vue watchEffect ──────────────────────────────────────
// Automatically persists highScore to localStorage whenever it changes
watchEffect(() => {
  localStorage.setItem(LS_KEY, String(highScore.value))
})

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED  (Angular computed signals → Vue computed)
// ─────────────────────────────────────────────────────────────────────────────

const flatGrid = computed<Cell[]>(() => grid.value.flat())

const totalPackets = computed<number>(() => levelTotalPackets.value)

// We store total packets at level-start so the HUD is accurate
const levelTotalPackets = ref(0)

const remainingPackets = computed<number>(() =>
  flatGrid.value.filter(c => c === 'P').length
)

const statusLine = computed<string>(() => {
  if (gameState.value === 'IDLE')     { return locale.game.status.idle }
  if (gameState.value === 'GAMEOVER') { return locale.game.status.gameover }
  return locale.game.status.scanning(level.value, score.value.toString().padStart(4, '0'))
})

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL GENERATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BFS from `start` — returns a Set of "row,col" strings for every cell the
 * player can reach without crossing a firewall.  Used to guarantee every
 * packet placed is actually collectable.
 */
function bfsReachable(g: Grid, start: Pos): Set<string> {
  const visited = new Set<string>()
  const queue: Pos[] = [{ ...start }]
  visited.add(`${start.row},${start.col}`)

  while (queue.length > 0) {
    const { row, col } = queue.shift()!
    const dirs: [number, number][] = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    for (const [dr, dc] of dirs) {
      const nr  = row + dr
      const nc  = col + dc
      const key = `${nr},${nc}`
      if (
        nr >= 0 && nr < ROWS &&
        nc >= 0 && nc < COLS &&
        !visited.has(key) &&
        g[nr][nc] !== 'X'
      ) {
        visited.add(key)
        queue.push({ row: nr, col: nc })
      }
    }
  }
  return visited
}

/**
 * Difficulty curve (per level):
 *  • Firewall density — starts at 10 %, grows 3 % per level, caps at 40 %
 *  • Packet count     — starts at 5,  grows by 1 per level,  caps at 14
 *
 * Solvability guarantee:
 *  Each attempt runs BFS from (0,0) after placing firewalls.
 *  Packets are placed only inside the reachable set, so every packet is
 *  always collectable.  If the reachable area is smaller than `packetCount`
 *  we retry with a 5 % lower density (up to 20 attempts).
 *  An open-grid fallback fires if all retries fail (should never happen at
 *  normal densities on a 12×12 board).
 */
function generateLevel(lvl: number): Grid {
  const firewallDensity = Math.min(0.10 + (lvl - 1) * 0.03, 0.40)
  const packetCount     = Math.min(5  + (lvl - 1),          14)
  const MAX_RETRIES     = 20

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    // Reduce density by 5 % per retry so we always converge on a solution
    const density = firewallDensity * (1 - attempt * 0.05)

    const newGrid: Grid = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, (): Cell => '0')
    )

    // Place firewalls randomly, never on spawn
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (r === 0 && c === 0) { continue }
        if (Math.random() < density) { newGrid[r][c] = 'X' }
      }
    }

    // BFS from spawn — collect all cells the player can reach
    const reachable = bfsReachable(newGrid, { row: 0, col: 0 })
    reachable.delete('0,0') // spawn cell is reserved for the cursor

    // Not enough room for all packets — try again with fewer walls
    if (reachable.size < packetCount) { continue }

    // Shuffle the reachable cells and assign the first N as packets
    const candidates = Array.from(reachable).sort(() => Math.random() - 0.5)
    for (let i = 0; i < packetCount; i++) {
      const [r, c] = candidates[i].split(',').map(Number)
      newGrid[r][c] = 'P'
    }

    newGrid[0][0] = 'C'
    return newGrid
  }

  // ── Absolute fallback: open grid, packets laid out in row-major order ──────
  const fallback: Grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, (): Cell => '0')
  )
  for (let i = 0; i < packetCount; i++) {
    const r = Math.floor((i + 1) / COLS)
    const c = (i + 1) % COLS
    fallback[r][c] = 'P'
  }
  fallback[0][0] = 'C'
  return fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

function openOverlay() {
  overlayOpen.value = true
}

function closeOverlay() {
  overlayOpen.value = false
  showHowToPlay.value = false
}

function toggleHowToPlay() {
  showHowToPlay.value = !showHowToPlay.value
}

function startGame() {
  score.value     = 0
  playerPos.value = { row: 0, col: 0 }
  grid.value      = generateLevel(level.value)
  levelTotalPackets.value = grid.value.flat().filter(c => c === 'P').length
  gameState.value = 'PLAYING'
  shareLabel.value = locale.game.share.btn
}

function advanceLevel() {
  level.value++
  showLevelFlash.value = true
  if (levelFlashTimer) { clearTimeout(levelFlashTimer) }
  levelFlashTimer = setTimeout(() => { showLevelFlash.value = false }, 1600)
  playerPos.value = { row: 0, col: 0 }
  grid.value      = generateLevel(level.value)
  levelTotalPackets.value = grid.value.flat().filter(c => c === 'P').length
}

function triggerGameOver() {
  if (score.value > highScore.value) {
    highScore.value = score.value   // watchEffect auto-saves to localStorage
  }
  gameState.value = 'GAMEOVER'
}

function movePlayer(dr: number, dc: number) {
  if (gameState.value !== 'PLAYING') { return }

  const { row, col } = playerPos.value
  const nr = row + dr
  const nc = col + dc

  // boundary check
  if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) { return }

  const target = grid.value[nr][nc]

  // ── build next grid immutably ──────────────────────────────
  const next: Grid = grid.value.map(r => [...r] as Cell[])

  if (target === 'X') {
    // hit firewall → game over
    next[row][col] = '0'   // ghost the cursor before GAMEOVER
    grid.value = next
    triggerGameOver()
    return
  }

  if (target === 'P') {
    score.value++
    if (score.value > highScore.value) { highScore.value = score.value }
  }

  // clear old position, place cursor at new position
  next[row][col] = '0'
  next[nr][nc]   = 'C'
  grid.value     = next
  playerPos.value = { row: nr, col: nc }

  // check win condition — no more packets
  const packetsLeft = next.flat().filter(c => c === 'P').length
  if (packetsLeft === 0) { advanceLevel() }
}

async function shareProgress() {
  const text = locale.game.share.text(level.value, score.value, highScore.value)
  const resetShare = () => {
    if (shareLabelTimer) { clearTimeout(shareLabelTimer) }
    shareLabelTimer = setTimeout(() => { shareLabel.value = locale.game.share.btn }, 2500)
  }
  try {
    await navigator.clipboard.writeText(text)
    shareLabel.value = locale.game.share.copied
    resetShare()
  } catch {
    shareLabel.value = locale.game.share.failed
    resetShare()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD  (Angular @HostListener → addEventListener)
// ─────────────────────────────────────────────────────────────────────────────

function onKeydown(e: KeyboardEvent) {
  if (!overlayOpen.value) { return }

  const map: Record<string, [number, number]> = {
    ArrowUp:    [-1,  0], w: [-1,  0], W: [-1,  0],
    ArrowDown:  [ 1,  0], s: [ 1,  0], S: [ 1,  0],
    ArrowLeft:  [ 0, -1], a: [ 0, -1], A: [ 0, -1],
    ArrowRight: [ 0,  1], d: [ 0,  1], D: [ 0,  1],
  }

  const delta = map[e.key]
  if (delta) {
    e.preventDefault()
    movePlayer(delta[0], delta[1])
  }

  if (e.key === 'Escape') {
    if (showHowToPlay.value) { showHowToPlay.value = false }
    else { closeOverlay() }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOUCH / SWIPE  (mobile gesture support)
// ─────────────────────────────────────────────────────────────────────────────

let touchStartX = 0
let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0]
  touchStartX = t.clientX
  touchStartY = t.clientY
}

function onTouchEnd(e: TouchEvent) {
  const t = e.changedTouches[0]
  const dx = t.clientX - touchStartX
  const dy = t.clientY - touchStartY
  const MIN_SWIPE = 30

  // Ignore taps (too short)
  if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) { return }

  if (Math.abs(dx) > Math.abs(dy)) {
    // horizontal swipe
    movePlayer(0, dx > 0 ? 1 : -1)
  } else {
    // vertical swipe
    movePlayer(dy > 0 ? 1 : -1, 0)
  }
}

onMounted(()  => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (shareLabelTimer)  { clearTimeout(shareLabelTimer) }
  if (levelFlashTimer)  { clearTimeout(levelFlashTimer) }
})

// ─────────────────────────────────────────────────────────────────────────────
// CELL STYLING
// ─────────────────────────────────────────────────────────────────────────────

function cellClass(cell: Cell): string {
  return ['cell', `cell-${cell.toLowerCase()}`].join(' ')
}
</script>

<style scoped src="./TerminalGame.scss"></style>
