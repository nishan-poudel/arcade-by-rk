/**
 * Prompt-bank loader for the Traitor game.
 *
 * Mirrors `server/src/config/index.ts` (the Imposter word-list loader):
 *  - Reads a JSON file from the top-level /config directory, derived from
 *    `process.cwd()` (the server always runs with cwd = server/).
 *  - Loaded once at startup and cached.
 *  - A malformed entry is skipped rather than crashing the whole list; a
 *    hard failure falls back to a built-in prompt so the game never crashes.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

/** A prompt pair: [ the Detectives' shared question, the Traitor's question ]. */
export interface PromptPair {
  detective: string
  traitor: string
}

const CONFIG_PATH = join(process.cwd(), '../config/traitor.json')

const FALLBACK: Record<string, PromptPair[]> = {
  Classic: [
    { detective: 'Who would stay calmest in a real emergency?', traitor: 'Who is the pickiest eater?' },
    { detective: 'Who gives the best advice?', traitor: 'Who is the worst at keeping a secret?' },
  ],
}

function loadPrompts(): Record<string, PromptPair[]> {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8')
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('traitor.json must be an object of { category: [[detectiveQ, traitorQ], ...] }')
    }

    const out: Record<string, PromptPair[]> = {}
    for (const [category, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) {continue}
      const pairs: PromptPair[] = []
      for (const item of list) {
        if (
          Array.isArray(item) &&
          typeof item[0] === 'string' &&
          item[0].trim() &&
          typeof item[1] === 'string' &&
          item[1].trim()
        ) {
          pairs.push({ detective: item[0].trim(), traitor: item[1].trim() })
        }
      }
      if (pairs.length > 0) {out[category] = pairs}
    }

    if (Object.keys(out).length === 0) {throw new Error('traitor.json has no usable prompt pairs')}
    return out
  } catch (err) {
    console.error('Failed to load traitor prompts, using fallback:', err)
    return FALLBACK
  }
}

/** Pre-loaded prompt bank, keyed by category name. */
export const promptBank: Record<string, PromptPair[]> = loadPrompts()

/** Category names, in file order. */
export const CATEGORIES: string[] = Object.keys(promptBank)

/** A category is valid if the bank has it. */
export function isValidCategory(category: unknown): category is string {
  return typeof category === 'string' && category in promptBank
}

/** Pick a random prompt pair for a category (falls back to the first category). */
export function pickPrompt(category: string): PromptPair {
  const list = promptBank[category] ?? promptBank[CATEGORIES[0]]
  return list[Math.floor(Math.random() * list.length)]
}
