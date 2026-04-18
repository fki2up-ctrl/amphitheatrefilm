/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#050507',
          900: '#0a0a0d',
          800: '#111114',
          700: '#18181c',
          600: '#1f1f25',
        },
      },
      fontFamily: {
        // DM Sans is the primary UI typeface across the entire site.
        sans: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"DM Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Handwritten brand signature — used once in the intro sequence.
        hand: ['"Caveat"', 'ui-serif', 'cursive'],
      },
      letterSpacing: {
        widest2: '0.3em',
      },
    },
  },
  plugins: [],
};
