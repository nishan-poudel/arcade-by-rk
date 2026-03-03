import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Layouts
import DefaultLayout from '@/modules/common/layouts/DefaultLayout.vue'

// Views
import Home from '@/modules/home/views/Home.vue'
import About from '@/modules/about/views/About.vue'

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
} as const

export const ROUTE_PATHS = {
  HOME: '/',
  ABOUT: '/about',
} as const

/**
 * Routes Configuration
 *
 * Main routes configuration with layouts and components.
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
      },
      {
        path: ROUTE_PATHS.ABOUT,
        component: About,
        name: ROUTE_NAMES.ABOUT,
      },
    ],
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
 * Global Route Guard
 */
router.beforeEach((to, _from, next) => {
  if (to.meta.requiresAuth) {
    console.log('Route requires auth:', to.path)
  }
  next()
})

export default router


