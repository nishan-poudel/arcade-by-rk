export type Suit = 'S' | 'H' | 'D' | 'C'

/** 11=Jack, 12=Queen, 13=King, 14=Ace. Spades (S) are always trump. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14

export interface Card {
  suit: Suit
  rank: Rank
}

/** A single played card plus which seat (0-3) played it, in play order. */
export interface TrickPlay {
  card: Card
  seat: number
}

export const SUITS: readonly Suit[] = ['S', 'H', 'D', 'C']

export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]

export const CARDS_PER_HAND = 13
export const SEATS = 4
