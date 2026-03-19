import { ref, computed } from 'vue'
import { en as locale } from '@/locales/en'

/**
 * Global name toggle state shared across the app
 * Used for the "Nishan" ↔ "Rocky Kaka" animation in About page and footer
 */
const isRockingKaka = ref(false)
const isRotating = ref(false)

export const useNameToggle = () => {
  const displayName = computed(() =>
    isRockingKaka.value ? locale.about.nameAlternate : locale.about.nameDefault
  )

  const toggleName = () => {
    isRotating.value = true
    setTimeout(() => {
      isRockingKaka.value = !isRockingKaka.value
      isRotating.value = false
    }, 1200)
  }

  return {
    isRockingKaka,
    isRotating,
    displayName,
    toggleName,
  }
}
