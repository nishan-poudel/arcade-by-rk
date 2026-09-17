// Personal portfolio copy for /nishan — plain data, not app i18n, since
// this is one person's bio/project list rather than translatable game UI
// strings (unlike src/locales/en.ts, which every game module shares).
import {
  Puzzle,
  Soup,
  Sparkles,
  VenetianMask,
  Wine,
  type LucideIcon,
} from '@lucide/vue'

export const PROFILE = {
  name: 'Nishan Poudel',
  role: 'Software Engineer',
  education: 'B.S., University of Wisconsin–Parkside',
  email: 'nishan.poudel@outlook.com',
  tagline: "I build small, playful things — party games, card games, and whatever else won't leave me alone until it exists.",
}

export type ProjectCategory = 'App' | 'Game' | 'Food & Culture' | 'Coming Soon'

export const CATEGORIES: ProjectCategory[] = ['App', 'Game', 'Food & Culture', 'Coming Soon']

/** One of the app's existing muted flavor hues — used to give each project
 * tile its own pastel-card + solid-pill color pairing (Tailwind needs the
 * full class name as a literal somewhere in source to generate it, hence
 * FLAVOR_CLASSES below rather than building class names by interpolation). */
export type Flavor = 'citron' | 'peach' | 'berry' | 'grape' | 'lychee' | 'melon'

export const FLAVOR_CLASSES: Record<Flavor, { card: string; icon: string; pill: string }> = {
  citron: { card: 'bg-flavor-citron/20', icon: 'text-flavor-citron-ink', pill: 'bg-flavor-citron-ink' },
  peach: { card: 'bg-flavor-peach/20', icon: 'text-flavor-peach-ink', pill: 'bg-flavor-peach-ink' },
  berry: { card: 'bg-flavor-berry/20', icon: 'text-flavor-berry-ink', pill: 'bg-flavor-berry-ink' },
  grape: { card: 'bg-flavor-grape/20', icon: 'text-flavor-grape-ink', pill: 'bg-flavor-grape-ink' },
  lychee: { card: 'bg-flavor-lychee/20', icon: 'text-flavor-lychee-ink', pill: 'bg-flavor-lychee-ink' },
  melon: { card: 'bg-flavor-melon/20', icon: 'text-flavor-melon-ink', pill: 'bg-flavor-melon-ink' },
}

export interface Project {
  name: string
  url: string
  category: ProjectCategory
  flavor: Flavor
  blurb: string
  /** Undefined for the one project that reuses SuitGlyph instead. */
  icon?: LucideIcon
}

export const PROJECTS: Project[] = [
  {
    name: 'Nearmirer',
    url: 'https://nearmirer.com',
    category: 'App',
    flavor: 'grape',
    icon: Sparkles,
    blurb: 'See who’s near you right now and send an anonymous compliment. Free, 18+, safety-first.',
  },
  {
    name: 'Nepali Imposter',
    url: 'https://imposter-by-rk.onrender.com',
    category: 'Game',
    flavor: 'berry',
    icon: VenetianMask,
    blurb: 'A pass-the-phone party game: everyone gets a secret word except the imposter, who has to bluff their way through.',
  },
  {
    name: 'Taas Adda',
    url: 'https://call-break-by-rk.nishan-poudel.workers.dev',
    category: 'Game',
    flavor: 'citron',
    blurb: "A Nepali card-game hub: Call Break online, an offline score keeper, and Faras (Teen Patti). You're on it right now.",
  },
  {
    name: 'Arcade by RK',
    url: 'https://arcade-by-rk.vercel.app/',
    category: 'Game',
    flavor: 'lychee',
    icon: Puzzle,
    blurb: 'Two original browser games, no installs or accounts: Grid Raider and Math Chain.',
  },
  {
    name: 'Momo Not Momos',
    url: 'https://momonotmomos.com',
    category: 'Food & Culture',
    flavor: 'peach',
    icon: Soup,
    blurb: 'The Gen Z home for momo culture: a personality quiz, a momo dictionary, and live voting for the best momo.',
  },
  {
    name: 'Soju Nepal',
    url: 'https://sojunepal.com',
    category: 'Coming Soon',
    flavor: 'melon',
    icon: Wine,
    blurb: 'A new venture in the works — more here once it launches.',
  },
]
