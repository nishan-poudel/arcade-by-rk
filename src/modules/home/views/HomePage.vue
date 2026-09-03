<template>
  <div class="home-page">
    <!-- ── Hero ─────────────────────────────────────────────────────────── -->
    <section class="hero">
      <AppBlob
        class="hero-blob hero-blob--1" flavor="lychee"
        :size="320" :delay="0" />
      <AppBlob
        class="hero-blob hero-blob--2" flavor="citron"
        :size="220" :delay="2" />

      <div class="hero-inner">
        <AppReveal>
          <AppSticker flavor="citron" :rotate="-4">✦ {{ locale.homePage.sticker }}</AppSticker>
        </AppReveal>
        <AppReveal :delay="0.06">
          <h1 class="hero-headline">
            Pick Your <span class="text-gradient">{{ locale.homePage.headlineAccent }}</span>
          </h1>
        </AppReveal>
        <AppReveal :delay="0.12">
          <p class="hero-sub">{{ locale.homePage.sub }}</p>
        </AppReveal>
        <AppReveal :delay="0.18" class="hero-cta-row">
          <RouterLink :to="{ name: 'game' }" class="a-btn a-btn--candy a-btn--lg">&gt;_ Grid Raider</RouterLink>
          <RouterLink :to="{ name: 'puzzle' }" class="a-btn a-btn--outline a-btn--lg">± Math Chain</RouterLink>
        </AppReveal>
      </div>

      <AppWave
        position="bottom" flavor="melon"
        shade="soft" variant="drip"
        :height="64" />
    </section>

    <!-- ── Game Cards ─────────────────────────────────────────────────── -->
    <section class="cards-section">
      <div class="cards">
        <AppReveal as="div">
          <RouterLink :to="{ name: 'game' }" class="tile tile--hack">
            <div class="tile-media tile-media--hack" aria-hidden="true">
              <span class="tile-glyph">&gt;_</span>
            </div>
            <div class="tile-body">
              <div class="tile-tags">
                <span
                  v-for="tag in locale.homePage.cards.hack.tags" :key="tag"
                  class="a-tag">{{ tag }}</span>
              </div>
              <h2 class="tile-title">
                {{ locale.homePage.cards.hack.title }}
                <span class="tile-arrow" aria-hidden="true">↗</span>
              </h2>
              <p class="tile-desc">{{ locale.homePage.cards.hack.desc }}</p>
              <span class="tile-cta">{{ locale.homePage.cards.hack.cta }}</span>
            </div>
          </RouterLink>
        </AppReveal>

        <AppReveal as="div" :delay="0.08">
          <RouterLink :to="{ name: 'puzzle' }" class="tile tile--puzzle">
            <div class="tile-media tile-media--puzzle" aria-hidden="true">
              <span class="tile-glyph">±</span>
            </div>
            <div class="tile-body">
              <div class="tile-tags">
                <span
                  v-for="tag in locale.homePage.cards.puzzle.tags" :key="tag"
                  class="a-tag">{{ tag }}</span>
              </div>
              <h2 class="tile-title">
                {{ locale.homePage.cards.puzzle.title }}
                <span class="tile-arrow" aria-hidden="true">↗</span>
              </h2>
              <p class="tile-desc">{{ locale.homePage.cards.puzzle.desc }}</p>
              <span class="tile-cta">{{ locale.homePage.cards.puzzle.cta }}</span>
            </div>
          </RouterLink>
        </AppReveal>
      </div>
    </section>

    <!-- ── How it works ──────────────────────────────────────────────── -->
    <section class="how-section">
      <AppReveal>
        <p class="eyebrow how-eyebrow">{{ locale.homePage.how.title }}</p>
      </AppReveal>
      <div class="how-grid">
        <AppReveal
          v-for="(step, i) in locale.homePage.how.steps"
          :key="step.n"
          as="div"
          :delay="i * 0.07"
        >
          <div class="how-card a-card a-card--hard">
            <span class="how-n" :style="{ background: `var(--flavor-${step.flavor}-soft)` }">{{ step.n }}</span>
            <h3 class="how-title">{{ step.title }}</h3>
            <p class="how-body">{{ step.body }}</p>
          </div>
        </AppReveal>
      </div>
    </section>

    <!-- ── CTA band ──────────────────────────────────────────────────── -->
    <section class="cta-band">
      <AppReveal class="cta-inner">
        <h2 class="cta-title">{{ locale.homePage.ctaBand.title }}</h2>
        <p class="cta-body">{{ locale.homePage.ctaBand.body }}</p>
        <RouterLink :to="{ name: 'game' }" class="a-btn a-btn--candy a-btn--lg">
          {{ locale.homePage.ctaBand.btn }}
        </RouterLink>
      </AppReveal>
    </section>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { usePageTitle } from '@/modules/shared/composables/usePageTitle'
import { en as locale } from '@/locales/en'
import AppBlob from '@/modules/shared/components/AppBlob.vue'
import AppWave from '@/modules/shared/components/AppWave.vue'
import AppReveal from '@/modules/shared/components/AppReveal.vue'
import AppSticker from '@/modules/shared/components/AppSticker.vue'

usePageTitle('Arcade')
</script>

<style scoped src="./HomePage.scss"></style>
