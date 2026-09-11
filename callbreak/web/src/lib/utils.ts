import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { PointsOT } from '@callbreak/shared-logic'

/** Merges Tailwind classes, resolving conflicts (standard shadcn-vue helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Nepali-style "points + OT" score display, e.g. "12 pts · 3 OT". */
export function formatPointsOT({ points, ot }: PointsOT): string {
  return `${points} pts · ${ot} OT`
}
