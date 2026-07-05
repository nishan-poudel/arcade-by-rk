/**
 * Config loader for word lists.
 * Reads JSON files from the top-level /config directory.
 * Words are loaded once at startup and cached.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Difficulty } from '../../../shared/types/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Path to the root-level config/ directory (three levels up: src/config → src → server → web)
const CONFIG_DIR = join(__dirname, '../../../config')

/** Load word list for a given difficulty from the corresponding JSON file */
function loadWords(difficulty: Difficulty): string[] {
  const filePath = join(CONFIG_DIR, `${difficulty}.json`)
  try {
    const raw = readFileSync(filePath, 'utf-8')
    const words: string[] = JSON.parse(raw)
    if (!Array.isArray(words) || words.length === 0) {
      throw new Error(`Word list for "${difficulty}" is empty or malformed`)
    }
    return words
  } catch (err) {
    console.error(`Failed to load words for difficulty "${difficulty}":`, err)
    return ['DefaultWord'] // fallback so game never crashes
  }
}

/** Pre-loaded word lists keyed by difficulty */
export const wordLists: Record<Difficulty, string[]> = {
  easy: loadWords('easy'),
  medium: loadWords('medium'),
  hard: loadWords('hard'),
}

/** Pick a random word for the given difficulty */
export function pickWord(difficulty: Difficulty): string {
  const list = wordLists[difficulty]
  return list[Math.floor(Math.random() * list.length)]
}

/** Server port read from environment or default */
export const SERVER_PORT = parseInt(process.env.PORT ?? '3001', 10)

/** Allowed CORS origins */
export const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:5100,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
