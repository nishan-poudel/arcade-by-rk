/**
 * Config loader for word lists.
 * Reads JSON files from the top-level /config directory.
 * Words are loaded once at startup and cached.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import type { Difficulty } from '../../../shared/types/index.js'

// Path to the root-level config/ directory.
// IMPORTANT: derived from process.cwd(), NOT __dirname/import.meta.url.
// The server is always launched with cwd = server/ (both `npm run dev` via tsx
// and `npm start` via node, since these scripts run from server/package.json).
// A __dirname-relative path would break because tsc's compiled output is
// nested under dist/server/src/... (TypeScript infers rootDir as the common
// ancestor of server/src AND ../shared, which are both compiled together),
// while tsx runs directly against src/ — two different nesting depths that a
// single hardcoded "../../../config" cannot satisfy correctly for both.
const CONFIG_DIR = join(process.cwd(), '../config')

/**
 * A single entry in a word list.
 *  - `word` is shown to the crewmates.
 *  - `hint` is a decoy word (closely related, never identical) shown only to
 *    the imposter. `null` when the list has no decoy for this word.
 */
export interface WordEntry {
  word: string
  hint: string | null
}

/**
 * Load a word list for a given difficulty.
 *
 * Accepts two on-disk shapes so old and new config files both work:
 *   1. `["word", "word", ...]`                    → hint is null
 *   2. `[["word", "decoy"], ["word", "decoy"]]`   → decoy becomes the hint
 * A malformed entry is skipped rather than crashing the whole list.
 */
function loadWords(difficulty: Difficulty): WordEntry[] {
  const filePath = join(CONFIG_DIR, `${difficulty}.json`)
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error(`Word list for "${difficulty}" is empty or malformed`)
    }

    const entries: WordEntry[] = []
    for (const item of parsed) {
      if (typeof item === 'string' && item.trim()) {
        entries.push({ word: item.trim(), hint: null })
      } else if (Array.isArray(item) && typeof item[0] === 'string' && item[0].trim()) {
        const word = item[0].trim()
        const decoy = typeof item[1] === 'string' && item[1].trim() ? item[1].trim() : null
        // A decoy identical to the word defeats the purpose — drop it.
        entries.push({ word, hint: decoy && decoy !== word ? decoy : null })
      }
    }

    if (entries.length === 0) {
      throw new Error(`Word list for "${difficulty}" has no usable entries`)
    }
    return entries
  } catch (err) {
    console.error(`Failed to load words for difficulty "${difficulty}":`, err)
    return [{ word: 'DefaultWord', hint: null }] // fallback so game never crashes
  }
}

/** Pre-loaded word lists keyed by difficulty */
export const wordLists: Record<Difficulty, WordEntry[]> = {
  easy: loadWords('easy'),
  medium: loadWords('medium'),
  hard: loadWords('hard'),
}

/** Pick a random word entry (word + optional decoy hint) for the difficulty */
export function pickWord(difficulty: Difficulty): WordEntry {
  const list = wordLists[difficulty]
  return list[Math.floor(Math.random() * list.length)]
}

/** Server port read from environment or default */
export const SERVER_PORT = parseInt(process.env.PORT ?? '3001', 10)

/** Allowed CORS origins */
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5100,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
