import tailwindcssAnimate from 'tailwindcss-animate'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        sm: '100%',
        md: '640px',
        lg: '720px',
      },
    },
    extend: {
      // ── Dynamic viewport height ────────────────────────────────────────
      // dvh = dynamic viewport height — accounts for browser chrome
      // appearing/disappearing on mobile (unlike fixed vh).
      minHeight: {
        'dvh': '100dvh',
        'screen': '100dvh', // override vh with dvh globally
      },
      height: {
        'dvh': '100dvh',
      },

      // ── shadcn-vue theme tokens (CSS variables defined in tailwind.css) ──
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        // Brand accents kept for game-specific semantics (imposter red, host gold)
        imposter: {
          500: '#ef4444',
          600: '#dc2626',
        },

        // ── "Juicy soda" flavor palette — decorative accents only (difficulty
        // tags, imposter chips, podium places). Each flavor is a trio: the
        // saturated hue, a pale wash for backgrounds, and an ink shade for
        // text on the wash. Values swap per-theme via the CSS vars below.
        flavor: {
          citron: {
            DEFAULT: 'hsl(var(--flavor-citron))',
            soft: 'hsl(var(--flavor-citron-soft))',
            ink: 'hsl(var(--flavor-citron-ink))',
          },
          peach: {
            DEFAULT: 'hsl(var(--flavor-peach))',
            soft: 'hsl(var(--flavor-peach-soft))',
            ink: 'hsl(var(--flavor-peach-ink))',
          },
          berry: {
            DEFAULT: 'hsl(var(--flavor-berry))',
            soft: 'hsl(var(--flavor-berry-soft))',
            ink: 'hsl(var(--flavor-berry-ink))',
          },
          grape: {
            DEFAULT: 'hsl(var(--flavor-grape))',
            soft: 'hsl(var(--flavor-grape-soft))',
            ink: 'hsl(var(--flavor-grape-ink))',
          },
          lychee: {
            DEFAULT: 'hsl(var(--flavor-lychee))',
            soft: 'hsl(var(--flavor-lychee-soft))',
            ink: 'hsl(var(--flavor-lychee-ink))',
          },
          melon: {
            DEFAULT: 'hsl(var(--flavor-melon))',
            soft: 'hsl(var(--flavor-melon-soft))',
            ink: 'hsl(var(--flavor-melon-ink))',
          },
        },
      },

      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Organic squircle — decorative blobs only.
        blob: '42% 58% 63% 37% / 43% 38% 62% 57%',
      },

      // ── Typography ─────────────────────────────────────────────────────
      // font-sans = body copy (Hanken Grotesk); font-display = headlines,
      // the secret word, room code, scores — anywhere the "juicy" voice
      // should show. Both self-hosted via @fontsource-variable (main.ts),
      // falling back to the previous system-font stack.
      fontFamily: {
        sans: [
          'Hanken Grotesk Variable', '-apple-system', 'BlinkMacSystemFont',
          'Segoe UI', 'Roboto', 'sans-serif',
        ],
        display: [
          'Fredoka Variable', 'Hanken Grotesk Variable', 'ui-rounded',
          '-apple-system', 'sans-serif',
        ],
      },

      // ── Shadows & motion curves ────────────────────────────────────────
      boxShadow: {
        // Soft colored lift for hovered/elevated surfaces.
        pop: '0 18px 40px -18px hsl(var(--primary) / 0.35)',
        // Hard "sticker" offset shadow — pairs with a 2px border.
        hard: '4px 4px 0 0 hsl(var(--foreground))',
        'hard-sm': '3px 3px 0 0 hsl(var(--foreground))',
      },
      transitionTimingFunction: {
        bounce: 'cubic-bezier(0.34, 1.4, 0.5, 1)',
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      // ── Animations ─────────────────────────────────────────────────────
      // Existing entries are kept byte-for-byte (referenced by class name
      // across every screen); new ones are additive.
      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-once':'bounceOnce 0.5s ease-in-out',
        'pop-in':     'popIn 0.35s cubic-bezier(0.34, 1.4, 0.5, 1)',
        'wobble':     'wobble 6s ease-in-out infinite',
        'float':      'float 8s ease-in-out infinite',
        'confetti-fall': 'confettiFall 1.8s ease-in forwards',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        bounceOnce: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%':      { transform: 'scale(1.08)' },
        },
        popIn: {
          '0%':   { opacity: '0', transform: 'scale(0.85)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        wobble: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%':      { transform: 'rotate(2deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) rotate(0deg)' },
          '50%':      { transform: 'translate3d(0, -14px, 0) rotate(3deg)' },
        },
        confettiFall: {
          '0%':   { opacity: '1', transform: 'translateY(0) rotate(0deg)' },
          '80%':  { opacity: '1' },
          '100%': { opacity: '0', transform: 'translateY(220px) rotate(220deg)' },
        },
      },
    },
  },
  plugins: [tailwindcssAnimate],
}
