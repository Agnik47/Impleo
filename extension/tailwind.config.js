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
        // Confidence-mapped ambient glows — same three-way semantic split
        // ReviewCard's confidenceStyles already uses (brand/signature/red),
        // just extended from a flat badge tint into a soft outer glow so a
        // card's trust level reads at a glance, not just from its label.
        'glow-high': '0 0 0 1px rgb(40 201 78 / 0.16), 0 0 24px -6px rgb(40 201 78 / 0.35)',
        'glow-medium': '0 0 0 1px rgb(245 208 0 / 0.16), 0 0 24px -6px rgb(245 208 0 / 0.35)',
        'glow-low': '0 0 0 1px rgb(239 68 68 / 0.16), 0 0 24px -6px rgb(239 68 68 / 0.3)',
        // Ambient mascot/hero glow — brand green at low opacity, the same
        // "glow = brand/25%" recipe used throughout this pass.
        glow: '0 0 60px -16px rgb(40 201 78 / 0.45)',
      },
      transitionDuration: {
        150: '150ms',
        250: '250ms',
      },
      transitionTimingFunction: {
        // Overshoot-and-settle spring feel for pop-ins/ripples — matches the
        // motion system's spring-based motion.js primitives so CSS-only
        // fallbacks (reduced-motion off but a JS spring not warranted) still
        // read as "spring," not "linear."
        spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        premium: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        // --- ported verbatim from landing/tailwind.config.js: Chameleon.jsx's
        //     pose accessories reference these class names directly, and the
        //     mascot is now shared between the two apps (see MotionSystem/
        //     Chameleon.jsx) — the keyframes have to travel with it.
        blink: {
          '0%,92%,100%': { transform: 'scaleY(1)' },
          '96%': { transform: 'scaleY(0.1)' },
        },
        'float-slow': {
          '0%,100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'float-slower': {
          '0%,100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-16px) rotate(1.5deg)' },
        },
        'check-pop': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.08)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'glow-pulse': {
          '0%,100%': { opacity: '0.35' },
          '50%': { opacity: '0.6' },
        },
        // --- new to the extension ---
        'mascot-breathe': {
          '0%,100%': { transform: 'scale(1) rotate(0deg)' },
          '50%': { transform: 'scale(1.035) rotate(1deg)' },
        },
        'orbit': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'orbit-counter': {
          from: { transform: 'translate(-50%, -50%) rotate(0deg)' },
          to: { transform: 'translate(-50%, -50%) rotate(-360deg)' },
        },
        'ray-sweep': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'particle-drift': {
          '0%,100%': { transform: 'translate(0, 0)', opacity: '0.5' },
          '50%': { transform: 'translate(6px, -14px)', opacity: '0.9' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.92) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'ripple-out': {
          '0%': { transform: 'scale(0)', opacity: '0.45' },
          '100%': { transform: 'scale(2.6)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-150% 0' },
          '100%': { backgroundPosition: '150% 0' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(48px) rotate(140deg)', opacity: '0' },
        },
        // WaitingState's pipeline: a small glow traveling down the connector
        // line between steps, looping — the "small looping animation" the
        // brief asks for, without animating the step icons themselves.
        'flow-travel': {
          '0%': { transform: 'translateY(-4px)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(calc(100% + 4px))', opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 5.5s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'float-slower': 'float-slower 9s ease-in-out infinite',
        'check-pop': 'check-pop 250ms cubic-bezier(0.4,0,0.2,1) both',
        'glow-pulse': 'glow-pulse 5s ease-in-out infinite',
        'mascot-breathe': 'mascot-breathe 3.6s ease-in-out infinite',
        orbit: 'orbit 16s linear infinite',
        'orbit-counter': 'orbit-counter 16s linear infinite',
        'ray-sweep': 'ray-sweep 22s linear infinite',
        'particle-drift': 'particle-drift 7s ease-in-out infinite',
        'pop-in': 'pop-in 320ms cubic-bezier(0.34,1.56,0.64,1) both',
        'ripple-out': 'ripple-out 600ms cubic-bezier(0.4,0,0.2,1)',
        shimmer: 'shimmer 2.4s ease-in-out infinite',
        'confetti-fall': 'confetti-fall 900ms cubic-bezier(0.4,0,0.2,1) both',
        'flow-travel': 'flow-travel 2.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
