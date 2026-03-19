<template>
  <div class="layout">
    <!-- Header Navigation -->
    <header class="header">
      <nav class="nav">
        <div class="nav-brand">
          <RouterLink :to="{ name: 'home' }" class="brand-link">
            <span class="brand-text">{{ locale.brand.namePrefix }}<abbr class="brand-rk" :title="locale.brand.nameAbbrFull">{{ locale.brand.nameAbbr }}</abbr></span>
          </RouterLink>
        </div>

        <!-- Mobile hamburger toggle -->
        <button
          class="nav-toggle"
          :class="{ open: menuOpen }"
          aria-label="Toggle navigation"
          @click="menuOpen = !menuOpen"
        >
          <span class="nav-toggle-bar" />
          <span class="nav-toggle-bar" />
          <span class="nav-toggle-bar" />
        </button>

        <!-- Backdrop for mobile menu -->
        <div
          v-if="menuOpen"
          class="nav-backdrop"
          @click="menuOpen = false"
        />

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
          <li class="nav-item nav-item--theme">
            <button
              class="theme-toggle"
              :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'"
              @click="toggle"
            >
              <span class="theme-toggle-icon">{{ theme === 'dark' ? '☀️' : '🌙' }}</span>
            </button>
          </li>
        </ul>
      </nav>
    </header>

    <!-- Main Content with page transitions -->
    <main class="main">
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- Footer -->
    <footer class="footer">
      <p>{{ locale.brand.footer }}</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed, ref } from 'vue'
import { en as locale } from '@/locales/en'
import { useTheme } from '@/modules/shared/composables/useTheme'

const route    = useRoute()
const isHome   = computed(() => route.name === 'home')
const isGame   = computed(() => route.name === 'game')
const isPuzzle = computed(() => route.name === 'puzzle')
const menuOpen = ref(false)
const { theme, toggle } = useTheme()
</script>

<style scoped src="./DefaultLayout.scss"></style>
