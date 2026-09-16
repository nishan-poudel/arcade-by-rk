/** Shared timing/geometry for the Ghotchu stacked-card reveal, so
 * GhotchuCard.vue's own animation and HandScreen.vue's sequencing/layout
 * stay in sync instead of duplicating magic numbers in two places. */
export const GHOTCHU_RUB_MS = 700
export const GHOTCHU_PEEL_MS = 900
export const GHOTCHU_STEP_MS = GHOTCHU_RUB_MS + GHOTCHU_PEEL_MS

export const GHOTCHU_CARD_WIDTH_REM = 6
export const GHOTCHU_CARD_ASPECT = 0.691
export const GHOTCHU_CARD_HEIGHT_REM = GHOTCHU_CARD_WIDTH_REM / GHOTCHU_CARD_ASPECT

/** Tight stack before a card's own turn — just enough offset for a sliver
 * of it to peek out from behind the one in front. */
export const GHOTCHU_PEEK_STEP_REM = 0.9

/** Gap between cards once fully fanned out — the end state has NO overlap
 * at all, so every card is a complete, fully-visible rectangle (edges,
 * shadow, and all) rather than a real hand-fan's usual partial overlap. */
export const GHOTCHU_GAP_REM = 0.5
export const GHOTCHU_FINAL_STEP_REM = GHOTCHU_CARD_WIDTH_REM + GHOTCHU_GAP_REM

export const GHOTCHU_HAND_WIDTH_REM = GHOTCHU_FINAL_STEP_REM * 2 + GHOTCHU_CARD_WIDTH_REM
