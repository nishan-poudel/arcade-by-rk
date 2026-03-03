# Vue 3 + Vite Application

A production-ready Vue 3 application with Vuex state management and modular architecture.

## Prerequisites

- **Node.js 16.14+** - [Download](https://nodejs.org/)
- **npm 6.14+**

## Installation & Setup

```bash
# 1. Install dependencies
npm install

# 2. Create .env file (optional, defaults are provided)
cp .env.example .env
```

## Running the App

```bash
# Start development server (opens http://localhost:5100)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Available Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run local` | Build and run production build locally |
| `npm run type-check` | Check TypeScript types |
| `npm run lint` | Lint and fix code |

## Project Structure

```
src/
├── modules/
│   ├── home/              # Home feature
│   ├── about/             # About feature
│   ├── common/            # Shared layouts
│   └── shared/            # Global state, services, composables
├── router/                # All routes defined here
└── App.vue
```

## Key Technologies

- **Vue 3** - Progressive JavaScript framework
- **Vite** - Fast build tool
- **TypeScript** - Type safety
- **Vuex** - State management
- **Vue Router** - Client-side routing
- **Axios** - HTTP client
- **ESLint + Prettier** - Code quality

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

Create a `.env` file (based on `.env.example`):

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_ENV=development
```

---

For architecture decisions and design rationale, see [ARCHITECTURE.md](./ARCHITECTURE.md)

