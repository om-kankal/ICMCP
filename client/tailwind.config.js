/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      },
      colors: {
        // Bold, vivid mint/teal — the light-mode brand accent (buttons,
        // active nav states, badges, focus rings, the sidebar gradient).
        brand: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59', // primary CTA / active-state shade
          900: '#134e4a',
          950: '#042f2e'
        },
        // Tailwind's slate scale, with 700–950 shifted from its default
        // blue-tinted grays toward a neutral near-black ramp — every
        // `dark:bg-slate-900/950` and `dark:border-slate-700/800` surface
        // in the app (cards, panels, modals, page background) is built
        // from these tokens, so this one change makes dark mode read as
        // true pitch black end-to-end. 50–600 are untouched Tailwind
        // defaults — those cover light-mode surfaces/text and legible
        // dark-mode text (dark:text-slate-200/300/400), which should stay
        // as-is.
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#27272a',
          800: '#18181b',
          900: '#0a0a0a',
          950: '#000000'
        },
        status: {
          compliant: '#059669',
          compliantBg: '#ecfdf5',
          compliantBorder: '#a7f3d0',
          due: '#d97706',
          dueBg: '#fffbeb',
          dueBorder: '#fde68a',
          overdue: '#e11d48',
          overdueBg: '#fff1f2',
          overdueBorder: '#fecdd3'
        }
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16, 30, 54, 0.04), 0 1px 3px 0 rgba(16, 30, 54, 0.06)',
        popover: '0 8px 24px -4px rgba(16, 30, 54, 0.16)'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #115e59 0%, #0d9488 100%)'
      }
    }
  },
  plugins: []
}
