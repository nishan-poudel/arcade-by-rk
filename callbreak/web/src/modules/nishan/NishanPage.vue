<template>
  <div class="flex min-h-dvh flex-col bg-background text-foreground">
    <header class="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <RouterLink to="/" class="font-display text-lg font-bold text-foreground/80 hover:text-foreground">
        ← Back to hub
      </RouterLink>
      <ThemeToggle />
    </header>

    <main class="screen flex-1 pb-12">
      <!-- Intro: plain background, no decoration -->
      <div class="mx-auto max-w-2xl animate-slide-up px-4 pt-8 text-center">
        <h1 class="font-display text-4xl font-bold sm:text-5xl">{{ PROFILE.name }}</h1>
        <p class="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">{{ PROFILE.tagline }}</p>
      </div>

      <!-- Quick facts: a plain, responsive row (wraps on narrow screens) -->
      <Card class="mx-4 mt-6 sm:mx-auto sm:max-w-2xl">
        <CardContent class="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-6 text-sm">
          <span class="flex items-center gap-2">
            <Briefcase class="h-4 w-4 shrink-0 text-primary" />
            {{ PROFILE.role }}
          </span>
          <span class="flex items-center gap-2">
            <GraduationCap class="h-4 w-4 shrink-0 text-primary" />
            {{ PROFILE.education }}
          </span>
          <span class="flex items-center gap-2">
            <Mail class="h-4 w-4 shrink-0 text-primary" />
            {{ PROFILE.email }}
          </span>
        </CardContent>
      </Card>

      <!-- Filter -->
      <div class="mx-4 mt-10 flex flex-col items-center gap-4">
        <h2 class="font-display text-2xl font-bold">What I've built</h2>
        <ToggleGroup v-model="activeFilter" class="flex flex-wrap justify-center gap-2">
          <ToggleGroupItem value="All" class="h-9 flex-none px-4 text-sm">All</ToggleGroupItem>
          <ToggleGroupItem v-for="c in CATEGORIES" :key="c" :value="c" class="h-9 flex-none px-4 text-sm">{{ c }}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <!-- Project tiles: a horizontal-scroll carousel, Google-Careers-style -->
      <div class="relative mx-auto mt-6 w-full max-w-5xl">
        <div
          ref="trackEl"
          class="no-scrollbar flex w-full min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-2 scroll-pl-4 sm:px-10 sm:scroll-pl-10"
          @scroll="onTrackScroll"
        >
          <div
            v-for="p in filteredProjects"
            :key="p.name"
            class="flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl sm:w-64"
            :class="FLAVOR_CLASSES[p.flavor].card"
          >
            <div class="flex h-28 items-center justify-center">
              <component :is="p.icon" v-if="p.icon" class="h-12 w-12" :class="FLAVOR_CLASSES[p.flavor].icon" />
              <SuitGlyph v-else suit="S" class="h-12 w-12" />
            </div>
            <div class="flex flex-1 flex-col gap-2 px-4">
              <p class="font-display text-lg font-bold leading-snug">{{ p.name }}</p>
              <p class="text-xs text-foreground/70">{{ p.blurb }}</p>
            </div>
            <div class="p-4 pt-3">
              <a
                v-if="p.category !== 'Coming Soon'"
                :href="p.url"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                :class="FLAVOR_CLASSES[p.flavor].pill"
              >
                Visit
                <ExternalLink class="h-3.5 w-3.5" />
              </a>
              <span
                v-else
                class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white/90"
                :class="FLAVOR_CLASSES[p.flavor].pill"
              >
                Coming soon
              </span>
            </div>
          </div>

          <p v-if="filteredProjects.length === 0" class="py-8 text-center text-sm text-muted-foreground">
            Nothing in this category yet.
          </p>
        </div>

        <button
          v-if="canScrollLeft"
          type="button"
          aria-label="Scroll left"
          class="absolute left-1 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-card p-2 shadow-pop sm:flex"
          @click="scrollByCard(-1)"
        >
          <ChevronLeft class="h-5 w-5" />
        </button>
        <button
          v-if="canScrollRight"
          type="button"
          aria-label="Scroll right"
          class="absolute right-1 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full bg-card p-2 shadow-pop sm:flex"
          @click="scrollByCard(1)"
        >
          <ChevronRight class="h-5 w-5" />
        </button>
      </div>
    </main>

    <AppFooter />
  </div>
</template>

<style scoped>
.no-scrollbar {
  scrollbar-width: none;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Briefcase, ChevronLeft, ChevronRight, ExternalLink, GraduationCap, Mail } from '@lucide/vue'
import AppFooter from '@/components/AppFooter.vue'
import SuitGlyph from '@/components/cards/SuitGlyph.vue'
import { Card, CardContent } from '@/components/ui/card'
import ThemeToggle from '@/components/ui/theme-toggle/ThemeToggle.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CATEGORIES, FLAVOR_CLASSES, PROFILE, PROJECTS, type ProjectCategory } from './content'

const activeFilter = ref<ProjectCategory | 'All'>('All')

const filteredProjects = computed(() =>
  activeFilter.value === 'All' ? PROJECTS : PROJECTS.filter((p) => p.category === activeFilter.value),
)

const trackEl = ref<HTMLDivElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

function updateScrollButtons() {
  const el = trackEl.value
  if (!el) return
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

function onTrackScroll() {
  updateScrollButtons()
}

function scrollByCard(direction: 1 | -1) {
  trackEl.value?.scrollBy({ left: direction * 280, behavior: 'smooth' })
}

// Re-check button visibility whenever the filtered set (and so scrollWidth)
// changes, and reset scroll position so a narrower filter never leaves the
// track scrolled past its own (now shorter) content.
watch(filteredProjects, () => {
  trackEl.value?.scrollTo({ left: 0 })
  nextTick(updateScrollButtons)
})

onMounted(() => {
  // Scroll-snap containers can land on a non-zero initial scrollLeft
  // (observed ~= the container's own inline padding) before any user has
  // scrolled — force a clean start so the left arrow isn't shown for
  // nothing on first paint.
  nextTick(() => {
    trackEl.value?.scrollTo({ left: 0 })
    updateScrollButtons()
  })
})
</script>
