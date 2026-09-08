# Imposter Party Game

A real-time in-person party game built with Vue 3 + TypeScript + Socket.IO. Players sit together, take turns saying a secret word out loud, and try to figure out who the imposter is.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm 9+**

## Installation & Setup

```bash
# 1. Install client dependencies
npm install

# 2. Install server dependencies
npm run server:install

# 3. Create environment files (optional — sensible defaults are provided)
cp .env.example .env
cp server/.env.example server/.env
```

## Running the App

```bash
# Start BOTH client + server together (recommended)
npm run dev

# Or start them separately:
npm run dev:client   # Vue client on http://localhost:5100
npm run dev:server   # Express + Socket.IO on http://localhost:3001

# Build client for production
npm run build

# Preview production build
npm run preview
```

## Playing the Game

1. One player opens the app and taps **Create Room** — they become the **Host**.
2. Everyone else taps **Join Room** and enters the 6-character code.
3. Host presses **Start Game**. Each person privately checks their phone to see their role and the secret word. The imposter doesn't get the real word — they get a *decoy* word that's close but not the same, so they have something to bluff with.
4. Players take turns saying **one word** out loud that relates to the secret word. A big banner + phone buzz tells you when it's your turn; the **Done** button sits pinned at the bottom of the screen.
5. Once everyone has described, the group talks it out. The vote panel is pinned at the top of the screen — pick a name, press **Submit**, and it's locked (no changing your mind). When everyone's in, the most-voted player is out — the app shows who they were and who voted for whom.
6. If that wasn't the imposter, the game **keeps going**: the ejected player spectates, everyone left votes again. Repeat until the imposter is caught (crew win) or the imposters can't be outvoted any more (imposter win).
7. Everyone sees a **score popup** — points for this game plus running totals. Catch the imposter fast for more points; the imposter scores by surviving. Host taps **New Game** for a fresh word, or **End Session**.

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start client **and** server together (uses concurrently) |
| `npm run dev:client` | Start Vite client only |
| `npm run dev:server` | Start Express/Socket.IO server only |
| `npm run build` | Build client for production |
| `npm run preview` | Preview production build |
| `npm run type-check` | TypeScript type check (client) |
| `npm run lint` | Lint and auto-fix |
| `npm run server:install` | Install server-side dependencies |

## Project Structure

```
web/
├── src/
│   ├── components/ui/     # shadcn-vue-style primitives (Button, Card, Input,
│   │                      #   Badge, Switch, Progress, ToggleGroup, AlertDialog)
│   ├── lib/utils.ts       # cn() — Tailwind class merging helper
│   ├── modules/
│   │   └── imposter/       # Imposter party game (the entire app)
│   │       ├── views/        # ImposterGame.vue (screen router, mounted at `/`)
│   │       ├── components/   # LandingScreen, WaitingRoom, PlayerScreen,
│   │       │              #   HostScreen, RoundReveal, GameOverScreen
│   │       ├── composables/  # useGame.ts, useSocket.ts
│   │       └── types/        # Client type re-exports
│   └── router/           # All client routes
├── server/               # Node.js + Express + Socket.IO backend
├── shared/types/         # TypeScript interfaces shared by client + server
└── config/               # Word lists (easy / medium / hard JSON)
```

### Word-list format (`config/*.json`)

Each file is an array of `["word", "decoy"]` pairs — `word` is shown to the
crewmates, `decoy` is the near-but-different word shown to the imposter:

```json
[
  ["स्याउ", "नासपाती"],
  ["काठमाडौं", "ललितपुर"]
]
```

A plain `"word"` string (no decoy) is still accepted for backward compatibility;
the imposter then just sees `???`.

## Key Technologies

| Layer | Technology |
|-------|------------|
| Client UI | Vue 3 + TypeScript + Vite |
| Components | shadcn-vue-style primitives on `reka-ui` + `class-variance-authority` |
| Styling | Tailwind CSS v3 (mobile-first, dark theme, CSS-variable design tokens) |
| Icons | `@lucide/vue` |
| Real-time | Socket.IO (client + server) |
| Server | Node.js + Express |
| State | Vue `ref`/`computed` composables (no global store needed) |
| Security | helmet, runtime validators, per-socket rate limiter |
| Shared types | TypeScript interfaces in `shared/types/` |

## Routing

The Imposter game **is** the app — there's no separate homepage. All routes
are defined in one place: `src/router/index.ts`.

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

## Folder Structure Explanation

- **components/ui** - shadcn-vue-style UI primitives shared by every screen
- **modules/imposter** - The game itself (views, components, composables)
- **router** - All route definitions

## Environment Variables

Client (`.env`):
```env
VITE_SOCKET_URL=
```

Server (`server/.env`):
```env
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5100
```

## Deployment

The client (static Vite build) and server (Node/Express/Socket.IO) can be deployed
together or to two separate hosts. **If they're on different domains** (e.g. client
on Vercel/Netlify, server on Render/Railway/Fly), you MUST set:

- `VITE_SOCKET_URL` (client) — the server's public HTTPS URL. Without this, the
  Socket.IO client connects to the client's own origin and every socket call
  (create room, join room, votes, etc.) will silently fail.
- `CORS_ORIGINS` (server) — the client's exact public origin. This must match
  exactly (scheme + host, no trailing slash) or both the REST health check and
  the Socket.IO handshake will be rejected.
- `PORT` (server) — most hosts inject this automatically; the server already
  reads `process.env.PORT`.

Build + run commands for the server in production:
```bash
cd server
npm install
npm run build   # tsc → dist/
npm start       # node dist/server/src/index.js
```

### Free-tier (Render) cold starts

Render's free web service sleeps after 15 min with no inbound HTTP (a 30–50 s
wake-up). The app already keeps the server awake **while anyone is in a room**
(each client pings `/api/health` every ~4 min), so a cold start only ever hits
the first player of a session. To eliminate cold starts entirely, point a free
uptime monitor (UptimeRobot, cron-job.org, …) at `<server-url>/api/health` every
5 minutes — a single always-on free web service fits inside the 750 free
instance-hours/month.

---

For architecture decisions and design rationale, see [ARCHITECTURE.md](./ARCHITECTURE.md)

