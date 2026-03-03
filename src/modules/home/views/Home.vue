<template>
  <div class="home" data-test="home">
    <div class="glow glow-1" />
    <div class="glow glow-2" />
    <section class="hero" data-test="hero">
      <div class="hero-text" data-test="hero-text">
        <p class="greeting" data-test="greeting">{{ locale.home.greeting }}</p>
        <h1 class="name" data-test="name">{{ locale.home.name }}</h1>
        <p class="tagline" data-test="tagline">{{ locale.home.tagline }}</p>
        <p class="sub" data-test="sub">{{ locale.home.sub }}</p>
        <RouterLink :to="{ name: 'about' }" class="btn" data-test="cta">{{ locale.home.cta }}</RouterLink>
      </div>
      <div class="hero-visual" data-test="hero-visual">
        <div class="img-frame">
          <img
            src="https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=700&q=80"
            alt="Creative workspace"
            class="hero-img"
            data-test="hero-img"
          >
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { en as locale } from '@/locales/en'
import { usePageTitle } from '@/modules/shared/composables/usePageTitle'

usePageTitle('Home')
</script>

<style scoped src="./Home.scss"></style>
