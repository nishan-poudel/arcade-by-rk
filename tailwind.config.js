/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  theme: {
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

      // ── Brand colours ──────────────────────────────────────────────────
      colors: {
        brand: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        imposter: {
          500: '#ef4444',
          600: '#dc2626',
        },
        surface: {
          900: '#0d0d0d',
          800: '#141414',
          700: '#1a1a1a',
          600: '#222222',
          500: '#2a2a2a',
        },
      },

      // ── Typography ─────────────────────────────────────────────────────
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },

      // ── Animations ─────────────────────────────────────────────────────
      animation: {
        'fade-in':    'fadeIn 0.3s ease-in-out',
        'slide-up':   'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-once':'bounceOnce 0.5s ease-in-out',
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
      },
    },
  },
  plugins: [],
}
