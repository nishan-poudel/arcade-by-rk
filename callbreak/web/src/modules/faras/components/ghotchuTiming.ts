/** Shared timing/geometry for the Ghotchu stacked-card reveal, so
 * GhotchuCard.vue's own animation and HandScreen.vue's sequencing/layout
 * stay in sync instead of duplicating magic numbers in two places. */
export const GHOTCHU_RUB_MS = 700
export const GHOTCHU_PEEL_MS = 900
export const GHOTCHU_STEP_MS = GHOTCHU_RUB_MS + GHOTCHU_PEEL_MS

export const GHOTCHU_CARD_WIDTH_REM = 6.5
export const GHOTCHU_CARD_ASPECT = 0.691
export const GHOTCHU_CARD_HEIGHT_REM = GHOTCHU_CARD_WIDTH_REM / GHOTCHU_CARD_ASPECT

/** Tight stack before a card's own turn — just enough offset for a sliver
 * of it to peek out from behind the one in front. */
export const GHOTCHU_PEEK_STEP_REM = 0.7
/** Fanned-out spacing once a card has revealed — wide enough that all
 * three stay fully legible side by side. */
export const GHOTCHU_FINAL_STEP_REM = GHOTCHU_CARD_WIDTH_REM * 0.6

export const GHOTCHU_HAND_WIDTH_REM = GHOTCHU_FINAL_STEP_REM * 2 + GHOTCHU_CARD_WIDTH_REM
