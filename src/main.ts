import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Self-hosted variable fonts — no external requests.
import '@fontsource-variable/hanken-grotesk'
import '@fontsource-variable/fredoka'
import './assets/tailwind.css'

const app = createApp(App)

app.use(router)

app.mount('#app')
