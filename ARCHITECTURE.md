# Architecture

## Design Principles

This application is built on clean, modular architecture for scalability and maintainability.

### 1. Modular Feature Organization

**Why**: Keep related code together. Each feature (home, about, etc.) is self-contained.

```
src/modules/
├── home/           # Home feature
│   ├── views/      # Home page component
│   └── components/ # Home-specific components
├── about/          # About feature
│   ├── views/      # About page component
│   └── components/ # About-specific components
├── common/         # Shared layouts
└── shared/         # Global logic (stores, services, config, types)
```

### 2. All Routes in One Place

**Why**: Single source of truth. Easy to see all routes at a glance.

```typescript
// src/router/index.ts - All routes defined here
export const ROUTE_NAMES = { HOME: 'home', ABOUT: 'about' }
export const ROUTE_PATHS = { HOME: '/', ABOUT: '/about' }

const routes = [
  {
    path: ROUTE_PATHS.HOME,
    component: DefaultLayout,
    children: [
      { path: '', component: Home, name: ROUTE_NAMES.HOME },
      { path: ROUTE_PATHS.ABOUT, component: About, name: ROUTE_NAMES.ABOUT },
    ]
  }
]
```

### 3. Shared Logic Centralized

**Why**: Reusable code lives in one place. Easy to maintain and extend.

```
src/modules/shared/
├── stores/       # Vuex state management
├── services/     # API calls (Axios client)
├── composables/  # Reusable Vue logic
├── config/       # Environment configuration
└── types/        # TypeScript definitions
```

### 4. Vuex for State Management

**Why**: Official Vue state management. Clear patterns: state, mutations, actions, getters.

```typescript
// src/modules/shared/stores/counter.ts
export default {
  namespaced: true,
  state: () => ({ count: 0 }),
  mutations: {
    INCREMENT(state) { state.count++ }
  }
}
```

### 5. API Service Layer (Axios)

**Why**: Keep HTTP calls separate from components. Easy to test and maintain.

```typescript
// src/modules/shared/services/api.ts
export const apiClient = new ApiClient(baseURL)

// Use in stores or composables
const data = await apiClient.get('/endpoint')
```

### 6. Composition API & Composables

**Why**: Reusable logic extracted into functions. Better code organization.

```typescript
export function useMyLogic() {
  const state = ref(0)
  const increment = () => state.value++
  return { state, increment }
}
```

### 7. TypeScript for Type Safety

**Why**: Catch errors at compile time. Better IDE support.

```typescript
interface CounterState {
  count: number
}
```

### 8. Path Aliases

**Why**: Clean imports without relative paths.

```typescript
// Instead of: import { api } from '../../../services/api'
import { apiClient } from '@/modules/shared/services/api'
```

---

## How to Add a New Feature

### 1. Create Folder Structure
```bash
mkdir -p src/modules/myfeature/views
mkdir -p src/modules/myfeature/components
```

### 2. Create View Component
```vue
<!-- src/modules/myfeature/views/MyFeature.vue -->
<template><div>My Feature</div></template>
<script setup lang="ts">// Your code</script>
```

### 3. Add Route in `src/router/index.ts`
```typescript
export const ROUTE_NAMES = { ..., MY_FEATURE: 'myfeature' }
export const ROUTE_PATHS = { ..., MY_FEATURE: '/myfeature' }

const routes = [{
  path: ROUTE_PATHS.HOME,
  component: DefaultLayout,
  children: [
    ...,
    { 
      path: ROUTE_PATHS.MY_FEATURE, 
      component: MyFeature, 
      name: ROUTE_NAMES.MY_FEATURE 
    }
  ]
}]
```

Done! ✓

---

## How to Add State (Vuex)

### 1. Create Module
```typescript
// src/modules/shared/stores/myfeature.ts
export default {
  namespaced: true,
  state: () => ({ data: [] }),
  mutations: { SET_DATA(state, data) { state.data = data } },
  actions: { 
    async fetchData({ commit }) {
      const data = await apiClient.get('/myfeature')
      commit('SET_DATA', data)
    }
  }
}
```

### 2. Register in `src/modules/shared/stores/index.ts`
```typescript
import myfeatureModule from './myfeature'

export const store = createStore({
  modules: {
    counter: counterModule,
    myfeature: myfeatureModule  // ← Add here
  }
})
```

### 3. Use in Component
```typescript
const store = useStore()
const data = computed(() => store.state.myfeature.data)
const load = () => store.dispatch('myfeature/fetchData')
```

---

## How to Add API Calls

### In a Service
```typescript
// src/modules/shared/services/api.ts
export const myApi = {
  async getUsers() {
    return apiClient.get('/users')
  },
  async createUser(data) {
    return apiClient.post('/users', data)
  }
}
```

### Use in Store
```typescript
const fetchUsers = async () => {
  const response = await myApi.getUsers()
  commit('SET_USERS', response.data)
}
```

---

## File Locations

| Task | Location |
|------|----------|
| Add/change route | `src/router/index.ts` |
| Add page | `src/modules/myfeature/views/MyPage.vue` |
| Add component | `src/modules/myfeature/components/MyComponent.vue` |
| Add state | `src/modules/shared/stores/myfeature.ts` |
| Add API | `src/modules/shared/services/api.ts` |
| Add logic | `src/modules/shared/composables/useMyLogic.ts` |
| Add config | `src/modules/shared/config/index.ts` |
| Add type | `src/modules/shared/types/index.ts` |

---

## Benefits

✅ Easy to understand
✅ Easy to scale
✅ Easy to test
✅ Easy to maintain
✅ Clear folder organization
✅ Consistent patterns

---

**Created**: March 2, 2026

---

## Imposter Party Game

The `/imposter` route mounts a full-featured, real-time in-person party game.

### Full-Stack Overview

```
web/
├── client (Vue 3 + Vite + Tailwind)   → http://localhost:5100
│   └── src/modules/imposter/
│       ├── views/           ImposterGame.vue  – root screen router
│       ├── components/      LandingScreen · WaitingRoom · PlayerScreen
│       │                    HostScreen · RoundReveal · GameOverScreen
│       ├── composables/     useGame.ts  – all reactive state + socket actions
│       │                    useSocket.ts – singleton Socket.IO connection
│       └── types/           index.ts    – re-exports shared types
│
├── server/ (Node.js + Express + Socket.IO)  → http://localhost:3001
│   └── src/
│       ├── index.ts          entry, helmet, CORS, graceful shutdown
│       ├── config/           word-list loader, env config
│       ├── game/             GameService.ts – all game logic
│       ├── socket/           handlers.ts – validated event handlers
│       ├── security/         validator.ts · rateLimiter.ts
│       └── utils/            logger.ts
│
├── shared/types/index.ts     TypeScript interfaces used by both sides
└── config/                   easy.json · medium.json · hard.json (word lists)
```

### Game State Machine

```
                       ┌─────────────────────────────────────┐
                       │          SERVER PHASES               │
lobby  →  playing  →  discussion  →  ended                   │
                         │                                    │
                         ▼          CLIENT-ONLY UI STATES     │
                       reveal  →  (next round → playing)      │
                                └──────────────────────────────┘
```

- **lobby** / **playing** / **discussion** / **ended** are authoritative server-side `GamePhase` values.
- **reveal** is a client-side UI state triggered by the `round_reveal` socket event. It is never part of the `GameState.phase`; incoming `game_state` broadcasts do not override it.
- During **discussion**, players vote in-app for who they think the imposter is
  (`submit_vote`). The round auto-tallies the moment every *connected* player has
  voted; the host can also `force_reveal_votes` early (e.g. an AFK player is
  blocking the auto-tally). Majority vote → that player is ejected and scored;
  a tie (or zero votes) means nobody is ejected, which counts as the imposter(s)
  surviving. Votes are cleared at the start of every round.

### Real-time Communication (Socket.IO events)

| Direction       | Event                | Description                                          |
|-----------------|----------------------|------------------------------------------------------|
| client → server | `create_room`        | Host creates a room                                  |
| client → server | `join_room`          | Player joins by code                                 |
| client → server | `rejoin_room`        | Reconnecting player restores session                 |
| client → server | `start_game`         | Host starts first round (host only)                  |
| client → server | `player_done`        | Current-turn player presses Done                     |
| client → server | `skip_turn`          | Host skips the current player's turn (AFK)           |
| client → server | `submit_vote`        | Cast/change my vote for the suspected imposter (discussion phase) |
| client → server | `force_reveal_votes` | Host tallies votes early, even if not everyone voted (host only) |
| client → server | `next_round`         | Host advances to next round                          |
| client → server | `end_game`           | Host ends session                                    |
| client → server | `reset_scores`       | Host resets all scores to 0                          |
| client → server | `set_difficulty`     | Host changes word difficulty (lobby only)            |
| client → server | `set_imposter_count` | Host changes imposter count (lobby only)             |
| server → client | `game_state`         | Broadcast: public state for all players (includes each player's `hasVoted`) |
| server → client | `player_assignment`  | Private: role + word sent **before** game_state broadcast; host gets imposterIds |
| server → client | `discussion_time`    | All players (or host skip) have finished their turn  |
| server → client | `round_reveal`       | Public reveal: word + imposter names + ejected player + full vote tally/breakdown |
| server → client | `game_ended`         | Session over                                         |
| server → client | `error`              | Structured error for the receiving socket            |

---

## Security Architecture

### CRITICAL: Imposter Identity Isolation

The most important security property of this game is that **no player can learn who the imposters are by intercepting network traffic**.

**Threat model**: A player opens DevTools → Network → WebSocket and reads all incoming socket messages.

**Mitigation** (enforced server-side in `handlers.ts`):
- The `player_assignment` event is sent **individually** to each socket (not broadcast).
- The `imposterIds` array is **only populated in the copy sent to the host socket**.
- Every other player – crewmate or imposter – receives `imposterIds: []`.
- The server _never_ relies on the client to hide this field.

```
Host socket       → { role, word, imposterIds: ['socket-abc', 'socket-xyz'] }
Crewmate socket   → { role, word, imposterIds: [] }
Imposter socket   → { role: 'imposter', word: null, imposterIds: [] }
```

### Input Validation Layer (`security/validator.ts`)

Every socket event payload is validated **before** the game logic runs:

| Field            | Validation                                           |
|------------------|------------------------------------------------------|
| `playerName`     | string, 1–24 chars, no control characters            |
| `roomCode`       | string, exactly 6 uppercase alphanumeric chars       |
| `difficulty`     | one of: `'easy'`, `'medium'`, `'hard'`               |
| `imposterCount`  | integer, 1–4                                         |
| `imposterCaught` | boolean                                              |
| any payload      | must be a plain object (not null / array)            |

TypeScript types provide compile-time safety; this layer provides _runtime_ safety.

### Rate Limiting (`security/rateLimiter.ts`)

Per-socket sliding-window rate limiter (no external dependency):

- **Global**: max 30 events per 5-second window per socket
- **Per-event**: max 5 rapid-fire calls for any single event name
- On disconnect: all buckets for that socket are freed immediately
- Periodic purge loop prevents unbounded memory growth

### HTTP Security Headers (helmet)

`helmet` is applied to all Express routes:
- `X-Frame-Options: DENY` – prevents clickjacking
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` – active in prod with HTTPS
- `Content-Security-Policy` – locked down (API server only)

### CORS Policy

- `CORS_ORIGINS` env var controls the allowlist (comma-separated).
- Requests from unlisted origins are rejected with a log warning.
- **Never** set `CORS_ORIGINS=*` in production.

### Request Body Limit

`express.json({ limit: '10kb' })` – prevents payload bomb attacks.

### Socket.IO Max Buffer

`maxHttpBufferSize: 1e6` (1 MB) – limits max single WS frame size.

### Information Disclosure Prevention

- Health endpoint returns only `{ status: 'ok' }` in production.
- Secret word is **never logged** on the server.
- `x-powered-by` header is disabled.
- Undefined routes return `{ error: 'Not found' }` – no stack traces exposed.
- Structured JSON logging in production; errors route to `stderr`.

### Memory / Resource Limits

- Max 500 concurrent rooms (`MAX_ROOMS` in `GameService.ts`).
- Rooms inactive > 2 hours are automatically evicted by the janitor.
- Rate-limit buckets cleaned up on disconnect and via periodic purge.

### Reconnection Security

Reconnection matches only on **name + disconnected status**. A currently-connected player cannot be hijacked by reusing their name from a different socket.

---

## Deploying to Production

### Checklist

- [ ] Set `NODE_ENV=production` on the server process
- [ ] Set `CORS_ORIGINS` to your exact front-end URL (e.g. `https://game.yourdomain.com`)
- [ ] Place the server behind a TLS-terminating reverse proxy (nginx / Caddy / ALB)
- [ ] Ensure `PORT` matches the proxy's upstream target
- [ ] Run the server as a non-root user
- [ ] Set resource limits (memory, CPU) on the container / process
- [ ] Monitor `/api/health` with an uptime checker
- [ ] Stream server logs to a log aggregator (JSON output is Datadog / CloudWatch ready)

### Scaling Beyond One Instance

The current in-memory `Map` in `GameService` does not survive restarts or scale across multiple Node processes. To scale horizontally:
1. Replace the `rooms` Map with a Redis hash (use `ioredis`).
2. Replace the in-process rate-limiter with a Redis-backed one (`rate-limiter-flexible`).
3. Configure Socket.IO with the `socket.io-redis` adapter so events broadcast across instances.

---

**Last updated**: July 2026
