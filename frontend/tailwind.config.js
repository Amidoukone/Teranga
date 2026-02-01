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
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: withOpacity('--color-primary'),
          dark: withOpacity('--color-primary-dark'),
        },
        accent: withOpacity('--color-primary'),
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
        nav: {
          bg: withOpacity('--color-nav-bg'),
          surface: withOpacity('--color-nav-surface'),
          border: withOpacity('--color-nav-border'),
          text: withOpacity('--color-nav-text'),
          muted: withOpacity('--color-nav-muted'),
          accent: withOpacity('--color-nav-accent'),
          accentStrong: withOpacity('--color-nav-accent-strong'),
        },
        sky: colors.sky,
        slate: colors.slate,
        zinc: colors.zinc,
      },
    },
  },
  plugins: [],
}
