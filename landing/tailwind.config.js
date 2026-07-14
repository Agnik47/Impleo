/**
 * Impleo Design System v2 tokens — mirrored from extension/tailwind.config.js so
 * the marketing site and the product share one visual language. Base color/radius
 * tokens are identical; the marketing site adds a larger display type scale (the
 * in-app scale is deliberately compact) and the brand "chameleon-shift" gradient.
 */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#28C94E', // Primary Brand Green
          hover: '#00A050', // Secondary Green
        },
        jungle: '#002B2B', // Deep Jungle Green
        lime: '#A6D91A', // Lime Highlight
        signature: '#F5D000', // Signature Yellow
        cream: '#F4F060', // Soft Cream Highlight
        surface: {
          bg: '#0B0F0E',
          sidebar: '#121816',
          card: '#171C1A',
          'card-hover': '#1E2522',
          border: '#27332D',
        },
        ink: {
          primary: '#F5F5F5',
          secondary: '#A3A3A3',
          muted: '#737373',
        },
      },
      // Display scale — marketing-only. The in-app scale (brand guide: 18/14/13/
      // 12/11px) stays compact and is used verbatim for small text; story
      // headings need a larger scale. clamp() means one token covers every
      // breakpoint AND the size is known before paint — no reflow, protecting
      // the CLS < 0.05 target.
      fontSize: {
        'display-xl': ['clamp(2.5rem, 5.5vw, 4rem)', { lineHeight: '1.04', letterSpacing: '-0.025em' }],
        'display-lg': ['clamp(2rem, 3.8vw, 2.75rem)', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(1.5rem, 2.4vw, 1.875rem)', { lineHeight: '1.2', letterSpacing: '-0.015em' }],
        lead: ['1.0625rem', { lineHeight: '1.65' }],
      },
      fontFamily: {
        sans: [
          // 'Geist Variable' is the family name Fontsource registers for the
          // variable package imported in main.jsx — without it first, the stack
          // silently falls through to Inter/system and Geist never renders.
          // Plain 'Geist' is kept next for anyone with it installed locally.
          'Geist Variable',
          'Geist',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '12px',
        btn: '10px',
        input: '10px',
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.4), 0 8px 24px rgb(0 0 0 / 0.25)',
        'soft-sm': '0 2px 8px -2px rgb(0 0 0 / 0.3)',
        glow: '0 0 80px -20px rgb(166 217 26 / 0.45)', // lime chameleon glow
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      maxWidth: {
        container: '1120px',
      },
      keyframes: {
        'reveal-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'check-pop': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Idle ambient motion for the jungle scene — NOT scroll reveals (the
        // story reveals are GSAP scroll-driven transforms, per the brief's
        // "no fade-in" rule). These are slow, looping, decorative only.
        'float-slow': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slower': {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-16px) rotate(1.5deg)' },
        },
        'glow-pulse': {
          '0%,100%': { opacity: '0.35' },
          '50%': { opacity: '0.6' },
        },
        blink: {
          '0%,92%,100%': { transform: 'scaleY(1)' },
          '96%': { transform: 'scaleY(0.1)' },
        },
      },
      animation: {
        'reveal-up': 'reveal-up 250ms cubic-bezier(0.4,0,0.2,1) both',
        'check-pop': 'check-pop 250ms cubic-bezier(0.4,0,0.2,1) both',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'float-slower': 'float-slower 9s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 5s ease-in-out infinite',
        blink: 'blink 5.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
