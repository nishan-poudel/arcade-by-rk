import { createStore } from 'vuex'
import counterModule from './counter'

/**
 * Main Vuex Store
 *
 * Central state management.
 * Modules are organized by feature in stores/modules/
 */

export const store = createStore({
  modules: {
    counter: counterModule,
  },
})
