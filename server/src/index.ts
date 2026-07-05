/**
 * Server entry point.
 *
 * Responsibilities:
 *  - Boot Express with security middleware (helmet, CORS, JSON size limit)
 *  - Attach Socket.IO
 *  - Register REST health endpoint
 *  - Handle graceful shutdown on SIGTERM / SIGINT
 *
 * Environment variables (see .env.example in project root):
 *  PORT          – TCP port to listen on (default 3001)
 *  CORS_ORIGINS  – Comma-separated allowed origins (default localhost only)
 *  NODE_ENV      – 'production' | 'development' (default 'development')
 */
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import helmet from 'helmet'
import { SERVER_PORT, CORS_ORIGINS } from './config/index.js'
import { registerSocketHandlers } from './socket/handlers.js'
import { logger } from './utils/logger.js'

const app = express()

// ── Security middleware ────────────────────────────────────────────────────
// helmet sets secure HTTP response headers (X-Frame-Options, CSP, HSTS, etc.)
app.use(
  helmet({
    // CSP is intentionally restrictive; Socket.IO WS connections are not HTTP
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        scriptSrc:  ["'none'"],
        connectSrc: CORS_ORIGINS,
      },
    },
  }),
)

// Restrict CORS to known origins only – never use '*' in production
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (same-origin, curl, health checks)
      if (!origin || CORS_ORIGINS.includes(origin)) {
        cb(null, true)
      } else {
        logger.warn('CORS rejected', { origin })
        // Pass false (not an Error) so express-cors returns 204 without
        // Access-Control-Allow-Origin.  Browsers enforce the block; curl ignores it.
        cb(null, false)
      }
    },
    methods: ['GET'],
  }),
)

// Limit request body to 10 KB – sufficient for any game payload, blocks large bombs
app.use(express.json({ limit: '10kb' }))

// Disable X-Powered-By (already done by helmet, but explicit is better)
app.disable('x-powered-by')

// ── REST endpoints ─────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  const IS_PROD = process.env.NODE_ENV === 'production'
  // In production, return minimal info to reduce information disclosure
  res.json(IS_PROD ? { status: 'ok' } : { status: 'ok', timestamp: new Date().toISOString() })
})

// Catch-all for undefined REST routes – prevents leaking stack traces
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ── HTTP + Socket.IO server ────────────────────────────────────────────────
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
  },
  // Limit max HTTP buffer size to prevent oversized event payloads (1 MB)
  maxHttpBufferSize: 1e6,
  // Allow client reconnection within 60 s before cleaning up the socket
  connectionStateRecovery: {
    maxDisconnectionDuration: 60_000,
  },
})

// Register all socket event handlers
registerSocketHandlers(io)

// ── Start ──────────────────────────────────────────────────────────────────
const server = httpServer.listen(SERVER_PORT, () => {
  logger.info('Imposter Game Server started', {
    port: SERVER_PORT,
    env: process.env.NODE_ENV ?? 'development',
    origins: CORS_ORIGINS,
  })
})

// ── Graceful shutdown ──────────────────────────────────────────────────────
// Handles SIGTERM (e.g. k8s pod eviction, Docker stop) and SIGINT (Ctrl-C)
// Closes the HTTP server cleanly so in-flight requests complete.
function shutdown(signal: string) {
  logger.info(`${signal} received – shutting down gracefully`)
  io.close()
  server.close((err) => {
    if (err) {
      logger.error('Error during shutdown', { err: String(err) })
      process.exit(1)
    }
    logger.info('Server closed')
    process.exit(0)
  })

  // Force exit if still running after 10 s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))

// Catch unhandled promise rejections and log them instead of crashing silently
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) })
})

