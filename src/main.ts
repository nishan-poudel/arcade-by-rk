import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Self-hosted variable fonts — no external requests. Only the weight axis is
// imported (the app never uses italic / width variation), and the browser only
// downloads the unicode subset it actually needs.
import '@fontsource-variable/hanken-grotesk/wght.css'
import '@fontsource-variable/fredoka/wght.css'
import './assets/tailwind.css'

const app = createApp(App)

app.use(router)

app.mount('#app')
