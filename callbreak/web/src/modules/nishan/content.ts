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
  /** Every tile's CTA links here unconditionally, "Coming Soon" included —
   * must be a real, live destination even for a not-yet-launched project
   * (a placeholder page is fine; a placeholder URL like '#' is not). */
  url: string
  category: ProjectCategory
  flavor: Flavor
  blurb: string
  /** Playful, project-specific call-to-action text instead of a plain "Visit". */
  cta: string
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
    blurb: 'Spot who’s nearby and send them an anonymous compliment. No names required until you’re ready. Free, 18+, safety-first.',
    cta: 'Send a spark',
  },
  {
    name: 'Nepali Imposter',
    url: 'https://imposter-by-rk.onrender.com',
    category: 'Game',
    flavor: 'berry',
    icon: VenetianMask,
    blurb: 'Everyone gets a secret word except one person. Pass the phone around and see who can bluff their way out of getting caught.',
    cta: 'Catch the imposter',
  },
  {
    name: 'Taas Adda',
    url: 'https://call-break-by-rk.nishan-poudel.workers.dev',
    category: 'Game',
    flavor: 'citron',
    blurb: 'My Nepali card-game hub: Call Break online, an offline score keeper, and Faras (Teen Patti). Yes, the page you’re on right now.',
    cta: 'Deal me in',
  },
  {
    name: 'Arcade by RK',
    url: 'https://arcade-by-rk.vercel.app/',
    category: 'Game',
    flavor: 'lychee',
    icon: Puzzle,
    blurb: 'Two original browser games built just for fun: Grid Raider, a roguelike raid, and Math Chain, a logic puzzle. No installs, no accounts.',
    cta: 'Insert coin',
  },
  {
    name: 'Momo Not Momos',
    url: 'https://momonotmomos.com',
    category: 'Food & Culture',
    flavor: 'peach',
    icon: Soup,
    blurb: 'A Gen Z shrine to momo culture, complete with a personality quiz, a momo dictionary, and live voting for the best momo around.',
    cta: 'Take a bite',
  },
  {
    name: 'Soju Nepal',
    url: 'https://sojunepal.com',
    category: 'Coming Soon',
    flavor: 'melon',
    icon: Wine,
    blurb: 'Something new is fermenting behind the scenes. Check back soon to see what it turns into.',
    cta: 'Cheers, soon',
  },
]
