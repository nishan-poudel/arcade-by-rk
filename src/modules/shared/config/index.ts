/**
 * Application Configuration
 *
 * Centralized environment configuration.
 * All VITE_ prefixed variables are available on import.meta.env
 */

interface AppConfig {
  apiBaseUrl: string
  env: 'development' | 'staging' | 'production'
  isDev: boolean
  isProd: boolean
}

export const appConfig: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  env: (import.meta.env.VITE_APP_ENV as AppConfig['env']) || 'development',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}

if (appConfig.isDev) {
  console.log('🔧 App Config:', appConfig)
}
