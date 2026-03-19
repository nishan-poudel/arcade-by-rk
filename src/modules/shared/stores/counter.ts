/**
 * Counter Module
 *
 * Simple example module for managing counter state.
 */

export interface CounterState {
  count: number
}

export default {
  namespaced: true,

  state: (): CounterState => ({
    count: 0,
  }),

  mutations: {
    INCREMENT(state: CounterState) {
      state.count++
    },
    DECREMENT(state: CounterState) {
      state.count--
    },
    RESET(state: CounterState) {
      state.count = 0
    },
  },
}
