/**
 * useTheme – app-wide light/dark toggle.
 *
 * The `.dark` class it drives is picked up everywhere via Tailwind's
 * `darkMode: ['class']` + the CSS variables in `src/assets/tailwind.css`.
 * A pre-paint inline script in `index.html` applies the stored/system
 * preference before Vue mounts, so there's no flash of the wrong theme;
 * this composable just keeps that class and the stored preference in sync
 * after the app loads.
 */
import { ref } from 'vue'

const STORAGE_KEY = 'arcade-theme'

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
}

const isDark = ref(document.documentElement.classList.contains('dark') ?? systemPrefersDark())

function apply(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  try {
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
  } catch {
    // localStorage unavailable (private mode / disabled) — theme just won't persist
  }
}

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
    apply(isDark.value)
  }

  return { isDark, toggle }
}
