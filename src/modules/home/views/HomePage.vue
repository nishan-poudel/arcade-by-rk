<template>
  <div class="home-page">

    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <section class="hero">
      <p class="hero-eyebrow">{{ locale.homePage.eyebrow }}</p>
      <h1 class="hero-headline">{{ locale.homePage.headline }}</h1>
      <p class="hero-sub">{{ locale.homePage.sub }}</p>
    </section>

    <!-- ── Game Cards ─────────────────────────────────────────────────── -->
    <section class="cards">

      <!-- Terminal Hack card -->
      <RouterLink :to="{ name: 'game' }" class="card card--hack">
        <div class="card-glow" aria-hidden="true" />
        <div class="card-top">
          <div class="card-tags">
            <span
              v-for="tag in locale.homePage.cards.hack.tags"
              :key="tag"
              class="tag tag--green"
            >{{ tag }}</span>
          </div>
          <div class="card-icon card-icon--hack">&gt;_</div>
        </div>
        <h2 class="card-title card-title--hack">{{ locale.homePage.cards.hack.title }}</h2>
        <p class="card-desc">{{ locale.homePage.cards.hack.desc }}</p>
        <div class="card-footer">
          <span class="card-cta card-cta--hack">{{ locale.homePage.cards.hack.cta }} →</span>
        </div>
      </RouterLink>

      <!-- Math Chain card -->
      <RouterLink :to="{ name: 'puzzle' }" class="card card--puzzle">
        <div class="card-glow card-glow--puzzle" aria-hidden="true" />
        <div class="card-top">
          <div class="card-tags">
            <span
              v-for="tag in locale.homePage.cards.puzzle.tags"
              :key="tag"
              class="tag tag--blue"
            >{{ tag }}</span>
          </div>
          <div class="card-icon card-icon--puzzle">±</div>
        </div>
        <h2 class="card-title card-title--puzzle">{{ locale.homePage.cards.puzzle.title }}</h2>
        <p class="card-desc">{{ locale.homePage.cards.puzzle.desc }}</p>
        <div class="card-footer">
          <span class="card-cta card-cta--puzzle">{{ locale.homePage.cards.puzzle.cta }} →</span>
        </div>
      </RouterLink>

    </section>

  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { usePageTitle } from '@/modules/shared/composables/usePageTitle'
import { en as locale } from '@/locales/en'

usePageTitle('Arcade')
</script>

<style scoped src="./HomePage.scss"></style>
