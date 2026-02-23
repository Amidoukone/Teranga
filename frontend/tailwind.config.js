/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

const withOpacity = (cssVar) => `rgb(var(${cssVar}) / <alpha-value>)`;

const primaryScale = {
  50: withOpacity('--color-primary-50'),
  100: withOpacity('--color-primary-100'),
  200: withOpacity('--color-primary-200'),
  300: withOpacity('--color-primary-300'),
  400: withOpacity('--color-primary-400'),
  500: withOpacity('--color-primary-500'),
  600: withOpacity('--color-primary-600'),
  700: withOpacity('--color-primary-700'),
  800: withOpacity('--color-primary-800'),
  900: withOpacity('--color-primary-900'),
};

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        /* ===============================
         * CORE BRAND
         * =============================== */
        primary: {
          DEFAULT: withOpacity('--color-primary'),
          dark: withOpacity('--color-primary-dark'),
        },
        accent: withOpacity('--color-primary'),

        /* ===============================
         * LEGACY GRAY (NE PAS TOUCHER)
         * ⚠️ Conservé pour compatibilité
         * =============================== */
        gray: {
          50: withOpacity('--color-bg-main'),
          100: withOpacity('--color-bg-surface'),
          200: withOpacity('--color-border'),
          300: withOpacity('--color-text-muted'),
          400: withOpacity('--color-text-secondary'),
          500: withOpacity('--color-text-secondary'),
          600: withOpacity('--color-text-primary'),
          700: withOpacity('--color-text-primary'),
          800: withOpacity('--color-text-primary'),
          900: withOpacity('--color-text-primary'),
        },

        /* ===============================
         * SEMANTIC TEXT COLORS (NEW)
         * ✅ À utiliser partout (NavBar, UI)
         * =============================== */
        text: {
          primary: withOpacity('--color-text-primary'),
          secondary: withOpacity('--color-text-secondary'),
          muted: withOpacity('--color-text-muted'),
          inverse: '255 255 255',
        },

        /* ===============================
         * SEMANTIC SURFACES (NEW)
         * =============================== */
        surface: {
          main: withOpacity('--color-bg-main'),
          card: withOpacity('--color-bg-surface'),
          sidebar: withOpacity('--color-bg-sidebar'),
          muted: withOpacity('--color-bg-main'),
        },

        /* ===============================
         * SEMANTIC BORDERS (NEW)
         * =============================== */
        border: {
          DEFAULT: withOpacity('--color-border'),
          subtle: withOpacity('--color-border'),
        },

        /* ===============================
         * STATUS COLORS
         * =============================== */
        blue: primaryScale,
        cyan: {
          300: withOpacity('--color-primary-300'),
          400: withOpacity('--color-primary-400'),
          500: withOpacity('--color-primary-500'),
          600: withOpacity('--color-primary-600'),
        },
        emerald: {
          400: withOpacity('--color-success'),
          500: withOpacity('--color-success'),
          600: withOpacity('--color-success'),
          700: withOpacity('--color-success'),
        },
        red: {
          500: withOpacity('--color-error'),
          600: withOpacity('--color-error'),
          700: withOpacity('--color-error'),
        },
        amber: {
          400: withOpacity('--color-warning'),
          500: withOpacity('--color-warning'),
          600: withOpacity('--color-warning'),
        },

        /* ===============================
         * UTILITY PALETTES (UNCHANGED)
         * =============================== */
        slate: colors.slate,
        zinc: colors.zinc,
        sky: colors.sky,
      },
    },
  },
  plugins: [],
};
