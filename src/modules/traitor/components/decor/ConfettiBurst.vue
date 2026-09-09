<script setup lang="ts">
/**
 * Small CSS-only confetti burst. Copied from the Imposter module so the Traitor
 * module stays self-contained. Purely decorative — `aria-hidden`. Frozen under
 * `prefers-reduced-motion` by the global rule in src/assets/tailwind.css.
 */
const FLAVORS = ['citron', 'peach', 'berry', 'grape', 'lychee', 'melon'] as const

const pieces = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  flavor: FLAVORS[i % FLAVORS.length],
  delay: `${(i % 6) * 0.08}s`,
  rotate: `${(i * 53) % 360}deg`,
  size: 6 + (i % 3) * 2,
}))
</script>

<template>
  <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-64 overflow-hidden">
    <span
      v-for="(p, i) in pieces"
      :key="i"
      class="absolute top-0 block rounded-sm animate-confetti-fall"
      :style="{
        left: p.left,
        width: `${p.size}px`,
        height: `${p.size}px`,
        backgroundColor: `hsl(var(--flavor-${p.flavor}))`,
        animationDelay: p.delay,
        transform: `rotate(${p.rotate})`,
      }"
    />
  </div>
</template>
