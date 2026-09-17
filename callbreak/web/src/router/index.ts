import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

// Every game is lazy-loaded so each ships as its own chunk.
const Hub = () => import('@/modules/HubScreen.vue')
const CallBreakGame = () => import('@/modules/game/views/CallBreakGame.vue')
const ScoreKeeper = () => import('@/modules/scorekeeper/views/ScoreKeeper.vue')
const FarasGame = () => import('@/modules/faras/views/FarasGame.vue')
const NishanPage = () => import('@/modules/nishan/NishanPage.vue')

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
  }
}

export const ROUTE_NAMES = {
  HUB: 'hub',
  GAME: 'game',
  SCORE: 'score',
  FARAS: 'faras',
  NISHAN: 'nishan',
} as const

export const ROUTE_PATHS = {
  HUB: '/',
  GAME: '/play',
  SCORE: '/score',
  FARAS: '/faras',
  NISHAN: '/nishan',
} as const

const routes: RouteRecordRaw[] = [
  {
    path: ROUTE_PATHS.HUB,
    component: Hub,
    name: ROUTE_NAMES.HUB,
    meta: { title: 'Taas Adda' },
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
    path: '/faras/:roomCode?',
    component: FarasGame,
    name: ROUTE_NAMES.FARAS,
    meta: { title: 'Taas Adda: Faras' },
  },
  {
    path: ROUTE_PATHS.NISHAN,
    component: NishanPage,
    name: ROUTE_NAMES.NISHAN,
    meta: { title: 'Nishan Poudel — Software Engineer' },
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
