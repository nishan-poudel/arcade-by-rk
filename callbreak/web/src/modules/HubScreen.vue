<template>
  <div class="isolate flex min-h-dvh flex-col bg-background text-foreground">
    <AppBlob flavor="berry" size="22rem" class="fixed -left-24 -top-24 -z-10" />
    <AppBlob flavor="grape" size="18rem" class="fixed -bottom-16 -right-16 -z-10" :delay="1.2" />

    <header class="flex justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <ThemeToggle />
    </header>

    <main class="screen mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-4 pb-8 text-center">
      <div class="animate-slide-up">
        <SuitGlyph suit="S" class="mx-auto mb-3 h-14 w-14" />
        <h1 class="font-display text-4xl font-bold">{{ t.brandTitle }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">{{ t.brandTagline }}</p>
      </div>

      <div class="flex w-full flex-col gap-4">
        <RouterLink to="/play">
          <Card class="text-left transition-transform duration-200 ease-bounce hover:-translate-y-1">
            <CardContent class="flex items-center gap-4 pt-6">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Gamepad2 class="h-6 w-6 text-primary" />
              </span>
              <span>
                <p class="font-display text-lg font-bold">{{ t.playOnline }}</p>
                <p class="text-sm text-muted-foreground">{{ t.playOnlineDesc }}</p>
              </span>
            </CardContent>
          </Card>
        </RouterLink>

        <RouterLink to="/score">
          <Card class="text-left transition-transform duration-200 ease-bounce hover:-translate-y-1">
            <CardContent class="flex items-center gap-4 pt-6">
              <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-flavor-melon/20">
                <ClipboardList class="h-6 w-6 text-flavor-melon-ink" />
              </span>
              <span>
                <p class="font-display text-lg font-bold">{{ t.scoreKeeper }}</p>
                <p class="text-sm text-muted-foreground">{{ t.scoreKeeperDesc }}</p>
              </span>
            </CardContent>
          </Card>
        </RouterLink>
      </div>
    </main>

    <footer class="pb-[max(1rem,env(safe-area-inset-bottom))] text-center text-xs text-muted-foreground">
      {{ t.footerMadeBy }} <span class="font-semibold">{{ t.footerName }}</span> ({{ t.footerRealName }})
    </footer>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ClipboardList, Gamepad2 } from '@lucide/vue'
import { Card, CardContent } from '@/components/ui/card'
import ThemeToggle from '@/components/ui/theme-toggle/ThemeToggle.vue'
import AppBlob from '@/components/decor/AppBlob.vue'
import SuitGlyph from '@/components/cards/SuitGlyph.vue'
import { en } from '@/locales/en'

const t = en.hub
</script>
