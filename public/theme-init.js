/*
 * Runs before the app mounts so the correct theme is painted on the very first
 * frame — no flash of the wrong colours on load / route entry.
 *
 * Kept as an external file (not inline) so the production CSP can stay strict
 * (`script-src 'self'`, no `'unsafe-inline'`). Mirrors the logic in
 * src/modules/shared/composables/useTheme.ts — keep the storage key in sync.
 */
(function () {
  try {
    const stored = localStorage.getItem('arcade_theme')
    const theme = stored === 'light' || stored === 'dark' ? stored : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark')
  }
})()
