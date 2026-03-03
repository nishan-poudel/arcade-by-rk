<template>
  <div class="about" data-test="about">
    <div class="glow" />
    <div class="about-grid" data-test="about-grid">
      <div class="about-image" data-test="about-image">
        <div class="img-frame">
          <img
            src="https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=700&q=80"
            alt="Developer at work"
            class="about-img"
            data-test="about-img"
          >
        </div>
        <div class="img-badge" data-test="badge">{{ locale.about.badge }}</div>
      </div>
      <div class="about-content" data-test="about-content">
        <p class="eyebrow" data-test="eyebrow">{{ locale.about.eyebrow }}</p>
        <h1 data-test="title">{{ locale.about.title }}</h1>
        <p class="desc" data-test="description">{{ locale.about.description }}</p>
        <div class="stack" data-test="stack">
          <p class="stack-label" data-test="stack-label">{{ locale.about.stackLabel }}</p>
          <div class="chips" data-test="chips">
            <span
              v-for="tech in locale.about.stack" :key="tech"
              class="chip" data-test="chip">{{ tech }}</span>
          </div>
        </div>
        <RouterLink
          :to="{ name: 'home' }" class="btn"
          data-test="cta">
          {{ locale.about.cta }}
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { en as locale } from '@/locales/en'
import { usePageTitle } from '@/modules/shared/composables/usePageTitle'

usePageTitle('About')
</script>

<style scoped src="./About.scss"></style>
