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

const rawApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

// In production, a missing VITE_API_BASE_URL is a misconfiguration — we throw
// rather than silently falling back to localhost (which would either fail or
// hit an unintended internal host in a containerised environment).
if (import.meta.env.PROD && !rawApiUrl) {
  throw new Error(
    '[config] VITE_API_BASE_URL is not set. ' +
    'Configure it in your deployment environment before building for production.'
  )
}

export const appConfig: AppConfig = {
  apiBaseUrl: rawApiUrl ?? 'http://localhost:3000/api',
  env: (import.meta.env.VITE_APP_ENV as AppConfig['env']) ?? 'development',
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
}

if (appConfig.isDev) {
  console.log('🔧 App Config:', appConfig)
}
