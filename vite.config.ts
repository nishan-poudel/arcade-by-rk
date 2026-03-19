import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { securityHeadersPlugin } from './plugins/security-headers'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    securityHeadersPlugin(), // injects env-aware CSP + security meta tags
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5100,
    open: true,
    hmr: {
      host: 'localhost',
      port: 5100,
      protocol: 'ws',
    },
  },
})
