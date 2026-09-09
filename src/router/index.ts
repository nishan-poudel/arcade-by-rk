import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Views are lazy-loaded so each game ships as its own chunk: opening `/`
// downloads only the Imposter code, `/traitor` only the Traitor code. The two
// games share nothing at runtime beyond the UI primitives / theme.
const ImposterGame = () => import('@/modules/imposter/views/ImposterGame.vue')
const TraitorGame = () => import('@/modules/traitor/views/TraitorGame.vue')

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
  TRAITOR: 'traitor',
} as const

export const ROUTE_PATHS = {
  IMPOSTER: '/',
  TRAITOR: '/traitor',
} as const

/**
 * Routes Configuration
 *
 * The Imposter game IS the app's homepage — there is no separate landing
 * page. :roomCode is optional so `/` (fresh landing) and `/ABC123`
 * (shareable room link / reload while in a room) both resolve here.
 */
const routes: RouteRecordRaw[] = [
  // Traitor game — a separate self-contained module. Declared before the
  // Imposter route: the static `traitor` segment out-ranks `/:roomCode?`, so
  // `/` and `/ABC123` still resolve to Imposter, and `/traitor` / `/traitor/ABC123`
  // resolve here.
  {
    path: '/traitor/:roomCode?',
    component: TraitorGame,
    name: ROUTE_NAMES.TRAITOR,
    meta: { title: 'Traitor In Person' },
  },
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



