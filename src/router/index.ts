import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Layouts
import DefaultLayout from '@/modules/common/layouts/DefaultLayout.vue'

// Views
import Home from '@/modules/home/views/Home.vue'
import About from '@/modules/about/views/About.vue'
import ImposterGame from '@/modules/imposter/views/ImposterGame.vue'

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

/**
 * Route Constants
 *
 * All routes defined in one place.
 */
export const ROUTE_NAMES = {
  HOME: 'home',
  ABOUT: 'about',
  IMPOSTER: 'imposter',
} as const

export const ROUTE_PATHS = {
  HOME: '/',
  ABOUT: '/about',
  IMPOSTER: '/imposter',
} as const

/**
 * Routes Configuration
 *
 * Main routes configuration with layouts and components.
 * The /imposter route is full-screen and bypasses the DefaultLayout.
 */
const routes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATHS.HOME,
    component: DefaultLayout,
    meta: { layout: 'default' },
    children: [
      {
        path: '',
        component: Home,
        name: ROUTE_NAMES.HOME,
        meta: { title: 'Home' },
      },
      {
        path: ROUTE_PATHS.ABOUT,
        component: About,
        name: ROUTE_NAMES.ABOUT,
        meta: { title: 'About' },
      },
    ],
  },
  // Imposter game – full-screen, no shared nav/footer
  {
    path: ROUTE_PATHS.IMPOSTER,
    component: ImposterGame,
    name: ROUTE_NAMES.IMPOSTER,
    meta: { title: 'Imposter Game' },
  },
  // 404 Catch-all
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
 * Global Route Guard – sets document title
 */
router.beforeEach((to, _from, next) => {
  if (to.meta.title) {
    document.title = `${to.meta.title} · Imposter Game`
  }
  next()
})

export default router



