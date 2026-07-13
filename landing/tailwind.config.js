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
      fontFamily: {
        sans: [
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
      },
      animation: {
        'reveal-up': 'reveal-up 250ms cubic-bezier(0.4,0,0.2,1) both',
        'check-pop': 'check-pop 250ms cubic-bezier(0.4,0,0.2,1) both',
      },
    },
  },
  plugins: [],
};
