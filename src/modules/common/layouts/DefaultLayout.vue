<template>
  <div class="layout">
    <div class="app-aura" aria-hidden="true" />

    <!-- Header Navigation -->
    <header class="header" :class="{ scrolled: isScrolled }">
      <nav class="nav">
        <div class="nav-brand">
          <RouterLink
            :to="{ name: 'home' }" class="brand-link"
            @click="menuOpen = false">
            <span class="brand-logo" aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <path
                  fill="var(--accent)"
                  d="M16 1.8c5.6 0 9.4 2.3 11.6 6.2 2 3.6 2.4 8 .9 12-1.4 3.7-4.4 6.6-8.2 8-4 1.5-8.7 1.2-12.3-1C4 24.7 1.6 20.9.9 16.4.2 12 1.4 7.4 4.2 3.9 5.6 2.2 7 1.8 16 1.8Z"
                />
                <path fill="var(--canvas)" d="M13 10.5 22 16l-9 5.5z" />
              </svg>
            </span>
            <span class="brand-text">{{ locale.brand.namePrefix }}<abbr
              class="brand-rk"
              :title="locale.brand.nameAbbrFull"
            >{{ locale.brand.nameAbbr }}</abbr></span>
          </RouterLink>
        </div>

        <!-- Mobile hamburger toggle -->
        <button
          class="nav-toggle"
          :class="{ open: menuOpen }"
          aria-label="Toggle navigation"
          :aria-expanded="menuOpen"
          @click="menuOpen = !menuOpen"
        >
          <span class="nav-toggle-bar" />
          <span class="nav-toggle-bar" />
          <span class="nav-toggle-bar" />
        </button>

        <!-- Backdrop for mobile menu -->
        <Transition name="backdrop">
          <div
            v-if="menuOpen"
            class="nav-backdrop"
            @click="menuOpen = false"
          />
        </Transition>

        <ul class="nav-links" :class="{ open: menuOpen }">
          <li class="nav-item">
            <RouterLink
              :to="{ name: 'home' }"
              :class="{ active: isHome }"
              class="nav-link nav-link--home"
              @click="menuOpen = false"
            >
              <span class="link-text">{{ locale.nav.home }}</span>
            </RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink
              :to="{ name: 'game' }"
              :class="{ active: isGame }"
              class="nav-link nav-link--game"
              @click="menuOpen = false"
            >
              <span class="link-text">{{ locale.nav.game }}</span>
            </RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink
              :to="{ name: 'puzzle' }"
              :class="{ active: isPuzzle }"
              class="nav-link nav-link--puzzle"
              @click="menuOpen = false"
            >
              <span class="link-text">{{ locale.nav.mathPuzzle }}</span>
            </RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink
              :to="{ name: 'about' }"
              :class="{ active: isAbout }"
              class="nav-link nav-link--about"
              @click="menuOpen = false"
            >
              <span class="link-text">{{ locale.nav.about }}</span>
            </RouterLink>
          </li>
          <li class="nav-item nav-item--theme">
            <button
              class="theme-toggle"
              :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggle"
            >
              <span :key="theme" class="theme-toggle-icon">{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
            </button>
          </li>
        </ul>
      </nav>
    </header>

    <!-- Main Content with page transitions -->
    <main class="main">
      <RouterView v-slot="{ Component }">
        <Transition name="page-rise" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <AppWave
        position="top" color="var(--surface-sunken)"
        variant="roll" :height="40" />
      <p>
        {{ locale.brand.footer }} <button
          :key="footerDisplayName"
          class="footer-name-toggle"
          :class="{ rotating: footerIsRotating }"
          @click="toggleFooterName"
        >
          {{ footerDisplayName }}
        </button>
      </p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { en as locale } from '@/locales/en'
import { useTheme } from '@/modules/shared/composables/useTheme'
import AppWave from '@/modules/shared/components/AppWave.vue'

const route = useRoute()
const isHome = computed(() => route.name === 'home')
const isGame = computed(() => route.name === 'game')
const isPuzzle = computed(() => route.name === 'puzzle')
const isAbout = computed(() => route.name === 'about')
const menuOpen = ref(false)
const { theme, toggle } = useTheme()

// Subtle header treatment once the page has scrolled a little.
const isScrolled = ref(false)
const onScroll = () => { isScrolled.value = window.scrollY > 8 }
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))

// Footer name toggle — independent easter-egg state
const footerIsRockingKaka = ref(true)
const footerIsRotating = ref(false)
const footerDisplayName = computed(() =>
  footerIsRockingKaka.value ? locale.about.nameAlternate : locale.about.nameDefault,
)

const toggleFooterName = () => {
  footerIsRotating.value = true
  setTimeout(() => {
    footerIsRockingKaka.value = !footerIsRockingKaka.value
    footerIsRotating.value = false
  }, 1200)
}
</script>

<style scoped src="./DefaultLayout.scss"></style>
