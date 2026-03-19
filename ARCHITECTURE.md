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
