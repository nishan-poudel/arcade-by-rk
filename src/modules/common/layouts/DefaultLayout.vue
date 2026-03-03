<template>
  <div class="layout">
    <!-- Header Navigation -->
    <header class="header">
      <nav class="nav">
        <div class="nav-brand">
          <span class="brand-text">{{ locale.brand.name }}</span>
        </div>
        <ul class="nav-links">
          <li class="nav-item">
            <RouterLink 
              :to="{ name: 'home' }" 
              :class="{ active: isHome }"
              class="nav-link"
            >
              <span class="link-text">{{ locale.nav.home }}</span>
              <span class="link-indicator" />
            </RouterLink>
          </li>
          <li class="nav-item">
            <RouterLink 
              :to="{ name: 'about' }" 
              :class="{ active: isAbout }"
              class="nav-link"
            >
              <span class="link-text">{{ locale.nav.about }}</span>
              <span class="link-indicator" />
            </RouterLink>
          </li>
        </ul>
      </nav>
    </header>

    <!-- Main Content -->
    <main class="main">
      <RouterView />
    </main>

    <!-- Footer -->
    <footer class="footer">
      <p>&copy; {{ locale.brand.copyright }}</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { computed } from 'vue'
import { en as locale } from '@/locales/en'

const route = useRoute()

const isHome = computed(() => route.name === 'home')
const isAbout = computed(() => route.name === 'about')
</script>

<style scoped src="./DefaultLayout.scss"></style>
