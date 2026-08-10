import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Views
import ImposterGame from '@/modules/imposter/views/ImposterGame.vue'

/**
 * Route Metadata Type
 */
declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

/**
 * Route Constants
 *
 * All routes defined in one place.
 */
export const ROUTE_NAMES = {
  IMPOSTER: 'imposter',
} as const

export const ROUTE_PATHS = {
  IMPOSTER: '/',
} as const

/**
 * Routes Configuration
 *
 * The Imposter game IS the app's homepage — there is no separate landing
 * page. :roomCode is optional so `/` (fresh landing) and `/ABC123`
 * (shareable room link / reload while in a room) both resolve here.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/:roomCode?',
    component: ImposterGame,
    name: ROUTE_NAMES.IMPOSTER,
    meta: { title: 'Imposter In Person' },
  },
  // 404 Catch-all
  {
    path: '/:pathMatch(.*)*',
    redirect: ROUTE_PATHS.IMPOSTER,
  },
]

/**
 * Create Router Instance
 */
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

/**
 * Global Route Guard – sets document title
 */
router.beforeEach((to, _from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title}`
  }
  next()
})

export default router



