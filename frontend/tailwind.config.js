/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb', // bleu principal
          dark: '#1e40af',
          light: '#3b82f6',
        },
        accent: '#10b981', // vert/émeraude
      },
    },
  },
  plugins: [],
}
