import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Both games are lazy-loaded so each ships as its own chunk.
const Hub = () => import('@/modules/HubScreen.vue')
const CallBreakGame = () => import('@/modules/game/views/CallBreakGame.vue')
const ScoreKeeper = () => import('@/modules/scorekeeper/views/ScoreKeeper.vue')

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

export const ROUTE_NAMES = {
  HUB: 'hub',
  GAME: 'game',
  SCORE: 'score',
} as const

export const ROUTE_PATHS = {
  HUB: '/',
  GAME: '/play',
  SCORE: '/score',
} as const

const routes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATHS.HUB,
    component: Hub,
    name: ROUTE_NAMES.HUB,
    meta: { title: 'Call Break' },
  },
  {
    path: '/play/:roomCode?',
    component: CallBreakGame,
    name: ROUTE_NAMES.GAME,
    meta: { title: 'Call Break: Play Online' },
  },
  {
    path: '/score/:roomCode?',
    component: ScoreKeeper,
    name: ROUTE_NAMES.SCORE,
    meta: { title: 'Call Break: Score Keeper' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: ROUTE_PATHS.HUB,
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to, _from, next) => {
  if (to.meta.title) document.title = to.meta.title
  next()
})

export default router
