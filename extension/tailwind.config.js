export default {
  content: ['./src/sidepanel/**/*.{html,js,jsx}'],
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
      fontSize: {
        title: ['18px', { lineHeight: '24px', fontWeight: '600' }],
        card: ['14px', { lineHeight: '20px', fontWeight: '500' }],
        body: ['13px', { lineHeight: '18px' }],
        meta: ['12px', { lineHeight: '16px' }],
        caption: ['11px', { lineHeight: '14px' }],
      },
      borderRadius: {
        card: '12px',
        btn: '10px',
        input: '10px',
      },
      boxShadow: {
        soft: '0 4px 16px -4px rgb(0 0 0 / 0.35)',
        'soft-sm': '0 2px 8px -2px rgb(0 0 0 / 0.3)',
      },
      transitionDuration: {
        150: '150ms',
        250: '250ms',
      },
    },
  },
  plugins: [],
};
