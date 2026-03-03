import { watchEffect, type Ref } from 'vue'

const DEFAULT_TITLE = 'WEB APP'

/**
 * Sets the browser tab title reactively.
 * Pass a plain string or a reactive ref.
 *
 * @example
 * usePageTitle('Home')
 * usePageTitle(computed(() => `${user.name}'s Profile`))
 */
export function usePageTitle(title?: string | Ref<string>) {
  watchEffect(() => {
    if (typeof document === 'undefined') {return}

    const value = typeof title === 'string' ? title : (title?.value ?? '')

    document.title = value || DEFAULT_TITLE
  })
}
