<template>
  <div class="flex min-h-dvh flex-col bg-background text-foreground">
    <header class="flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <ThemeToggle />
    </header>

    <main class="screen mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-8 px-4 pb-8 pt-10 text-center sm:pt-16">
      <div class="animate-slide-up">
        <SuitGlyph suit="S" class="mx-auto mb-3 h-12 w-12" />
        <h1 class="font-display text-3xl font-bold">{{ t.brandTitle }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ t.brandTagline }}</p>
      </div>

      <div class="flex w-full flex-col gap-4">
        <RouterLink to="/play">
          <Card class="text-left transition-colors duration-200 hover:bg-accent/60">
            <CardContent class="flex items-center gap-4 pt-6">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Gamepad2 class="h-6 w-6 text-primary" />
              </span>
              <span>
                <p class="font-display text-lg font-bold">{{ t.callBreakOnline }}</p>
                <p class="text-sm text-muted-foreground">{{ t.callBreakOnlineDesc }}</p>
              </span>
            </CardContent>
          </Card>
        </RouterLink>

        <RouterLink to="/score">
          <Card class="text-left transition-colors duration-200 hover:bg-accent/60">
            <CardContent class="flex items-center gap-4 pt-6">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flavor-melon/20">
                <ClipboardList class="h-6 w-6 text-flavor-melon-ink" />
              </span>
              <span>
                <p class="font-display text-lg font-bold">{{ t.callBreakOffline }}</p>
                <p class="text-sm text-muted-foreground">{{ t.callBreakOfflineDesc }}</p>
              </span>
            </CardContent>
          </Card>
        </RouterLink>

        <RouterLink to="/faras">
          <Card class="text-left transition-colors duration-200 hover:bg-accent/60">
            <CardContent class="flex items-center gap-4 pt-6">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flavor-berry/20">
                <Eye class="h-6 w-6 text-flavor-berry-ink" />
              </span>
              <span>
                <p class="font-display text-lg font-bold">{{ t.faras }}</p>
                <p class="text-sm text-muted-foreground">{{ t.farasDesc }}</p>
              </span>
            </CardContent>
          </Card>
        </RouterLink>
      </div>
    </main>

    <div class="pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <AppFooter />
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ClipboardList, Eye, Gamepad2 } from '@lucide/vue'
import { Card, CardContent } from '@/components/ui/card'
import ThemeToggle from '@/components/ui/theme-toggle/ThemeToggle.vue'
import AppFooter from '@/components/AppFooter.vue'
import SuitGlyph from '@/components/cards/SuitGlyph.vue'
import { en } from '@/locales/en'

const t = en.hub
</script>
