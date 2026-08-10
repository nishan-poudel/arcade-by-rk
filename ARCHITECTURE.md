# Architecture

## Design Principles

### 1. Single-Purpose App

**Why**: The entire app is the Imposter party game — there's no separate
marketing/home page. `src/modules/imposter/` contains the whole feature
(views, components, composables, types).

```
src/modules/
└── imposter/       # Imposter party game (see below) — the entire app
```

### 2. Routing

**Why**: Single source of truth, and intentionally minimal since there's
only one feature. Defined in `src/router/index.ts`:

```typescript
export const ROUTE_NAMES = { IMPOSTER: 'imposter' }
export const ROUTE_PATHS = { IMPOSTER: '/' }

// `:roomCode?` is optional so `/` (fresh landing) and `/ABC123` (shareable
// room link / reload while in a room) both resolve to the same component.
const routes = [
  { path: '/:roomCode?', component: ImposterGame, name: ROUTE_NAMES.IMPOSTER },
  { path: '/:pathMatch(.*)*', redirect: ROUTE_PATHS.IMPOSTER },
]
```

### 3. State Management

**Why**: No global store (Vuex/Pinia) is used. The game owns its state via
Vue `ref`/`computed` composables (`useGame.ts`), colocated with the feature
that needs it — there's no cross-feature shared state to justify a store.

### 4. Composition API & Composables

**Why**: Reusable logic extracted into functions. Better code organization.

```typescript
export function useMyLogic() {
  const state = ref(0)
  const increment = () => state.value++
  return { state, increment }
}
```

### 5. TypeScript for Type Safety

**Why**: Catch errors at compile time. Better IDE support. Types shared
between client and server live in `shared/types/index.ts`.

### 6. Path Aliases

**Why**: Clean imports without relative paths (`@/` → `src/`).

```typescript
import { useGame } from '@/modules/imposter/composables/useGame'
```

---

## How to Add a New Feature

Should the app ever grow beyond a single game, follow the existing module
pattern:

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

const routes = [
  ...,
  { path: ROUTE_PATHS.MY_FEATURE, component: MyFeature, name: ROUTE_NAMES.MY_FEATURE },
]
```

Done! ✓

---

## File Locations

| Task | Location |
|------|----------|
| Add/change route | `src/router/index.ts` |
| Add page | `src/modules/myfeature/views/MyPage.vue` |
| Add component | `src/modules/myfeature/components/MyComponent.vue` |
| Add shared type | `shared/types/index.ts` |

---

## Imposter Party Game

The root route (`/`, with an optional `/:roomCode` for shareable room links)
mounts a full-featured, real-time in-person party game — it **is** the app.

### Full-Stack Overview

```
web/
├── client (Vue 3 + Vite + Tailwind)   → http://localhost:5100
│   └── src/
│       ├── components/ui/   shadcn-vue-style primitives (Button, Card, Input,
│       │                    Badge, Switch, Progress, Separator, ToggleGroup,
│       │                    AlertDialog) built on `reka-ui` headless
│       │                    components + `class-variance-authority` for
│       │                    variants — shared across every game screen
│       ├── lib/utils.ts     `cn()` — merges Tailwind classes (clsx + tailwind-merge)
│       └── modules/imposter/
│           ├── views/           ImposterGame.vue  – root screen router
│           ├── components/      LandingScreen · WaitingRoom · PlayerScreen
│           │                    HostScreen · RoundReveal · GameOverScreen
│           ├── composables/     useGame.ts  – all reactive state + socket actions
│           │                    useSocket.ts – singleton Socket.IO connection
│           └── types/           index.ts    – re-exports shared types
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
| server → client | `player_assignment`  | Private: own role + word only, sent **before** game_state broadcast; the host receives the same shape as any other player |
| server → client | `discussion_time`    | All players (or host skip) have finished their turn  |
| server → client | `round_reveal`       | Public reveal: word + imposter names + ejected player + aggregate vote counts (individual ballots are never revealed) |
| server → client | `game_ended`         | Session over                                         |
| server → client | `error`              | Structured error for the receiving socket            |

---

## Security Architecture

### CRITICAL: Imposter Identity Isolation

The most important security property of this game is that **no player can learn who the imposters are by intercepting network traffic** — and this includes the host. The host is just another player who happens to coordinate turns/voting; they can themselves be assigned the imposter role and must not get advance knowledge of anyone else's role.

**Threat model**: A player (including the host) opens DevTools → Network → WebSocket and reads all incoming socket messages.

**Mitigation** (enforced server-side in `handlers.ts` / `GameService.ts`):
- The `player_assignment` event is sent **individually** to each socket (not broadcast).
- Every assignment contains only the recipient's own `role` and `word` — never any other player's role.
- The server _never_ relies on the client to hide this data; there is no client-only concept of "host sees more".

```
Host socket       → { role, word }
Crewmate socket   → { role, word }
Imposter socket   → { role: 'imposter', word: null }
```

Imposter identities are only revealed to everyone simultaneously, in the public `round_reveal` payload once the round has ended.

### Vote Privacy

Individual ballots ("who voted for whom") are never sent to clients. `round_reveal` only includes aggregate `voteCounts` (votes received per player) and the ejected player, if any — enough to render a results bar chart without exposing each player's private vote choice.

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

**Last updated**: August 2026
