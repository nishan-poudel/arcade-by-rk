/**
 * Security Headers Vite Plugin
 * ─────────────────────────────────────────────────────────────────────────────
 * Injects HTTP security meta tags into index.html at build time.
 *
 * WHY a plugin instead of hardcoding in index.html?
 *  • Dev needs a looser CSP (Vite HMR requires eval + WebSocket connections).
 *  • Production gets a strict policy with no dev-only escape hatches.
 *  • All policy configuration lives in one typed file — easy to audit, review,
 *    and update without touching HTML.
 *
 * IMPORTANT — frame-ancestors note:
 *  The `frame-ancestors` directive is intentionally omitted from the meta-tag
 *  CSP.  Browsers ignore it in <meta> tags (per the CSP Level 2 spec).
 *  It MUST be set as an HTTP response header on your server/CDN:
 *    Content-Security-Policy: frame-ancestors 'none'
 *    X-Frame-Options: DENY   (for older browser compat)
 *  See DEPLOY.md or your nginx/Vercel/Cloudflare config for where to add this.
 */

import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from 'vite'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Maps each CSP directive name to its list of source values. */
type CspDirectives = Record<string, string[]>

interface SecurityPolicy {
  /** Content-Security-Policy directive map. */
  csp: CspDirectives
  /**
   * Additional <meta http-equiv> or <meta name> tags to inject.
   * Use for headers that CAN be set via meta (X-Content-Type-Options,
   * Referrer-Policy).  Do NOT add frame-ancestors here — it has no effect
   * as a meta tag.
   */
  extraMeta: Array<Record<string, string>>
}

// ─────────────────────────────────────────────────────────────────────────────
// Policies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Development policy — deliberately relaxed so Vite's dev tooling works.
 *
 * unsafe-eval   → Vite's module runner and Vue DevTools need it in dev.
 * ws://localhost → Vite HMR WebSocket (port matched to vite.config.ts).
 * http://localhost:3000 → local API server during development.
 */
const DEV_POLICY: SecurityPolicy = {
  csp: {
    'default-src': ["'self'"],
    'script-src':  ["'self'", "'unsafe-eval'"],           // Vite HMR + Vue DevTools
    'style-src':   ["'self'", "'unsafe-inline'"],          // Vite injects inline styles
    'img-src':     ["'self'", 'data:', 'blob:'],
    'connect-src': [
      "'self'",
      'ws://localhost:5100',   // Vite HMR WebSocket
      'http://localhost:3000', // Local API
    ],
    'font-src':    ["'self'"],
    'object-src':  ["'none'"],
    'base-uri':    ["'self'"],
    'form-action': ["'self'"],
  },
  extraMeta: [],  // Skip hardening headers in dev to reduce noise
}

/**
 * Production policy — strict.
 *
 * No eval, no inline scripts, no external connections.
 * Before deploying a real back-end, add your API origin to connect-src:
 *   'connect-src': ["'self'", 'https://api.yourdomain.com'],
 */
const PROD_POLICY: SecurityPolicy = {
  csp: {
    'default-src': ["'self'"],
    'script-src':  ["'self'"],                             // No eval, no inline scripts
    'style-src':   ["'self'", "'unsafe-inline'"],          // Scoped SCSS → inline; tighten
                                                           // to a nonce when build pipeline
                                                           // supports it
    'img-src':     ["'self'", 'data:'],
    'connect-src': ["'self'"],                             // ← add API domain here
    'font-src':    ["'self'"],
    'object-src':  ["'none'"],
    'base-uri':    ["'self'"],
    'form-action': ["'self'"],
    // frame-ancestors intentionally omitted — must be an HTTP header, not meta
  },
  extraMeta: [
    // Prevents MIME-type sniffing
    { 'http-equiv': 'X-Content-Type-Options', content: 'nosniff' },
    // Limits Referer header exposure
    { name: 'referrer', content: 'strict-origin-when-cross-origin' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildCspString(directives: CspDirectives): string {
  return Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ')
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin
// ─────────────────────────────────────────────────────────────────────────────

export function securityHeadersPlugin(): Plugin {
  let resolvedConfig: ResolvedConfig

  return {
    name: 'vite-plugin-security-headers',

    /**
     * Capture the resolved Vite config so we know whether this is a dev
     * server (`command === 'serve'`) or a production build (`command === 'build'`).
     */
    configResolved(config) {
      resolvedConfig = config
    },

    /**
     * Runs on every HTML transform — both during `vite dev` and `vite build`.
     * Returns a list of tag descriptors that Vite injects into <head>.
     */
    transformIndexHtml() {
      const isProd  = resolvedConfig.command === 'build'
      const policy  = isProd ? PROD_POLICY : DEV_POLICY
      const cspContent = buildCspString(policy.csp)

      const tags: HtmlTagDescriptor[] = [
        // CSP first — highest priority, must be the earliest <meta> in <head>
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: cspContent },
          injectTo: 'head-prepend',
        },
        // Additional hardening headers (production only)
        ...policy.extraMeta.map((attrs): HtmlTagDescriptor => ({
          tag: 'meta',
          attrs,
          injectTo: 'head-prepend',
        })),
      ]

      return tags
    },
  }
}
