import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0f0f1a',
          card: '#1e1e3a',
          card_hover: '#2a2a4a',
        },
        alice: {
          purple: '#7B68EE',
          light: '#9B59B6',
          text: '#e0d0ff',
        },
        vip: {
          gold: '#ffd700',
        },
      },
      maxWidth: {
        chat: '600px',
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(123, 104, 238, 0.4)' },
          '50%': { boxShadow: '0 0 40px rgba(123, 104, 238, 0.8)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
