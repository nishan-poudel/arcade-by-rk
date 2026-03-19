import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Layout
import DefaultLayout from '@/modules/common/layouts/DefaultLayout.vue'

// Games
import TerminalGame from '@/modules/game/views/TerminalGame.vue'
import MathPuzzle   from '@/modules/mathpuzzle/views/MathPuzzle.vue'
import HomePage     from '@/modules/home/views/HomePage.vue'
import About       from '@/modules/about/views/About.vue'

/**
 * Route Metadata Type
 */
declare module 'vue-router' {
  interface RouteMeta {
    layout?: string
    requiresAuth?: boolean
    title?: string
  }
}

export const ROUTE_NAMES = {
  HOME:   'home',
  GAME:   'game',
  PUZZLE: 'puzzle',
  ABOUT:  'about',
} as const

export const ROUTE_PATHS = {
  HOME:   '/',
  GAME:   '/game',
  PUZZLE: '/puzzle',
  ABOUT:  '/about',
} as const

/**
 * Routes
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: DefaultLayout,
    meta: { layout: 'default' },
    children: [
      // Home page
      {
        path: '',
        component: HomePage,
        name: ROUTE_NAMES.HOME,
        meta: { title: 'Arcade' },
      },
      {
        path: ROUTE_PATHS.GAME,
        component: TerminalGame,
        name: ROUTE_NAMES.GAME,
        meta: { title: 'Grid Raider' },
      },
      {
        path: ROUTE_PATHS.PUZZLE,
        component: MathPuzzle,
        name: ROUTE_NAMES.PUZZLE,
        meta: { title: 'Math Chain' },
      },
      {
        path: ROUTE_PATHS.ABOUT,
        component: About,
        name: ROUTE_NAMES.ABOUT,
        meta: { title: 'About' },
      },
    ],
  },
  // 404 — send to home
  {
    path: '/:pathMatch(.*)*',
    redirect: ROUTE_PATHS.HOME,
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
 * Global Route Guard
 *
 * If a route declares `requiresAuth: true`, access is denied until an auth
 * mechanism is wired up.  The guard is intentionally strict — it redirects
 * to home rather than silently passing through (no stub next() calls).
 */
router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth) {
    next({ path: ROUTE_PATHS.GAME, replace: true })
    return
  }
  next()
})

export default router


