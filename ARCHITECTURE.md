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

A **game** = one secret word + one imposter assignment, played out over as many
**voting rounds** as it takes to decide it.

```
lobby ──► playing ──► discussion ──┐
  ▲       (describe)   (repeat: discuss → vote → eject)
  │                         │
  │        ┌────────────────┤
  │   wrong ejection    imposter ejected  /  imposters reach parity
  │   (game continues)       │
  │                          ▼
  └──◄── (host: New Game) ── gameOutcome set ──► ended (host: End Session)
```

- **lobby** / **playing** / **discussion** / **ended** are authoritative
  server-side `GamePhase` values.
- The **describe** turns run **once** per game (phase `playing`). After that the
  game stays in `discussion` and cycles: everyone still in votes, the
  most-voted player is ejected, repeat.
- **Win conditions** (checked after every ejection, and after any player leaves
  mid-game): all imposters ejected → **crew win**; imposters ≥ remaining crew →
  **imposter win**. `room.gameOutcome` is then set (`'crew'` | `'imposter'`) and
  stays set until the host starts a new game — a `game_state` with `gameOutcome`
  set always resolves the client to the reveal screen.
- **reveal** is a client screen shown once `gameOutcome` is set (driven by the
  `game_result` event, also derivable from `game_state`). The **score modal**
  pops on top of it.
- A **tie** (or no clear top vote) ejects nobody — votes are cleared, `vote_tie`
  is broadcast, the group votes again. `force_reveal_votes` breaks a tie by
  ejecting a random top candidate so the host can always move things along.

### Scoring

Points are awarded once per game, in `applyGameScore`:

| Outcome | Player | Points |
|---|---|---|
| Crew win | surviving crewmate | `max(1, 3 − wrongEjections)` |
| Crew win | wrongly-ejected crewmate | `1` |
| Crew win | imposter | `0` |
| Imposter win | each imposter | `2 + 2 × wrongEjections` |
| Imposter win | everyone else | `0` |

`wrongEjections` = innocent players voted out during the game. `player.score` is
the running session total; `player.lastGamePoints` is the just-finished game's
points (shown as a `+N` chip and in the score modal).

### Imposter selection (fairness)

Imposters are picked with **weighted random sampling without replacement**, not a plain shuffle:
- Every player carries `lastImposterRound` (0 = never).
- Whoever was the imposter in the *immediately previous* round is hard-skipped, as long as enough other players remain to fill the slots and still leave a crewmate.
- The rest are weighted by how long ago they were last the imposter (never-been players get the strongest pull), so the role spreads across the group instead of sticking to one person.
- `reset_scores` also clears every `lastImposterRound`, restarting the rotation for a fresh game.

The host is always in the candidate pool — they can be the imposter like anyone else.

### Staying in sync / reconnection

- The client attempts `request_state` on **every** socket connect (first load, auto-reconnect, `connectionStateRecovery`), with a short backoff retry if the server hasn't yet processed the previous socket's disconnect.
- A cheap periodic `request_state` (every 12 s) and a `visibilitychange` handler re-converge any client that drifted — phones freeze background sockets, so this is the main defence against "I didn't see the update".
- A manual **Refresh** button (the connection pill, and the connection-lost banner) forces a reconnect + resync so nobody has to hard-reload the page.
- Socket.IO client: infinite reconnection attempts; server: `connectionStateRecovery` (2 min) + tightened ping timeouts.
- During **discussion**, every player still in the game votes (`submit_vote`);
  eliminated players are spectators and cannot vote or be voted for. Each voting
  round auto-tallies the moment every *connected, non-eliminated* player has
  voted; the host can `force_reveal_votes` early. Votes are cleared after each
  round.

### Real-time Communication (Socket.IO events)

| Direction       | Event                | Description                                          |
|-----------------|----------------------|------------------------------------------------------|
| client → server | `create_room`        | Host creates a room                                  |
| client → server | `join_room`          | Player joins by code                                 |
| client → server | `rejoin_room`        | Reconnecting player restores session                 |
| client → server | `request_state`      | Ask for a fresh snapshot + own assignment (manual Refresh button, periodic resync, tab-focus, every socket reconnect). Falls back to a full rejoin-by-name if the server no longer knows the socket (e.g. it restarted). |
| client → server | `start_game`         | Host starts first round (host only)                  |
| client → server | `player_done`        | Current-turn player presses Done                     |
| client → server | `skip_turn`          | Host skips the current player's turn (AFK)           |
| client → server | `change_word`        | Host scraps the current round for a fresh word — new word + decoy, imposters re-picked, turns reset; round counter is **not** advanced and nothing is scored (host only, confirmed client-side) |
| client → server | `remove_player`      | Host removes a player who is currently **offline** (host only; refuses online players, the host, and any removal that would drop an in-progress game below 3 players — the host is told to end the game instead) |
| client → server | `submit_vote`        | Cast/change my vote for who to eject (discussion phase; still-in players only) |
| client → server | `force_reveal_votes` | Host tallies the current voting round now; breaks a tie randomly (host only) |
| client → server | `next_round`         | Host starts a brand-new game (new word + imposter)   |
| client → server | `end_game`           | Host ends the whole session                          |
| client → server | `reset_scores`       | Host resets all scores to 0 (also restarts the imposter-rotation history) |
| client → server | `set_difficulty`     | Host changes word difficulty (lobby only)            |
| client → server | `set_imposter_count` | Host changes imposter count (lobby only)             |
| server → client | `game_state`         | Broadcast: public state — includes `voteRound`, `gameOutcome`, per-player `eliminated` / `eliminatedInRound` / `lastGamePoints`, plus `turnOrder` / `nextTurnPlayerId` |
| server → client | `player_assignment`  | Private: own role + word **or** decoy hint, sent **before** game_state broadcast; the host receives the same shape as any other player |
| server → client | `state_synced`       | Private reply to `request_state` / a recovered connection: `{ gameState, assignment, result }` for just this socket (`result` set only when a game is over) |
| server → client | `word_changed`       | Broadcast: the host used "New Word" — clients reset their per-game local state |
| server → client | `removed_from_room`  | Private: the host removed you; client drops its saved session |
| server → client | `discussion_time`    | All players (or host skip) have finished their describe turn |
| server → client | `ejection_result`    | Broadcast after each vote tally: `{ ejectedId, ejectedName, wasImposter, voteRound, ballotNames, remaining, gameOver, outcome }` — individual ballots ARE included (the round has resolved) |
| server → client | `vote_tie`           | Broadcast: the vote tied / had no clear winner — nobody ejected, vote again |
| server → client | `game_result`        | Broadcast once a game is decided: `{ outcome, word, imposterHint, imposterNames, voteHistory, scores }` — full round-by-round ballot history + every player's points & totals |
| server → client | `game_ended`         | Whole session over (host)                            |
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
Host socket       → { role, word, hint: null }
Crewmate socket   → { role: 'crewmate', word, hint: null }
Imposter socket   → { role: 'imposter', word: null, hint: <decoy word> }
```

The imposter's `hint` is a word closely related to — but never equal to — the real secret word (sourced from the `[word, decoy]` pairs in `config/*.json`). It gives the imposter something plausible to bluff with; it is still only their **own** assignment and reveals nothing about other players.

Imposter identities are only revealed to everyone simultaneously, once the game is decided (`game_result`).

### Vote Visibility

Each player picks a candidate locally, then presses **Submit** — that one submission is **locked** for the voting round (`submitVote` rejects any later change; `room.votes` is cleared each round, so the lock lifts for the next one). Nothing is sent to the server until Submit.

While a voting round is **open**, clients only see `hasVoted` per player (not the target). The moment a round **resolves**, the full "who voted for whom" is broadcast — in `ejection_result.ballotNames` and, at game end, in `game_result.voteHistory` (round by round). This is a deliberate design choice: seeing the ballots is part of the post-round social deduction. Nothing is ever revealed *before* a vote resolves.

### Input Validation Layer (`security/validator.ts`)

Every socket event payload is validated **before** the game logic runs:

| Field            | Validation                                           |
|------------------|------------------------------------------------------|
| `playerName`     | string, 1–24 chars, no control characters            |
| `roomCode`       | string, exactly 6 uppercase alphanumeric chars       |
| `difficulty`     | one of: `'easy'`, `'medium'`, `'hard'`               |
| `imposterCount`  | integer, 1–4                                         |
| `targetPlayerId` / `votedPlayerId` | non-empty string                  |
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

**Last updated**: September 2026
