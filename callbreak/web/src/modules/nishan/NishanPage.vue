<template>
  <div class="flex min-h-dvh flex-col bg-background text-foreground">
    <header class="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <RouterLink to="/" class="font-display text-lg font-bold text-foreground/80 hover:text-foreground">
        ← Back to hub
      </RouterLink>
      <ThemeToggle />
    </header>

    <main class="screen flex-1 pb-12">
      <!-- Hero: just the name, over a soft CSS gradient mesh (no stock photo needed) -->
      <div class="hero-mesh mx-4 mt-2 flex h-48 animate-slide-up items-center justify-center rounded-3xl text-center sm:h-56">
        <h1 class="font-display text-4xl font-bold text-foreground sm:text-6xl">{{ PROFILE.name }}</h1>
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
        <h2 class="font-display text-2xl font-bold">Shuffle through my work</h2>
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
            class="group flex w-60 shrink-0 snap-start flex-col transition-transform duration-200 hover:-translate-y-1.5 sm:w-64"
          >
            <!-- Colored card body: icon + copy. overflow-hidden clips only this
                 box, so the pill button below can overlap its bottom edge
                 instead of sitting padded fully inside it. -->
            <div class="flex flex-1 flex-col overflow-hidden rounded-2xl" :class="FLAVOR_CLASSES[p.flavor].card">
              <div class="flex h-28 items-center justify-center">
                <component
                  :is="p.icon"
                  v-if="p.icon"
                  class="h-12 w-12 transition-transform duration-200 group-hover:scale-110"
                  :class="FLAVOR_CLASSES[p.flavor].icon"
                />
                <SuitGlyph v-else suit="S" class="h-12 w-12 transition-transform duration-200 group-hover:scale-110" />
              </div>
              <div class="flex flex-1 flex-col gap-2 px-4 pb-9">
                <p class="font-display text-lg font-bold leading-snug">{{ p.name }}</p>
                <p class="text-xs text-foreground/70">{{ p.blurb }}</p>
              </div>
            </div>

            <!-- Pulled up to overlap the card's bottom-right corner. -->
            <div class="-mt-5 flex justify-end pr-4">
              <a
                v-if="p.category !== 'Coming Soon'"
                :href="p.url"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-pop transition-opacity hover:opacity-90"
                :class="FLAVOR_CLASSES[p.flavor].pill"
              >
                {{ p.cta }}
                <ArrowRight class="h-3.5 w-3.5 shrink-0" />
              </a>
              <span
                v-else
                class="inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white/90 shadow-pop"
                :class="FLAVOR_CLASSES[p.flavor].pill"
              >
                {{ p.cta }}
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

      <!-- Contact -->
      <div class="mx-4 mt-14 flex flex-col items-center gap-3 text-center sm:mx-auto sm:max-w-lg">
        <h2 class="font-display text-2xl font-bold">Want the director's commentary?</h2>
        <p class="text-sm text-muted-foreground">
          Résumé, actual work experience, or just curious how many of these got built at 2am? Say hello, I read every email.
        </p>
        <a
          :href="`mailto:${PROFILE.email}`"
          :class="cn(buttonVariants({ size: 'lg' }), 'mt-1')"
        >
          Say hello 👋
        </a>
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

/* A soft, layered gradient mesh stands in for a photo hero — no external
   image needed, so nothing to license or host. */
.hero-mesh {
  background-color: hsl(var(--secondary));
  background-image:
    radial-gradient(60% 90% at 12% 15%, hsl(var(--primary) / 0.35), transparent 60%),
    radial-gradient(55% 85% at 88% 25%, hsl(var(--flavor-grape) / 0.3), transparent 60%),
    radial-gradient(70% 100% at 50% 105%, hsl(var(--flavor-berry) / 0.25), transparent 65%);
}
</style>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Briefcase, ChevronLeft, ChevronRight, GraduationCap, Mail } from '@lucide/vue'
import AppFooter from '@/components/AppFooter.vue'
import SuitGlyph from '@/components/cards/SuitGlyph.vue'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import ThemeToggle from '@/components/ui/theme-toggle/ThemeToggle.vue'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
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
