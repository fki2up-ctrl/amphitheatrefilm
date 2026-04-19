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
        // All three font roles read from CSS custom properties defined in
        // src/index.css so the editor can hot-swap typography live without a
        // rebuild. Defaults live in :root; Supabase-backed overrides get
        // applied by the content store at runtime.
        sans:    ['var(--font-body)',    'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'ui-serif',      'serif'],
        hand:    ['var(--font-brand)',   'ui-serif',      'cursive'],
      },
      letterSpacing: {
        widest2: '0.3em',
      },
    },
  },
  plugins: [],
};
