/**
 * Lightweight structured logger.
 *
 * Outputs JSON in production (easy to ingest by log aggregators like
 * Datadog / CloudWatch) and human-readable coloured lines in development.
 *
 * Usage:
 *   import { logger } from './logger.js'
 *   logger.info('Room created', { roomCode: 'ABC123' })
 *   logger.warn('Rate limit hit', { socketId })
 *   logger.error('Unexpected crash', { err })
 */

type Level = 'debug' | 'info' | 'warn' | 'error'
type Meta = Record<string, unknown>

const IS_PROD = process.env.NODE_ENV === 'production'

// ANSI colour codes for dev output
const COLOURS: Record<Level, string> = {
  debug: '\x1b[36m', // cyan
  info:  '\x1b[32m', // green
  warn:  '\x1b[33m', // yellow
  error: '\x1b[31m', // red
}
const RESET = '\x1b[0m'

function log(level: Level, message: string, meta?: Meta): void {
  const timestamp = new Date().toISOString()

  if (IS_PROD) {
    // Structured JSON – safe for log aggregators
    const entry: Record<string, unknown> = { level, timestamp, message, ...meta }
    // Use stderr for warn/error so they can be routed separately in k8s / ECS
    const output = level === 'error' || level === 'warn' ? process.stderr : process.stdout
    output.write(JSON.stringify(entry) + '\n')
  } else {
    // Human-readable for local development
    const prefix = `${COLOURS[level]}[${level.toUpperCase()}]${RESET}`
    const metaStr = meta ? ' ' + JSON.stringify(meta) : ''
    console.log(`${prefix} ${timestamp} ${message}${metaStr}`)
  }
}

export const logger = {
  debug: (msg: string, meta?: Meta) => log('debug', msg, meta),
  info:  (msg: string, meta?: Meta) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Meta) => log('warn',  msg, meta),
  error: (msg: string, meta?: Meta) => log('error', msg, meta),
}
