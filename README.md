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
3. Host presses **Start Game**. Each person privately checks their phone to see their role and the secret word.
4. Players take turns saying **one word** out loud that relates to the secret word. Imposters must bluff.
5. After everyone has had a turn, the group discusses and votes. Host records the result.
6. The app reveals the secret word and imposters to everyone.
7. Host can start another round or end the game.

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
│   ├── modules/
│   │   ├── imposter/       # Imposter party game
│   │   │   ├── views/        # ImposterGame.vue (screen router)
│   │   │   ├── components/   # LandingScreen, WaitingRoom, PlayerScreen,
│   │   │   │              #   HostScreen, RoundReveal, GameOverScreen
│   │   │   ├── composables/  # useGame.ts, useSocket.ts
│   │   │   └── types/        # Client type re-exports
│   │   ├── home/           # Home page
│   │   ├── about/          # About page
│   │   ├── common/         # Shared layouts
│   │   └── shared/         # Global stores, services, composables, types
│   └── router/           # All client routes
├── server/               # Node.js + Express + Socket.IO backend
├── shared/types/         # TypeScript interfaces shared by client + server
└── config/               # Word lists (easy / medium / hard JSON)
```

## Key Technologies

| Layer | Technology |
|-------|------------|
| Client UI | Vue 3 + TypeScript + Vite |
| Styling | Tailwind CSS v3 (mobile-first, dark theme) |
| Real-time | Socket.IO (client + server) |
| Server | Node.js + Express |
| State | Vue `ref`/`computed` composables (no Vuex for game state) |
| Security | helmet, runtime validators, per-socket rate limiter |
| Shared types | TypeScript interfaces in `shared/types/` |

## Adding Routes

All routes are in one place: `src/router/index.ts`

```typescript
// 1. Add to ROUTE_NAMES
export const ROUTE_NAMES = { HOME: 'home', MY_PAGE: 'mypage' }

// 2. Add to ROUTE_PATHS  
export const ROUTE_PATHS = { HOME: '/', MY_PAGE: '/mypage' }

// 3. Add to routes array
const routes = [{
  path: ROUTE_PATHS.HOME,
  component: DefaultLayout,
  children: [
    { path: '', component: Home, name: ROUTE_NAMES.HOME },
    { path: ROUTE_PATHS.MY_PAGE, component: MyPage, name: ROUTE_NAMES.MY_PAGE },
  ]
}]
```

## Folder Structure Explanation

- **modules/home** - Home page and home-specific components
- **modules/about** - About page and about-specific components  
- **modules/common/layouts** - Shared layout components
- **modules/shared/stores** - Vuex state management
- **modules/shared/services** - API and external integrations
- **modules/shared/composables** - Reusable Vue logic
- **modules/shared/config** - App configuration
- **modules/shared/types** - TypeScript type definitions
- **router** - All route definitions

## Environment Variables

Client (`.env`):
```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_APP_ENV=development
```

Server (`server/.env`):
```env
PORT=3001
NODE_ENV=development
CORS_ORIGINS=http://localhost:5100
```

---

For architecture decisions and design rationale, see [ARCHITECTURE.md](./ARCHITECTURE.md)

