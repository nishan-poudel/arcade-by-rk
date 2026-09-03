import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { store } from './modules/shared/stores'

// Self-hosted variable fonts — bundled into the build, no external requests
// (keeps the strict production CSP `font-src 'self'` untouched).
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/fredoka'

import './global.scss'

const app = createApp(App)

app.use(store)
app.use(router)

app.mount('#app')
